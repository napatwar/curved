import { isNotNull, isNull, sql } from "drizzle-orm";
import { index, pgTable, primaryKey, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { timestamptz } from "./columns";
import { issue } from "./issue";
import { team } from "./team";

// Labels (decision record 0006). A null `team_id` makes a workspace label, and
// a value makes a team label. Names are unique within that scope, ignoring
// case.
export const label = pgTable(
  "label",
  {
    id: uuid().primaryKey(),
    workspaceId: uuid("workspace_id").notNull(),
    teamId: uuid("team_id").references(() => team.id, { onDelete: "cascade" }),
    name: text().notNull(),
    color: text().notNull(),
    createdAt: timestamptz("created_at").notNull(),
    updatedAt: timestamptz("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("label_workspace_name_idx")
      .on(table.workspaceId, sql`lower(${table.name})`)
      .where(isNull(table.teamId)),
    uniqueIndex("label_team_name_idx")
      .on(table.teamId, sql`lower(${table.name})`)
      .where(isNotNull(table.teamId)),
  ],
);

/**
 * Labels on an issue. A junction table keyed by `(issue_id, label_id)`, one of
 * the exceptions to UUIDv7 `id` keys in docs/conventions.md. Two clients that
 * add the same label make an idempotent upsert instead of a conflict.
 */
export const issueLabel = pgTable(
  "issue_label",
  {
    workspaceId: uuid("workspace_id").notNull(),
    issueId: uuid("issue_id")
      .notNull()
      .references(() => issue.id, { onDelete: "cascade" }),
    labelId: uuid("label_id")
      .notNull()
      .references(() => label.id, { onDelete: "cascade" }),
    createdAt: timestamptz("created_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.issueId, table.labelId] }),
    index("issue_label_label_idx").on(table.labelId),
  ],
);
