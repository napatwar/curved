import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  check,
  date,
  index,
  integer,
  pgTable,
  smallint,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { user } from "./auth";
import { sortKey, timestamptz } from "./columns";
import { team, workflowState } from "./team";

// Issues (decision record 0006). Zero mutators write every column, so only `id`
// has a database default. A default on the other columns would make them
// optional in the Zero schema.
export const issue = pgTable(
  "issue",
  {
    id: uuid()
      .primaryKey()
      .default(sql`uuidv7()`),
    workspaceId: uuid("workspace_id").notNull(),
    teamId: uuid("team_id")
      .notNull()
      .references(() => team.id),
    // 0 only on the client while the server has not assigned the number; the
    // check keeps it out of Postgres.
    number: integer().notNull(),
    title: text().notNull(),
    // Replaced by `state_id`. Nothing reads or writes it any more, and Zero
    // does not sync it. Drop it in a later release, once no open tab runs a
    // Zero schema that has it (docs/conventions.md, expand then contract).
    status: text(),
    stateId: uuid("state_id")
      .notNull()
      .references(() => workflowState.id),
    priority: smallint().notNull(),
    assigneeId: uuid("assignee_id").references(() => user.id, { onDelete: "set null" }),
    creatorId: uuid("creator_id").references(() => user.id, { onDelete: "set null" }),
    // A calendar date with no time zone. Zero exposes it as milliseconds at
    // UTC midnight.
    dueDate: date("due_date"),
    parentId: uuid("parent_id").references((): AnyPgColumn => issue.id, { onDelete: "set null" }),
    sortOrder: sortKey("sort_order").notNull(),
    archivedAt: timestamptz("archived_at"),
    deletedAt: timestamptz("deleted_at"),
    createdAt: timestamptz("created_at").notNull(),
    updatedAt: timestamptz("updated_at").notNull(),
  },
  (table) => [
    index("issue_workspace_created_idx").on(table.workspaceId, table.createdAt.desc(), table.id),
    uniqueIndex("issue_team_number_idx").on(table.teamId, table.number),
    // The server reads a team's lowest key through this index to put a new
    // issue first.
    index("issue_team_sort_order_idx").on(table.teamId, table.sortOrder, table.id),
    index("issue_state_idx").on(table.stateId),
    index("issue_assignee_idx").on(table.assigneeId),
    index("issue_creator_idx").on(table.creatorId),
    index("issue_parent_idx").on(table.parentId),
    check("issue_number_check", sql`${table.number} > 0`),
    check("issue_priority_check", sql`${table.priority} between 0 and 4`),
  ],
);

/**
 * An issue's Markdown description. It has its own table because Zero syncs
 * whole rows, and only the issue page needs it. A 1:1 table keyed by
 * `issue_id`, one of the exceptions to UUIDv7 `id` keys in docs/conventions.md.
 */
export const issueDescription = pgTable("issue_description", {
  issueId: uuid("issue_id")
    .primaryKey()
    .references(() => issue.id, { onDelete: "cascade" }),
  workspaceId: uuid("workspace_id").notNull(),
  body: text().notNull(),
  createdAt: timestamptz("created_at").notNull(),
  updatedAt: timestamptz("updated_at").notNull(),
});

/** A key an issue had before it moved to another team, so old links still open. */
export const issueKeyAlias = pgTable(
  "issue_key_alias",
  {
    id: uuid().primaryKey(),
    workspaceId: uuid("workspace_id").notNull(),
    teamId: uuid("team_id")
      .notNull()
      .references(() => team.id, { onDelete: "cascade" }),
    number: integer().notNull(),
    issueId: uuid("issue_id")
      .notNull()
      .references(() => issue.id, { onDelete: "cascade" }),
    createdAt: timestamptz("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("issue_key_alias_team_number_idx").on(table.teamId, table.number),
    index("issue_key_alias_issue_idx").on(table.issueId),
  ],
);
