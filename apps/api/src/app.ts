import { OpenAPIHono } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";

import { env } from "./env";
import { reportError } from "./error-reporting";
import { logger, requestLogger } from "./logger";
import { healthRoutes } from "./routes/health";
import { webApp } from "./web-app";
import { zeroEndpoints } from "./zero/endpoints";

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
app.route("/api/zero", zeroEndpoints);

app.doc31("/openapi.json", {
  openapi: "3.1.0",
  info: { title: "Curved API", version: "0.0.0" },
});

// Keep this last: it answers every path that no route above handled.
if (env.WEB_DIST_DIR) {
  app.route("/", webApp(env.WEB_DIST_DIR));
}
