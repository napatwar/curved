import { relations } from "drizzle-orm";

import { comment } from "./comment";
import { issue } from "./issue";

// drizzle-zero turns these into Zero relationships.
export const issueRelations = relations(issue, ({ many }) => ({
  comments: many(comment),
}));

export const commentRelations = relations(comment, ({ one }) => ({
  issue: one(issue, { fields: [comment.issueId], references: [issue.id] }),
}));
