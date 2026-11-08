import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import type { WorkflowStateCategory } from "../constants";

// Teams and workflow states (decision record 0006). Zero mutators write every
// column, so no column has a database default.

export const team = pgTable(
  "team",
  {
    id: uuid().primaryKey(),
    workspaceId: uuid("workspace_id").notNull(),
    key: text().notNull(),
    name: text().notNull(),
    // The number the team's next issue gets. Only the server mutator changes
    // it, with `UPDATE ... RETURNING` inside the mutation's transaction.
    nextIssueNumber: integer("next_issue_number").notNull(),
    // The migration makes this foreign key DEFERRABLE INITIALLY DEFERRED, so a
    // mutator can insert a team before its states in one transaction. Drizzle
    // cannot express that, so change it only in SQL.
    defaultStateId: uuid("default_state_id")
      .notNull()
      .references((): AnyPgColumn => workflowState.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    uniqueIndex("team_workspace_key_idx").on(table.workspaceId, table.key),
    check("team_key_check", sql`${table.key} ~ '^[A-Z][A-Z0-9]{0,6}$'`),
  ],
);

export const workflowState = pgTable(
  "workflow_state",
  {
    id: uuid().primaryKey(),
    workspaceId: uuid("workspace_id").notNull(),
    teamId: uuid("team_id")
      .notNull()
      .references((): AnyPgColumn => team.id, { onDelete: "cascade" }),
    name: text().notNull(),
    color: text().notNull(),
    category: text().$type<WorkflowStateCategory>().notNull(),
    position: integer().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    index("workflow_state_team_position_idx").on(table.teamId, table.position),
    check(
      "workflow_state_category_check",
      sql`${table.category} in ('backlog', 'unstarted', 'started', 'completed', 'canceled')`,
    ),
  ],
);
