import { sql } from "drizzle-orm";
import { check, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import type { IssueStatus } from "../constants";

// Zero mutators write these columns, so only `id` has a database default.
// A default on the other columns would make them optional in the Zero schema.
export const issue = pgTable(
  "issue",
  {
    id: uuid()
      .primaryKey()
      .default(sql`uuidv7()`),
    workspaceId: uuid("workspace_id").notNull(),
    title: text().notNull(),
    status: text().$type<IssueStatus>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    index("issue_workspace_created_idx").on(table.workspaceId, table.createdAt.desc(), table.id),
    check("issue_status_check", sql`${table.status} in ('todo', 'in_progress', 'done')`),
  ],
);
