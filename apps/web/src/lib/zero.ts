import { mutators, schema } from "@curved/zero";
import type { ZeroOptions } from "@rocicorp/zero";

/**
 * zero-cache authenticates the user with the session cookie that it forwards
 * to the API, so Zero needs no token. `userID` gives each user their own local
 * storage, and `context` lets client mutators and queries run as the server
 * runs them.
 */
export function createZeroOptions(userID: string): ZeroOptions {
  return {
    cacheURL: import.meta.env.VITE_ZERO_CACHE_URL,
    schema,
    mutators,
    userID,
    context: { userID },
  };
}
