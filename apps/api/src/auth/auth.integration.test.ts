import { createDb } from "@curved/db";
import { eq } from "@curved/db/orm";
import { user, workspace, workspaceMember } from "@curved/db/schema";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";

import { testDatabaseUrl } from "../../../../test/database";
import { resetDatabase } from "../../../../test/fixtures";
import { createAuth } from "./create-auth";

const db = createDb(testDatabaseUrl);
const baseURL = "http://localhost:5173";

function makeAuth(openSignUp = false) {
  return createAuth({
    db,
    secret: "test-secret-that-is-at-least-32-characters",
    baseURL,
    openSignUp,
  });
}

let auth = makeAuth();

// Calls Better Auth over HTTP, as the browser does.
async function call(path: string, body: unknown, cookie?: string) {
  return auth.handler(
    new Request(`${baseURL}/api/auth${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: baseURL,
        ...(cookie && { cookie }),
      },
      body: JSON.stringify(body),
    }),
  );
}

async function signUp(email: string) {
  return call("/sign-up/email", { email, password: "a-long-password", name: email.split("@")[0] });
}

function sessionCookie(response: Response) {
  const cookie = response.headers.getSetCookie().find((value) => value.includes("session_token"));
  if (!cookie) {
    throw new Error("No session cookie");
  }
  return cookie;
}

function cookieHeader(response: Response) {
  return sessionCookie(response).split(";")[0] ?? "";
}

async function roleOf(email: string) {
  const [row] = await db.select({ role: user.role }).from(user).where(eq(user.email, email));
  return row?.role;
}

beforeEach(async () => {
  await resetDatabase(db);
  auth = makeAuth();
});

afterAll(async () => {
  await db.$client.end();
});

describe("sign-up on a self-hosted instance", () => {
  it("makes the first user the instance admin", async () => {
    const response = await signUp("first@example.com");

    expect(response.status).toBe(200);
    expect(await roleOf("first@example.com")).toBe("admin");
  });

  it("closes sign-up after the first user", async () => {
    await signUp("first@example.com");

    const response = await signUp("second@example.com");

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: "SIGN_UP_CLOSED" });
    expect(await roleOf("second@example.com")).toBeUndefined();
  });

  it("lets anyone sign up when sign-up is open", async () => {
    auth = makeAuth(true);
    await signUp("first@example.com");

    const response = await signUp("second@example.com");

    expect(response.status).toBe(200);
    expect(await roleOf("second@example.com")).toBe("user");
  });

  it("lets a person with a pending invitation sign up", async () => {
    const admin = cookieHeader(await signUp("first@example.com"));
    const created = await call("/organization/create", { name: "Acme", slug: "acme" }, admin);
    const { id: workspaceId } = z.object({ id: z.string() }).parse(await created.json());
    const invited = await call(
      "/organization/invite-member",
      { email: "invited@example.com", role: "member", organizationId: workspaceId },
      admin,
    );
    const { id: invitationId } = z.object({ id: z.string() }).parse(await invited.json());

    const response = await signUp("invited@example.com");

    expect(response.status).toBe(200);
    expect(await roleOf("invited@example.com")).toBe("user");
    // Without SMTP, the invitation link is enough to join.
    const accepted = await call(
      "/organization/accept-invitation",
      { invitationId },
      cookieHeader(response),
    );
    expect(accepted.status).toBe(200);
    expect(await db.select().from(workspaceMember)).toHaveLength(2);
  });
});

describe("sessions", () => {
  it("sets an HttpOnly SameSite=Lax session cookie", async () => {
    const cookie = sessionCookie(await signUp("first@example.com"));

    expect(cookie).toMatch(/^curved\.session_token=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
  });

  it("reads the session from the cookie", async () => {
    const cookie = cookieHeader(await signUp("first@example.com"));

    const session = await auth.api.getSession({ headers: new Headers({ cookie }) });

    expect(session?.user.email).toBe("first@example.com");
  });
});

describe("workspaces", () => {
  it("lets the instance admin create a workspace with UUIDv7 IDs and owner role", async () => {
    const admin = cookieHeader(await signUp("first@example.com"));

    const response = await call("/organization/create", { name: "Acme", slug: "acme" }, admin);

    expect(response.status).toBe(200);
    const [row] = await db.select().from(workspace).where(eq(workspace.slug, "acme"));
    expect(row?.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7/);
    const members = await db
      .select()
      .from(workspaceMember)
      .where(eq(workspaceMember.workspaceId, row?.id ?? ""));
    expect(members).toMatchObject([{ role: "owner" }]);
  });

  it("does not let other users create a workspace", async () => {
    auth = makeAuth(true);
    await signUp("first@example.com");
    const other = cookieHeader(await signUp("second@example.com"));

    const response = await call("/organization/create", { name: "Mine", slug: "mine" }, other);

    expect(response.status).toBe(403);
  });

  it("rejects a slug that is not lowercase ASCII", async () => {
    const admin = cookieHeader(await signUp("first@example.com"));

    const response = await call("/organization/create", { name: "ทีม", slug: "ทีม" }, admin);

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: "INVALID_WORKSPACE_SLUG" });
  });
});
