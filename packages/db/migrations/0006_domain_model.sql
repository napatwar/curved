-- The MVP domain model (decision record 0006): teams, workflow states,
-- labels, descriptions, key aliases, and the new issue and comment columns.
-- drizzle-kit generated the DDL. These parts were edited by hand:
-- - New NOT NULL columns on "issue" are added as nullable, filled from the
--   existing rows, then made NOT NULL.
-- - "team"."default_state_id" is DEFERRABLE INITIALLY DEFERRED, which Drizzle
--   cannot express, so a team and its states can be inserted in one transaction.
-- - Every workspace gets its first team with the default states, and existing
--   issues move into it.
-- - A trigger unassigns a member's issues when they leave or are removed.
-- "issue"."status" stays, nullable and unused, so open tabs with the previous
-- Zero schema keep working. A later release drops it.
CREATE TABLE "issue_description" (
	"issue_id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "issue_key_alias" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"issue_id" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "issue_label" (
	"workspace_id" uuid NOT NULL,
	"issue_id" uuid NOT NULL,
	"label_id" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "issue_label_issue_id_label_id_pk" PRIMARY KEY("issue_id","label_id")
);
--> statement-breakpoint
CREATE TABLE "label" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"team_id" uuid,
	"name" text NOT NULL,
	"color" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"next_issue_number" integer NOT NULL,
	"default_state_id" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "team_key_check" CHECK ("team"."key" ~ '^[A-Z][A-Z0-9]{0,6}$')
);
--> statement-breakpoint
CREATE TABLE "workflow_state" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"name" text NOT NULL,
	"color" text NOT NULL,
	"category" text NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "workflow_state_category_check" CHECK ("workflow_state"."category" in ('backlog', 'unstarted', 'started', 'completed', 'canceled'))
);
--> statement-breakpoint
ALTER TABLE "issue" DROP CONSTRAINT "issue_status_check";--> statement-breakpoint
ALTER TABLE "issue" ALTER COLUMN "status" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "comment" ADD COLUMN "author_id" uuid;--> statement-breakpoint
ALTER TABLE "comment" ADD COLUMN "edited_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "issue" ADD COLUMN "team_id" uuid;--> statement-breakpoint
ALTER TABLE "issue" ADD COLUMN "number" integer;--> statement-breakpoint
ALTER TABLE "issue" ADD COLUMN "state_id" uuid;--> statement-breakpoint
ALTER TABLE "issue" ADD COLUMN "priority" smallint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "issue" ADD COLUMN "assignee_id" uuid;--> statement-breakpoint
ALTER TABLE "issue" ADD COLUMN "creator_id" uuid;--> statement-breakpoint
ALTER TABLE "issue" ADD COLUMN "due_date" date;--> statement-breakpoint
ALTER TABLE "issue" ADD COLUMN "parent_id" uuid;--> statement-breakpoint
ALTER TABLE "issue" ADD COLUMN "sort_order" text COLLATE "C";--> statement-breakpoint
ALTER TABLE "issue" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "issue" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "issue_description" ADD CONSTRAINT "issue_description_issue_id_issue_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issue"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_key_alias" ADD CONSTRAINT "issue_key_alias_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_key_alias" ADD CONSTRAINT "issue_key_alias_issue_id_issue_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issue"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_label" ADD CONSTRAINT "issue_label_issue_id_issue_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issue"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_label" ADD CONSTRAINT "issue_label_label_id_label_id_fk" FOREIGN KEY ("label_id") REFERENCES "public"."label"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "label" ADD CONSTRAINT "label_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team" ADD CONSTRAINT "team_default_state_id_workflow_state_id_fk" FOREIGN KEY ("default_state_id") REFERENCES "public"."workflow_state"("id") ON DELETE no action ON UPDATE no action DEFERRABLE INITIALLY DEFERRED;--> statement-breakpoint
ALTER TABLE "workflow_state" ADD CONSTRAINT "workflow_state_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "issue_key_alias_team_number_idx" ON "issue_key_alias" USING btree ("team_id","number");--> statement-breakpoint
CREATE INDEX "issue_key_alias_issue_idx" ON "issue_key_alias" USING btree ("issue_id");--> statement-breakpoint
CREATE INDEX "issue_label_label_idx" ON "issue_label" USING btree ("label_id");--> statement-breakpoint
CREATE UNIQUE INDEX "label_workspace_name_idx" ON "label" USING btree ("workspace_id",lower("name")) WHERE "label"."team_id" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "label_team_name_idx" ON "label" USING btree ("team_id",lower("name")) WHERE "label"."team_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "team_workspace_key_idx" ON "team" USING btree ("workspace_id","key");--> statement-breakpoint
CREATE INDEX "workflow_state_team_position_idx" ON "workflow_state" USING btree ("team_id","position");--> statement-breakpoint
ALTER TABLE "comment" ADD CONSTRAINT "comment_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue" ADD CONSTRAINT "issue_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue" ADD CONSTRAINT "issue_state_id_workflow_state_id_fk" FOREIGN KEY ("state_id") REFERENCES "public"."workflow_state"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue" ADD CONSTRAINT "issue_assignee_id_user_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue" ADD CONSTRAINT "issue_creator_id_user_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue" ADD CONSTRAINT "issue_parent_id_issue_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."issue"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "comment_author_idx" ON "comment" USING btree ("author_id");--> statement-breakpoint
CREATE UNIQUE INDEX "issue_team_number_idx" ON "issue" USING btree ("team_id","number");--> statement-breakpoint
CREATE INDEX "issue_team_sort_order_idx" ON "issue" USING btree ("team_id","sort_order","id");--> statement-breakpoint
CREATE INDEX "issue_state_idx" ON "issue" USING btree ("state_id");--> statement-breakpoint
CREATE INDEX "issue_assignee_idx" ON "issue" USING btree ("assignee_id");--> statement-breakpoint
CREATE INDEX "issue_creator_idx" ON "issue" USING btree ("creator_id");--> statement-breakpoint
CREATE INDEX "issue_parent_idx" ON "issue" USING btree ("parent_id");--> statement-breakpoint
ALTER TABLE "issue" ADD CONSTRAINT "issue_number_check" CHECK ("issue"."number" > 0);--> statement-breakpoint
ALTER TABLE "issue" ADD CONSTRAINT "issue_priority_check" CHECK ("issue"."priority" between 0 and 4);--> statement-breakpoint
-- Issues whose workspace was deleted cannot be read by anyone, because every
-- query filters by membership, and they have no team to move into.
DELETE FROM "issue" WHERE "workspace_id" NOT IN (SELECT "id" FROM "workspace");--> statement-breakpoint
-- Every workspace gets its first team, keyed like teamKeyFromSlug() in
-- packages/db/src/constants.ts, with the default states from
-- defaultWorkflowStates. Todo is the default state for new issues.
WITH "new_team" AS (
	INSERT INTO "team" ("id", "workspace_id", "key", "name", "next_issue_number", "default_state_id", "created_at", "updated_at")
	SELECT uuidv7(), "workspace"."id",
		coalesce(nullif(left(regexp_replace(regexp_replace(upper("workspace"."slug"), '[^A-Z0-9]', '', 'g'), '^[0-9]+', ''), 3), ''), 'TEAM'),
		"workspace"."name", 1, uuidv7(), now(), now()
	FROM "workspace"
	RETURNING "id", "workspace_id", "default_state_id"
)
INSERT INTO "workflow_state" ("id", "workspace_id", "team_id", "name", "color", "category", "position", "created_at", "updated_at")
SELECT
	CASE WHEN "state"."category" = 'unstarted' THEN "new_team"."default_state_id" ELSE uuidv7() END,
	"new_team"."workspace_id", "new_team"."id", "state"."name", "state"."color", "state"."category", "state"."position", now(), now()
