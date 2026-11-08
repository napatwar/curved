import { z } from "zod";

import { logger, logLevels } from "./logger";

const isProduction = process.env.NODE_ENV === "production";

// Values from .env.example and the development docker-compose.yml, plus common
// placeholders. Production refuses them.
const developmentValues = new Set([
  "pass",
  "password",
  "dev-only",
  "postgres",
  "changeme",
  "secret",
]);

const minimumSecretLength = 32;

/** Treats an empty variable, such as `SENTRY_DSN=`, as unset. */
function optional<T extends z.ZodType>(schema: T) {
  return z.preprocess((value) => (value === "" ? undefined : value), schema.optional());
}

/**
 * A secret is optional in development. In production it must be set, at least
 * 32 characters long, and not a development value.
 */
function secret() {
  if (!isProduction) {
    return optional(z.string());
  }
  return z
    .string({ error: "is required in production" })
    .min(minimumSecretLength, `must be at least ${minimumSecretLength} characters in production`)
    .refine((value) => !developmentValues.has(value.toLowerCase()), {
      error: "is a development value; generate one with `openssl rand -hex 32`",
    });
}

const databaseUrl = z.url().refine(
  (value) => {
    if (!isProduction) {
      return true;
    }
    const password = decodeURIComponent(new URL(value).password);
    return password.length >= 16 && !developmentValues.has(password.toLowerCase());
  },
  { error: "must contain a strong password in production (16 or more characters)" },
);

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  DATABASE_URL: databaseUrl,
  API_PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.enum(logLevels).default("info"),
  /** The web app's build output. The image sets it, so the API serves the web app. */
  WEB_DIST_DIR: optional(z.string()),
  /** Error tracking is off unless this is set. Works with Sentry, GlitchTip or Bugsink. */
  SENTRY_DSN: optional(z.url()),
  SENTRY_ENVIRONMENT: optional(z.string()),
  /** Signs session cookies (ADR 0005). */
  BETTER_AUTH_SECRET: secret(),
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
  logger.error("invalid environment variables", { issues: z.prettifyError(result.error) });
  process.exit(1);
}

export const env = result.data;
