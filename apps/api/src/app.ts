import { OpenAPIHono } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";

import { auth } from "./auth/auth";
import { db } from "./db";
import { env } from "./env";
import { reportError } from "./error-reporting";
import { logger, requestLogger } from "./logger";
import { createAuthConfigRoutes } from "./routes/auth-config";
import { healthRoutes } from "./routes/health";
import { webApp } from "./web-app";
import { createDbProvider } from "./zero/db-provider";
import { createZeroEndpoints } from "./zero/endpoints";

export const app = new OpenAPIHono();

app.use(requestLogger);

app.onError((error, c) => {
  if (error instanceof HTTPException) {
    return error.getResponse();
  }
  logger.error("unhandled error", { err: error, method: c.req.method, path: c.req.path });
  reportError(error);
  return c.json({ error: { code: "internal_error", message: "Internal server error" } }, 500);
});

app.route("/", healthRoutes);
app.route(
  "/",
  createAuthConfigRoutes({
    providers: [
      ...(env.GOOGLE_CLIENT_ID ? (["google"] as const) : []),
      ...(env.GITHUB_CLIENT_ID ? (["github"] as const) : []),
    ],
  }),
);
app.on(["GET", "POST"], "/api/auth/*", (c) => auth.handler(c.req.raw));
app.route(
  "/api/zero",
  createZeroEndpoints({
    dbProvider: createDbProvider(db),
    getUserID: async (headers) => (await auth.api.getSession({ headers }))?.user.id ?? null,
  }),
);

app.doc31("/openapi.json", {
  openapi: "3.1.0",
  info: { title: "Curved API", version: "0.0.0" },
});

// Keep this last: it answers every path that no route above handled.
if (env.WEB_DIST_DIR) {
  app.route("/", webApp(env.WEB_DIST_DIR));
}
