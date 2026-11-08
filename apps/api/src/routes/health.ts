import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { sql } from "drizzle-orm";

import { logger } from "../logger";
import { db } from "../zero/db-provider";

export const healthRoutes = new OpenAPIHono();

const databaseTimeoutMs = 3000;

async function checkDatabase() {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("database check timed out")), databaseTimeoutMs);
  });
  try {
    await Promise.race([db.execute(sql`select 1`), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

healthRoutes.openapi(
  createRoute({
    method: "get",
    path: "/api/health",
    responses: {
      200: {
        description: "The API is running and can reach the database",
        content: {
          "application/json": {
            schema: z.object({ status: z.literal("ok"), database: z.literal("ok") }),
          },
        },
      },
      503: {
        description: "The API cannot reach the database",
        content: {
          "application/json": {
            schema: z.object({ status: z.literal("error"), database: z.literal("unreachable") }),
          },
        },
      },
    },
  }),
  async (c) => {
    try {
      await checkDatabase();
      return c.json({ status: "ok" as const, database: "ok" as const }, 200);
    } catch (error) {
      logger.warn("health check failed", { err: error });
      return c.json({ status: "error" as const, database: "unreachable" as const }, 503);
    }
  },
);
