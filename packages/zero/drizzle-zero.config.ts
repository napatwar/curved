import * as drizzleSchema from "@curved/db/schema";
import { string } from "@rocicorp/zero";
import { drizzleZeroConfig } from "drizzle-zero";

// Fractional indexes are `text COLLATE "C"`, a custom Drizzle type that
// drizzle-zero cannot map, so they are declared here.
const sortKey = (serverName: string) => string().from(serverName);

// Lists every table and column that clients may see. Keep it within the
// `zero_curved` publication in packages/db/migrations: zero-cache never
// receives other columns, and Better Auth's secrets (`account`, `session`,
// `verification`) and invitations never sync (decision record 0005).
export default drizzleZeroConfig(drizzleSchema, {
  tables: {
    account: false,
    comment: true,
    // Every column except `status`, which `state_id` replaced. It stays in
    // Postgres and the publication until a later release drops it.
    issue: {
      id: true,
      workspaceId: true,
      teamId: true,
      number: true,
      title: true,
      stateId: true,
      priority: true,
      assigneeId: true,
      creatorId: true,
      dueDate: true,
      parentId: true,
      sortOrder: sortKey("sort_order"),
      archivedAt: true,
      deletedAt: true,
      createdAt: true,
      updatedAt: true,
    },
    issueDescription: true,
    issueKeyAlias: true,
    issueLabel: true,
    label: true,
    session: false,
    team: true,
    user: { id: true, name: true, email: true, image: true },
    verification: false,
    workflowState: true,
    workspace: { id: true, name: true, slug: true, logo: true },
    workspaceInvitation: false,
    workspaceMember: { id: true, workspaceId: true, userId: true, role: true },
  },
  manyToMany: {
    issue: { labels: ["issueLabel", "label"] },
    label: { issues: ["issueLabel", "issue"] },
  },
});
