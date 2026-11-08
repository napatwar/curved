import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";

export const healthRoutes = new OpenAPIHono();

healthRoutes.openapi(
  createRoute({
    method: "get",
    path: "/health",
    responses: {
      200: {
        description: "The API is running",
        content: {
          "application/json": {
            schema: z.object({ status: z.literal("ok") }),
          },
        },
      },
    },
  }),
  (c) => c.json({ status: "ok" as const }),
);
