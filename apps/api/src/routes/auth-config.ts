import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";

export type AuthConfig = { providers: ("google" | "github")[] };

const authConfigSchema = z.object({ providers: z.array(z.enum(["google", "github"])) });

/** Tells the sign-in screen which OAuth providers this deployment turned on. */
export function createAuthConfigRoutes(config: AuthConfig) {
  const routes = new OpenAPIHono();
  routes.openapi(
    createRoute({
      method: "get",
      path: "/api/auth-config",
      responses: {
        200: {
          description: "Sign-in options for this deployment",
          content: { "application/json": { schema: authConfigSchema } },
        },
      },
    }),
    (c) => c.json(config),
  );
  return routes;
}
