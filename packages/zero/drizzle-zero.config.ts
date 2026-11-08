import * as drizzleSchema from "@curved/db/schema";
import { drizzleZeroConfig } from "drizzle-zero";

// Lists every table and column that clients may see. Keep it equal to the
// `zero_curved` publication in packages/db/migrations: zero-cache never
// receives other columns, and Better Auth's secrets (`account`, `session`,
// `verification`) and invitations never sync (decision record 0005).
export default drizzleZeroConfig(drizzleSchema, {
  tables: {
    account: false,
    comment: true,
    issue: true,
    session: false,
    user: { id: true, name: true, email: true, image: true },
    verification: false,
    workspace: { id: true, name: true, slug: true, logo: true },
    workspaceInvitation: false,
    workspaceMember: { id: true, workspaceId: true, userId: true, role: true },
  },
});
