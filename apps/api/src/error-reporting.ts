import type * as SentryModule from "@sentry/node";

import { env } from "./env";
import { logger } from "./logger";

let sentry: typeof SentryModule | undefined;

/**
 * Turns on the Sentry SDK when `SENTRY_DSN` is set. Without it, the SDK is not
 * even loaded. Only errors are sent: no tracing and no personal data.
 */
export async function initErrorReporting() {
  if (!env.SENTRY_DSN) {
    return;
  }
  sentry = await import("@sentry/node");
  sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.SENTRY_ENVIRONMENT ?? env.NODE_ENV,
    // Send the error and its stack trace, but no user data: Sentry collects
    // cookies, headers, bodies and query data by default.
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      databaseQueryData: false,
      queues: false,
      stackFrameVariables: false,
      graphQL: { document: false, variables: false },
      genAI: { inputs: false, outputs: false },
      mcp: { inputs: false, outputs: false },
    },
  });
  logger.info("error reporting enabled");
}

export function reportError(error: unknown) {
  sentry?.captureException(error);
}

/** Sends queued errors before the process exits. */
export async function flushErrorReporting() {
  await sentry?.flush(2000);
}
