import { index, pgTable, text, uuid } from "drizzle-orm/pg-core";

import { user } from "./auth";
import { timestamptz } from "./columns";
import { issue } from "./issue";

// Zero mutators write every column, including the UUIDv7 `id`, so no column
// has a database default. A default would make the column optional in the
// Zero schema. `body` is Markdown (decision record 0006).
export const comment = pgTable(
  "comment",
  {
    id: uuid().primaryKey(),
    workspaceId: uuid("workspace_id").notNull(),
    issueId: uuid("issue_id")
      .notNull()
      .references(() => issue.id, { onDelete: "cascade" }),
    // Null for comments from the spike, and after the author's account is deleted.
    authorId: uuid("author_id").references(() => user.id, { onDelete: "set null" }),
    body: text().notNull(),
    // Set when the author edits the comment, so the UI can show it as edited.
    editedAt: timestamptz("edited_at"),
    createdAt: timestamptz("created_at").notNull(),
    updatedAt: timestamptz("updated_at").notNull(),
  },
  (table) => [
    index("comment_issue_created_idx").on(table.issueId, table.createdAt, table.id),
    index("comment_author_idx").on(table.authorId),
  ],
);
