import { serve } from "@hono/node-server";

import { app } from "./app";
import { env } from "./env";
import { flushErrorReporting, initErrorReporting } from "./error-reporting";
import { logger } from "./logger";
import { db } from "./zero/db-provider";

// Docker waits 20 seconds (stop_grace_period) before it kills the container.
const shutdownTimeoutMs = 10_000;

await initErrorReporting();

const server = serve({ fetch: app.fetch, port: env.API_PORT }, (info) => {
  logger.info("API listening", { port: info.port });
});

let shuttingDown = false;

/**
 * Stops accepting connections, lets in-flight requests finish, then closes
 * the database pool. Connections still open after the timeout are cut.
 */
async function shutdown(signal: NodeJS.Signals) {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  logger.info("shutting down", { signal });

  const force = setTimeout(() => {
    logger.warn("closing connections that are still open");
    if ("closeAllConnections" in server) {
      server.closeAllConnections();
    }
  }, shutdownTimeoutMs);
  force.unref();

  await new Promise<void>((resolve) => {
    server.close(() => resolve());
  });
  await db.$client.end();
  await flushErrorReporting();
  logger.info("shut down");
  process.exit(0);
}

for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, (received) => void shutdown(received));
}
