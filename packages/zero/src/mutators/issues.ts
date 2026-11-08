import { issueStatuses } from "@curved/db/constants";
import { defineMutator } from "@rocicorp/zero";
import { z } from "zod";

export const createIssueArgs = z.object({
  id: z.uuid(),
  workspaceId: z.uuid(),
  title: z.string().trim().min(1).max(255),
});

export const setIssueStatusArgs = z.object({
  id: z.uuid(),
  status: z.enum(issueStatuses),
});

export const issueMutators = {
  create: defineMutator(createIssueArgs, async ({ args: { id, workspaceId, title }, tx }) => {
    const now = Date.now();
    await tx.mutate.issue.insert({
      id,
      workspaceId,
      title,
      status: "todo",
      createdAt: now,
      updatedAt: now,
    });
  }),
  setStatus: defineMutator(setIssueStatusArgs, async ({ args: { id, status }, tx }) => {
    await tx.mutate.issue.update({ id, status, updatedAt: Date.now() });
  }),
};
