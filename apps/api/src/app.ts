import { OpenAPIHono } from "@hono/zod-openapi";

import { auth } from "./auth/auth";
import { db } from "./db";
import { env } from "./env";
import { createAuthConfigRoutes } from "./routes/auth-config";
import { healthRoutes } from "./routes/health";
import { createDbProvider } from "./zero/db-provider";
import { createZeroEndpoints } from "./zero/endpoints";

export const app = new OpenAPIHono();

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
