import { customType, timestamp } from "drizzle-orm/pg-core";

/** A `timestamptz` column. Zero exposes it as milliseconds since the epoch. */
export const timestamptz = (name: string) => timestamp(name, { withTimezone: true });

/**
 * A fractional index for manual ordering, from the `fractional-indexing`
 * package. `COLLATE "C"` compares bytes, as the SQLite replica and JavaScript
 * do. Postgres's default collations, such as `en_US`, order letter case
 * differently, so the server and client would disagree (decision record 0006).
 *
 * drizzle-zero cannot map a custom type, so packages/zero/drizzle-zero.config.ts
 * declares these columns as strings.
 */
export const sortKey = customType<{ data: string }>({
  dataType: () => 'text COLLATE "C"',
});
