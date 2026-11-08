import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.url(),
  API_PORT: z.coerce.number().int().positive().default(3000),
});

export const env = envSchema.parse(process.env);
