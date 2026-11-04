CREATE TABLE "issue" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"title" text NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "issue_status_check" CHECK ("issue"."status" in ('todo', 'in_progress', 'done'))
);
--> statement-breakpoint
CREATE INDEX "issue_workspace_created_idx" ON "issue" USING btree ("workspace_id","created_at" DESC NULLS LAST,"id");