import { z } from "zod";

const optional = z.string().trim().min(1).optional();

const envSchema = z
  .object({
    DATABASE_URL: z.url(),
    API_PORT: z.coerce.number().int().positive().default(3000),
    // Better Auth (decision record 0005).
    BETTER_AUTH_SECRET: z.string().min(32),
    // The public URL of the web app. Auth routes are served under /api/auth.
    BETTER_AUTH_URL: z.url(),
    // Lets anyone sign up. Otherwise only the first user, who becomes the
    // instance admin, and people with a pending invitation can.
    AUTH_OPEN_SIGN_UP: z.stringbool().default(false),
    // Shares the session cookie with subdomains, such as `example.com` for
    // `app.example.com` and `sync.example.com`. Leave it unset on one origin.
    AUTH_COOKIE_DOMAIN: optional,
    GOOGLE_CLIENT_ID: optional,
    GOOGLE_CLIENT_SECRET: optional,
    GITHUB_CLIENT_ID: optional,
    GITHUB_CLIENT_SECRET: optional,
    // Turns on email verification and password reset by email.
    SMTP_URL: z.url().optional(),
    SMTP_FROM: optional,
  })
  .refine((env) => Boolean(env.GOOGLE_CLIENT_ID) === Boolean(env.GOOGLE_CLIENT_SECRET), {
    message: "Set both GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET, or neither",
  })
  .refine((env) => Boolean(env.GITHUB_CLIENT_ID) === Boolean(env.GITHUB_CLIENT_SECRET), {
    message: "Set both GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET, or neither",
  })
  .refine((env) => !env.SMTP_URL || env.SMTP_FROM, {
    message: "SMTP_FROM is required when SMTP_URL is set",
  });

export const env = envSchema.parse(process.env);
