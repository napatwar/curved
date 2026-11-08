import type { MiddlewareHandler } from "hono";

export const logLevels = ["debug", "info", "warn", "error"] as const;

export type LogLevel = (typeof logLevels)[number];

type Fields = Record<string, unknown>;

// Read directly, not from env.ts, so env.ts can log its own validation errors.
// env.ts still rejects an unknown LOG_LEVEL at startup.
const configuredLevel = logLevels.find((level) => level === process.env.LOG_LEVEL) ?? "info";
const minimum = logLevels.indexOf(configuredLevel);

function serialize(_key: string, value: unknown) {
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack, cause: value.cause };
  }
  return value;
}

function write(level: LogLevel, msg: string, fields?: Fields) {
  if (logLevels.indexOf(level) < minimum) {
    return;
  }
  const line = JSON.stringify({ time: new Date().toISOString(), level, msg, ...fields }, serialize);
  process.stdout.write(`${line}\n`);
}

/** Writes one JSON object per line to stdout, as ADR 0008 asks. */
export const logger = {
  debug: (msg: string, fields?: Fields) => write("debug", msg, fields),
  info: (msg: string, fields?: Fields) => write("info", msg, fields),
  warn: (msg: string, fields?: Fields) => write("warn", msg, fields),
  error: (msg: string, fields?: Fields) => write("error", msg, fields),
};

/**
 * Logs each request. API requests log at `info`. Health checks and web app
 * files log at `debug`, so Docker health checks and page loads do not flood
 * the logs. `hasCookie` shows whether zero-cache forwarded the browser's
 * cookies, without logging their values.
 */
export const requestLogger: MiddlewareHandler = async (c, next) => {
  const start = performance.now();
  await next();
  const path = c.req.path;
  const status = c.res.status;
  const isApi = path.startsWith("/api/") && path !== "/api/health";
  const level: LogLevel = status >= 500 ? "error" : isApi ? "info" : "debug";
  write(level, "request", {
    method: c.req.method,
    path,
    status,
    durationMs: Math.round(performance.now() - start),
    hasCookie: c.req.header("cookie") !== undefined,
  });
};
