-- Deleting a workspace deletes its tenant data. Tenant tables have no foreign
-- key to "workspace", so they can move into cells later (decision record
-- 0005), and nothing cascades on its own. Like the trigger on
-- "workspace_member" in migration 0006, a trigger covers every way a
-- workspace is deleted and runs in the same transaction as the delete.
-- Order matters: "issue"."state_id" and "issue"."team_id" have no cascade,
-- so issues go first. Their comments, descriptions, labels on issues and key
-- aliases cascade. Deleting a team cascades to its states and team labels.
CREATE FUNCTION "workspace_delete_tenant_data"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
	DELETE FROM "issue" WHERE "workspace_id" = OLD."id";
	DELETE FROM "label" WHERE "workspace_id" = OLD."id";
	DELETE FROM "team" WHERE "workspace_id" = OLD."id";
	RETURN NULL;
END
$$;--> statement-breakpoint
CREATE TRIGGER "workspace_delete_tenant_data" AFTER DELETE ON "workspace"
FOR EACH ROW EXECUTE FUNCTION "workspace_delete_tenant_data"();--> statement-breakpoint
-- Workspaces deleted since migration 0006 left their tenant data behind.
DELETE FROM "issue" WHERE "workspace_id" NOT IN (SELECT "id" FROM "workspace");--> statement-breakpoint
DELETE FROM "label" WHERE "workspace_id" NOT IN (SELECT "id" FROM "workspace");--> statement-breakpoint
DELETE FROM "team" WHERE "workspace_id" NOT IN (SELECT "id" FROM "workspace");
