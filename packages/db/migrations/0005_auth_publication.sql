-- Clients need workspaces, memberships and the names of people they share a
-- workspace with. Column lists keep every other column, such as the admin
-- plugin's ban fields, out of zero-cache. Never add `account`, `session`,
-- `verification` or `workspace_invitation` (decision record 0005).
ALTER PUBLICATION zero_curved ADD TABLE "workspace" ("id", "name", "slug", "logo");--> statement-breakpoint
ALTER PUBLICATION zero_curved ADD TABLE "workspace_member" ("id", "workspace_id", "user_id", "role");--> statement-breakpoint
ALTER PUBLICATION zero_curved ADD TABLE "user" ("id", "name", "email", "image");