FROM "new_team"
CROSS JOIN (VALUES
	('Backlog', 'backlog', '#bec2c8', 0),
	('Todo', 'unstarted', '#e2e2e2', 1),
	('In Progress', 'started', '#f2c94c', 2),
	('Done', 'completed', '#5e6ad2', 3),
	('Canceled', 'canceled', '#95a2b3', 4)
) AS "state" ("name", "category", "color", "position");--> statement-breakpoint
SET CONSTRAINTS "team_default_state_id_workflow_state_id_fk" IMMEDIATE;--> statement-breakpoint
-- A fractional-indexing integer key for position n, in the package's default
-- form: "a0".."az", then "b00".."bzz", and so on. Keys sort in position order
-- under COLLATE "C".
CREATE FUNCTION pg_temp.curved_sort_key(n bigint) RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
	digits constant text := '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
	len int := 1;
	block numeric := 62;
	rest numeric := n;
	result text := '';
BEGIN
	WHILE rest >= block LOOP
		rest := rest - block;
		len := len + 1;
		block := block * 62;
	END LOOP;
	FOR i IN 1..len LOOP
		result := substr(digits, (rest % 62)::int + 1, 1) || result;
		rest := floor(rest / 62);
	END LOOP;
	RETURN chr(ascii('a') + len - 1) || result;
