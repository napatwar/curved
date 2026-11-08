import { OpenAPIHono } from "@hono/zod-openapi";

import { healthRoutes } from "./routes/health";
import { zeroEndpoints } from "./zero/endpoints";

export const app = new OpenAPIHono();

app.route("/", healthRoutes);
app.route("/api/zero", zeroEndpoints);

app.doc31("/openapi.json", {
  openapi: "3.1.0",
  info: { title: "Curved API", version: "0.0.0" },
});
