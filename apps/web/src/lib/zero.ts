import { mutators, schema } from "@curved/zero";
import type { ZeroOptions } from "@rocicorp/zero";

export const zeroOptions: ZeroOptions = {
  cacheURL: import.meta.env.VITE_ZERO_CACHE_URL,
  schema,
  mutators,
};