END
$$;--> statement-breakpoint
-- Existing issues move into their workspace's team, keep their status as a
-- state, are numbered in creation order, and keep the newest first.
UPDATE "issue" SET
	"team_id" = "numbered"."team_id",
	"state_id" = "numbered"."state_id",
	"number" = "numbered"."number",
	"sort_order" = pg_temp.curved_sort_key("numbered"."position")
FROM (
	SELECT "issue"."id", "team"."id" AS "team_id", "workflow_state"."id" AS "state_id",
		row_number() OVER (PARTITION BY "team"."id" ORDER BY "issue"."created_at", "issue"."id") AS "number",
		row_number() OVER (PARTITION BY "team"."id" ORDER BY "issue"."created_at" DESC, "issue"."id" DESC) - 1 AS "position"
	FROM "issue"
	JOIN "team" ON "team"."workspace_id" = "issue"."workspace_id"
	JOIN "workflow_state" ON "workflow_state"."team_id" = "team"."id"
		AND "workflow_state"."name" = CASE "issue"."status"
			WHEN 'in_progress' THEN 'In Progress'
			WHEN 'done' THEN 'Done'
			ELSE 'Todo'
		END
) AS "numbered"
WHERE "numbered"."id" = "issue"."id";--> statement-breakpoint
UPDATE "team" SET "next_issue_number" = coalesce(
	(SELECT max("issue"."number") FROM "issue" WHERE "issue"."team_id" = "team"."id"), 0
) + 1;--> statement-breakpoint
DROP FUNCTION pg_temp.curved_sort_key(bigint);--> statement-breakpoint
ALTER TABLE "issue" ALTER COLUMN "team_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "issue" ALTER COLUMN "number" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "issue" ALTER COLUMN "state_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "issue" ALTER COLUMN "sort_order" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "issue" ALTER COLUMN "priority" DROP DEFAULT;--> statement-breakpoint
-- Removing a member unassigns their issues in that workspace (decision record
-- 0006). A trigger covers every way a membership ends: removal by an admin,
-- leaving, and deleting the user or the workspace. Better Auth 1.7 runs no
-- hook when a member leaves.
CREATE FUNCTION "issue_unassign_removed_member"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
	UPDATE "issue" SET "assignee_id" = NULL, "updated_at" = now()
	WHERE "workspace_id" = OLD."workspace_id" AND "assignee_id" = OLD."user_id";
	RETURN NULL;
END
$$;--> statement-breakpoint
CREATE TRIGGER "workspace_member_unassign_issues" AFTER DELETE ON "workspace_member"
FOR EACH ROW EXECUTE FUNCTION "issue_unassign_removed_member"();
