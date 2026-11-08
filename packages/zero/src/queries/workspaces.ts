import { defineQuery } from "@rocicorp/zero";
import { z } from "zod";

import { memberWorkspaces, visibleUsers, whereMember } from "../auth";
import { zql } from "../schema.gen";

export const workspaceQueries = {
  /** Workspaces where the signed-in user is a member, for the workspace picker. */
  mine: defineQuery(({ ctx }) => memberWorkspaces(ctx).orderBy("name", "asc").orderBy("id", "asc")),
};

export const workspaceMemberQueries = {
  byWorkspace: defineQuery(z.object({ workspaceId: z.uuid() }), ({ args: { workspaceId }, ctx }) =>
    whereMember(zql.workspaceMember.where("workspaceId", workspaceId), ctx)
      .related("user")
      .orderBy("id", "asc"),
  ),
};

export const userQueries = {
  /** People who share a workspace with the signed-in user. */
  visible: defineQuery(({ ctx }) => visibleUsers(ctx).orderBy("name", "asc").orderBy("id", "asc")),
};
