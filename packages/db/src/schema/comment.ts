import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { issue } from "./issue";

// Zero mutators write every column, including the UUIDv7 `id`, so no column
// has a database default. A default would make the column optional in the
// Zero schema.
export const comment = pgTable(
  "comment",
  {
    id: uuid().primaryKey(),
    workspaceId: uuid("workspace_id").notNull(),
    issueId: uuid("issue_id")
      .notNull()
      .references(() => issue.id, { onDelete: "cascade" }),
    body: text().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => [index("comment_issue_created_idx").on(table.issueId, table.createdAt, table.id)],
);
