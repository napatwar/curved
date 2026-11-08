import type { Db } from "@curved/db";
import * as schema from "@curved/db/schema";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { admin, organization as organizationPlugin } from "better-auth/plugins";
import { v7 as uuidv7 } from "uuid";

import type { Mailer } from "./mailer";
import { roleForNewUser, type SignUpPolicy } from "./sign-up-policy";

export type OAuthCredentials = { clientId: string; clientSecret: string };

export type AuthOptions = SignUpPolicy & {
  db: Db;
  /** Better Auth uses a fixed development secret when this is unset. */
  secret: string | undefined;
  /** The public URL of the web app. Auth routes are served under /api/auth. */
  baseURL: string;
  /** Parent domain that shares the session cookie, such as `example.com`. */
  cookieDomain?: string | undefined;
  google?: OAuthCredentials | undefined;
  github?: OAuthCredentials | undefined;
  /** Without a mailer, email verification and password reset by email are off. */
  mailer?: Mailer | undefined;
};

// ASCII only, so slugs work in URLs and on every keyboard (decision record 0007).
const workspaceSlugPattern = /^[a-z0-9](?:[a-z0-9-]{0,46}[a-z0-9])?$/;

function assertWorkspaceSlug(slug: string | undefined) {
  if (slug !== undefined && !workspaceSlugPattern.test(slug)) {
    throw new APIError("BAD_REQUEST", {
      code: "INVALID_WORKSPACE_SLUG",
      message:
        "Use 1 to 48 lowercase letters, digits and hyphens, starting and ending with a letter or digit.",
    });
  }
}

/**
 * Better Auth with the options from decision record 0005: email and password,
 * database sessions in an HttpOnly SameSite=Lax cookie, optional Google and
 * GitHub sign-in, workspaces through the organization plugin, and the
 * instance admin through the admin plugin.
 */
export function createAuth(options: AuthOptions) {
  const { db, mailer } = options;

  return betterAuth({
    appName: "Curved",
    baseURL: options.baseURL,
    basePath: "/api/auth",
    secret: options.secret,
    trustedOrigins: [new URL(options.baseURL).origin],
    database: drizzleAdapter(db, { provider: "pg", schema }),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: Boolean(mailer),
      ...(mailer && {
        sendResetPassword: async ({ user, url }) => {
          await mailer.send({
            to: user.email,
            subject: "Reset your Curved password",
            text: `Open this link to choose a new password:\n\n${url}\n\nIf you did not ask for this, ignore this email.`,
          });
        },
      }),
    },
    ...(mailer && {
      emailVerification: {
        sendOnSignUp: true,
        autoSignInAfterVerification: true,
        sendVerificationEmail: async ({ user, url }) => {
          await mailer.send({
            to: user.email,
            subject: "Verify your email for Curved",
            text: `Open this link to verify your email:\n\n${url}`,
          });
        },
      },
    }),
    socialProviders: {
      ...(options.google && { google: options.google }),
      ...(options.github && { github: options.github }),
    },
    advanced: {
      cookiePrefix: "curved",
      defaultCookieAttributes: { httpOnly: true, sameSite: "lax" },
      ...(options.cookieDomain && {
        crossSubDomainCookies: { enabled: true, domain: options.cookieDomain },
      }),
      database: { generateId: () => uuidv7() },
    },
    databaseHooks: {
      user: {
        create: {
          before: async (user, context) => {
            const role = await roleForNewUser(db, options, user, context?.path);
            return { data: { ...user, role } };
          },
        },
      },
    },
    plugins: [
      admin(),
      organizationPlugin({
        // On a self-hosted instance, only an instance admin creates workspaces.
        allowUserToCreateOrganization: (user) => user.role === "admin",
        // Better Auth asks for a verified email before someone opens or
        // accepts an invitation when IDs come from a custom generator, as
        // ours do. Without SMTP no one can verify an email, so the invitation
        // link, which only the admin can copy, is the proof instead. With
        // SMTP, people verify their email at sign-up anyway.
        requireEmailVerificationOnInvitation: Boolean(mailer),
        organizationHooks: {
          beforeCreateOrganization: async ({ organization }) => {
            assertWorkspaceSlug(organization.slug);
          },
          beforeUpdateOrganization: async ({ organization }) => {
            assertWorkspaceSlug(organization.slug);
          },
        },
        ...(mailer && {
          sendInvitationEmail: async ({ email, id, organization, inviter }) => {
            await mailer.send({
              to: email,
              subject: `Join ${organization.name} on Curved`,
              text: `${inviter.user.name} invited you to ${organization.name}.\n\n${options.baseURL}/invitations/${id}`,
            });
          },
        }),
        schema: {
          organization: { modelName: "workspace" },
          member: { modelName: "workspaceMember", fields: { organizationId: "workspaceId" } },
          invitation: {
            modelName: "workspaceInvitation",
            fields: { organizationId: "workspaceId" },
          },
          session: { fields: { activeOrganizationId: "activeWorkspaceId" } },
        },
      }),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;
