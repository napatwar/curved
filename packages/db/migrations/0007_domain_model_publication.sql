-- Clients need every new table of the domain model (decision record 0006).
-- Like "issue" and "comment", these tenant tables have no column list: every
-- column is meant for the workspace's members, and the membership filter
-- limits the rows. Column lists stay for Better Auth's tables (migration 0005).
ALTER PUBLICATION zero_curved ADD TABLE "team", "workflow_state", "issue_description", "issue_key_alias", "label", "issue_label";
