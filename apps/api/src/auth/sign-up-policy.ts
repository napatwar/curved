import type { Db } from "@curved/db";
import { and, eq, gt, sql } from "@curved/db/orm";
import { user, workspaceInvitation } from "@curved/db/schema";
import { APIError } from "better-auth/api";

export type SignUpPolicy = {
  /** Lets anyone sign up, as on the cloud deployment. */
  openSignUp: boolean;
};

/**
 * Decides whether a new user may be created, and with which instance role
 * (decision record 0005). It runs for every way of creating a user: email
 * sign-up, OAuth sign-in and the admin plugin.
 *
 * - The first user becomes the instance admin.
 * - After that, sign-up is closed unless `openSignUp` is set. People with a
 *   pending invitation can still sign up, so they can accept it.
 * - An instance admin can always create users.
 */
export async function roleForNewUser(
  db: Db,
  policy: SignUpPolicy,
  newUser: { email: string },
  path: string | undefined,
): Promise<"admin" | "user"> {
  const [anyUser] = await db.select({ id: user.id }).from(user).limit(1);
  if (!anyUser) {
    return "admin";
  }
  // The admin plugin checks that the caller is an instance admin.
  if (policy.openSignUp || path === "/admin/create-user") {
    return "user";
  }
  const [invitation] = await db
    .select({ id: workspaceInvitation.id })
    .from(workspaceInvitation)
    .where(
      and(
        eq(sql`lower(${workspaceInvitation.email})`, newUser.email.toLowerCase()),
        eq(workspaceInvitation.status, "pending"),
        gt(workspaceInvitation.expiresAt, new Date()),
      ),
    )
    .limit(1);
  if (invitation) {
    return "user";
  }
  throw new APIError("FORBIDDEN", {
    code: "SIGN_UP_CLOSED",
    message: "Sign-up is closed. Ask an admin of this instance for an invitation.",
  });
}
