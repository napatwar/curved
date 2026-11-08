import { defineQuery } from "@rocicorp/zero";
import { z } from "zod";

import { whereMember } from "../auth";
import { zql } from "../schema.gen";

const workspaceArgs = z.object({ workspaceId: z.uuid() });

export const teamQueries = {
  /** A workspace's teams, each with its workflow states in order. */
  byWorkspace: defineQuery(workspaceArgs, ({ args: { workspaceId }, ctx }) =>
    whereMember(zql.team.where("workspaceId", workspaceId), ctx)
      .related("states", (states) => states.orderBy("position", "asc").orderBy("id", "asc"))
      .orderBy("name", "asc")
      .orderBy("id", "asc"),
  ),
};

export const labelQueries = {
  /** Workspace labels and every team's labels. */
  byWorkspace: defineQuery(workspaceArgs, ({ args: { workspaceId }, ctx }) =>
    whereMember(zql.label.where("workspaceId", workspaceId), ctx)
      .orderBy("name", "asc")
      .orderBy("id", "asc"),
  ),
};
