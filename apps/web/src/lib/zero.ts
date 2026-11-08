import { mutators, schema } from "@curved/zero";
import type { ZeroOptions } from "@rocicorp/zero";

export const zeroOptions: ZeroOptions = {
  // Production serves zero-cache at /zero on the app's own origin, so one
  // build works on any domain (ADR 0008). Development sets
  // VITE_ZERO_CACHE_URL to the zero-cache container instead.
  cacheURL: import.meta.env.VITE_ZERO_CACHE_URL || `${location.origin}/zero`,
  schema,
  mutators,
};
