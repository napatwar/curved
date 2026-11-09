---
status: accepted
date: 2026-11-08
---

# MVP scope and domain model

## Context and problem statement

Product work starts after authentication ([0005](0005-authentication.md)). We need to decide which features ship first and how the core data is shaped, before we write migrations.

Linear is the reference product. Constraints from earlier records:

- Every tenant table has `workspace_id` and a UUIDv7 primary key, and no app query joins across workspaces ([0001](0001-tech-stack.md)).
- ZQL has no aggregates, no full-text search and no JSON or array filters ([0004](0004-zero-spike-results.md)). Data we filter on must be in tables, and counts need columns or client-side counting.
- Zero syncs whole rows. A query cannot select only some columns.
- Client mutators make optimistic changes, and the server result always wins ([0005](0005-authentication.md)).
- The maintainer prefers low maintenance effort, and self-hosting must not need extra services.

The current schema has an `issue` table with a fixed `status` check (`todo`, `in_progress`, `done`) and a `comment` table. Both came from the spike.

## Considered options

1. MVP scope: a small core first, or Linear's full feature set.
2. Teams and issue keys: no teams with one workspace key, teams with per-team keys, or teams with workspace-wide numbers. Number allocation: a server counter, a client guess corrected by the server, a Postgres sequence per team, or `max(number) + 1`.
3. Workflow states: a fixed list, customizable per team with fixed categories, or customizable per workspace.
4. Labels: an array or JSON column on `issue`, or a junction table.
5. Ordering: integer positions, floats, or string fractional indexes. Removal: hard delete only, a separate archive table, or `archived_at` and `deleted_at` columns.
6. Descriptions: stored in `issue` or in a separate table, as Markdown, editor JSON, Yjs or HTML.
7. Due dates, comment features, issue relations and permissions by role: in the MVP or later.

## Decision outcome

### MVP scope

| Phase      | Features                                                                                                                                                                                                                                                                                                   |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MVP (v0.1) | Teams and issue keys; issues with title, description, state, priority, assignee, labels, due date and sub-issues; comments that their authors can edit and delete; list and board views per team; filter, sort and group without saving; My issues; keyboard shortcuts; command palette; archive and trash |
| Phase 2    | In-app notifications inbox, with email when SMTP is set; projects; saved views; issue activity history; attachments; comment threads; issue relations (blocks, related, duplicate)                                                                                                                         |
| Later      | Cycles and estimates; full-text search, including Thai; public REST API and API keys; integrations such as GitHub and Slack; triage; import from Linear; guest role; private teams; comment reactions                                                                                                      |

The MVP needs only Postgres, Zero and the API. Phase 2 brings `pg-boss`, file storage and log-like tables. Estimates wait for cycles, because they mean little without them.

Do not add columns for deferred features ahead of time. [0004](0004-zero-spike-results.md) showed that adding a column needs no replica reset.

### Teams and issue keys

A workspace has teams, and each team numbers its issues, as in Linear: `ENG-123`, `DES-45`.

- Creating a workspace creates its first team. With one team, the UI hides team navigation, so a single user never has to think about teams.
- `team` is our own tenant table, changed through Zero mutators. We do not use Better Auth's teams, because a team holds app data: its key, its issue counter and its workflow states.
- No team membership in the MVP. Every workspace member sees every team, like Linear's public teams. `team_member` and private teams come later.
- A team key has 1 to 7 uppercase letters or digits and starts with a letter. Keys are unique per workspace.
- An issue can move to another team. It gets a new number there, and its old team and number go into `issue_key_alias`, so old links still open.
- Changing a team's key comes later, with a `team_key_alias` table.

Issue numbers come from the server:

- `team.next_issue_number` is a counter. The server mutator runs `UPDATE team SET next_issue_number = next_issue_number + 1 ... RETURNING` in the mutation's transaction. The row lock serializes issue creation within one team, which is fine for teams of tens, and does not affect other teams.
- The client mutator (`tx.location === "client"`) inserts `number: 0`, which means the number is pending. A check of `number > 0` keeps 0 out of Postgres.
- While the number is pending, the UI shows `ENG-…`. Other clients only see the issue after the server has saved it, with its real number.
- A unique index on `(team_id, number)` is the final guard. Numbers are never reused, even after deletion.

Routes use the key, such as `/issue/ENG-123`. The app looks up the team by key, then the issue by team and number, then `issue_key_alias`. A pending issue opens by UUID.

We rejected a client guess corrected by the server because a user could copy a number that then changes. A sequence per team needs DDL for each team and skips numbers on rollback. `max(number) + 1` races without a lock and reuses the number of a deleted last issue.

### Workflow states

Each team customizes its states. Every state belongs to a fixed category, as in Linear, and app logic uses the category, never the state name.

- `workflow_state.category` is one of `backlog`, `unstarted`, `started`, `completed` or `canceled`, enforced by a check. `triage` comes with the triage feature.
- A new team gets Backlog, Todo, In Progress, Done and Canceled, one per category.
- Every category keeps at least one state. `team.default_state_id` sets the state for new issues.
- Deleting a state requires a target state. The mutator moves the state's issues in the same transaction.
- `workflow_state.position` is an integer. A team has few states and reorders them rarely, so the mutator renumbers them all.
- `issue.state_id` replaces `issue.status`. The mutator checks that the state belongs to the issue's team. Moving an issue to another team picks a state with the same category there.
- Filters by category use `whereExists` on the state relationship. [0004](0004-zero-spike-results.md) measured `whereExists` at 22–44 ms, so we do not copy the category onto `issue`.

Later: `started_at` and `completed_at` on `issue`, for cycles, insights and auto-archive; the `triage` category; a Duplicate state, which needs issue relations.

### Labels, priority, assignee, due dates and sub-issues

Labels:

- `label` has a nullable `team_id`. Null means a workspace label, and a value means a team label. Names are unique within that scope, ignoring case, through partial unique indexes on `lower(name)`.
- `issue_label` is a junction table, so filters use `whereExists`. Its primary key is `(issue_id, label_id)`, so two clients adding the same label make an idempotent upsert instead of a conflict.
- The mutator checks that a label belongs to the issue's workspace, and that a team label belongs to the issue's team.
- Label groups come later, as `label.parent_id`.

Priority:

- `issue.priority` is a `smallint` from 0 to 4: 0 none, 1 low, 2 medium, 3 high, 4 urgent.
- Sorting descending gives urgent first and none last. Linear uses 1 for urgent and 4 for low, but ZQL has no `CASE`, so that order cannot be sorted. The public API and a Linear importer map between the two.

Assignee and creator:

- An issue has at most one assignee. `issue.assignee_id` is a nullable foreign key to `user`, and the mutator checks that the user is a workspace member.
- `issue.creator_id` is a nullable foreign key to `user`, set to null when the user is deleted. It supports a "Created by me" filter.
- Removing a member unassigns their issues in that workspace, in a Better Auth hook after the member is removed. [0005](0005-authentication.md) syncs a user only to people who share a workspace, so a kept ID would show no name.
- Foreign keys to `user` work while everything is in one database. If tenant data moves into cells, these foreign keys must be dropped, because auth becomes a central service.

Due dates:

- `issue.due_date` is a nullable `date`, with no time or time zone. The UI treats it as a calendar date, not a moment.
- Views can filter and sort by it.

Sub-issues:

- `issue.parent_id` is a nullable foreign key to `issue`, in the same workspace and possibly another team.
- Nesting depth is not limited. The mutator walks the ancestors to prevent a cycle.
- Progress such as "2/5" is counted on the client from the synced children.

Counts follow one rule: count on the client when the rows are few and already synced. Add a counter column only for large sets, and always update it in the same mutator. The MVP list does not show comment counts.

### Ordering

- `issue.sort_order` is `text COLLATE "C"`, filled with Rocicorp's `fractional-indexing` package. Moving an issue updates one row, and keys never need rebalancing.
- `COLLATE "C"` is required. Postgres's default collations, such as `en_US`, order letter case differently from the SQLite replica and JavaScript, so the server and client would disagree.
- Queries order by `sortOrder`, then `id`. If two clients insert into the same gap at once and create equal keys, `id` decides.
- New issues go to the top. The client generates a key before the first issue it sees. The server reads the team's real lowest key through an index and generates its own, which wins.
- Views use this order only when ordering is set to Manual. The default can still sort by priority or update time.
- Sub-issues use the same `sort_order`. A separate sub-issue order comes later.

### Archive and trash

Issues have `archived_at` and `deleted_at`, as in Linear. Restoring sets the column back to null.

- Only issues are archived or trashed. Comments and labels are hard deleted, and states follow the rule above.
- A shared helper adds `archivedAt IS NULL` and `deletedAt IS NULL` to every query, like the membership filter in [0005](0005-authentication.md). A "Show archived" filter and a Trash page are separate queries.
- An archived issue still opens by URL and can be edited. The page shows that it is archived.
- In the MVP, trash is emptied only by hand, with "Delete permanently" on the Trash page. Automatic deletion after 30 days comes with `pg-boss` in Phase 2.
- Trashing a parent leaves its sub-issues in place, and the UI treats them as having no parent. Permanent deletion sets their `parent_id` to null and cascades to comments, `issue_label`, `issue_description` and `issue_key_alias`.
- A team can be deleted only when it has no issues. Archiving teams comes later.
- Auto-archive of completed issues comes later, because it needs `completed_at` and `pg-boss`.

Archived and trashed issues stay in the replica, which costs about 300 bytes per row ([0004](0004-zero-spike-results.md)).

### Descriptions

Descriptions live in their own table, because Zero syncs whole rows. In `issue`, every list query would carry every description.

- `issue_description` has `issue_id` as its primary key and as a foreign key to `issue` with cascade, plus `workspace_id`, `body`, `created_at` and `updated_at`. Only the issue page loads it.
- `issues.create` inserts both rows in one transaction.

Descriptions and comments are stored as Markdown in `text` columns:

- The editor is Tiptap, with conversion to and from Markdown. The package for the conversion is chosen during implementation.
- Markdown is portable, matches what Linear's API returns, works with `ILIKE`, and serves the public API without conversion.
- Raw HTML in Markdown is not allowed, and rendering drops it.
- A mention is a link, such as `[@Napat](mention://user/<uuid>)`. An issue reference is plain text, such as `ENG-123`, linked when rendered.
- Images come with attachments in Phase 2, as Markdown images pointing to storage URLs.
- Zod limits a description to 100,000 characters and a comment to 20,000.
- Concurrent edits are last write wins on the column, with debounced saves. Real-time co-editing with Yjs comes later, if users need it. Markdown would then stay as a snapshot for search and the API.

We rejected editor JSON in `jsonb` because ZQL cannot search it, the stored data would follow the editor's schema, and the API would still need to convert it. Yjs needs a separate collaboration server and stores binary data that cannot be searched. HTML needs sanitizing everywhere to avoid XSS.

### Comments

- `comment.author_id` is a nullable foreign key to `user`, set to null when the user is deleted. The spike's table has no author, so a migration adds it.
- Mutators set `creator_id` and `author_id` from the session's `userID` ([0005](0005-authentication.md)), never from the arguments.
- Authors can edit and delete only their own comments. An edit sets `comment.edited_at`, and the UI shows the comment as edited. Deleting is a hard delete.
- Threads come in Phase 2, as `comment.parent_id`. Reactions come later.

### Issue relations

Blocks, related and duplicate relations come in Phase 2, as an `issue_relation` table. The Duplicate state waits for them.

### Permissions by role

Roles come from [0005](0005-authentication.md). Server mutators check them with its shared helper, and the UI hides actions the user cannot take.

| Action                                                | Member | Admin and owner |
| ----------------------------------------------------- | ------ | --------------- |
| Create, edit, move, archive, trash and restore issues | Yes    | Yes             |
| Write comments, and edit or delete their own          | Yes    | Yes             |
| Create, edit and delete labels                        | Yes    | Yes             |
| Create and delete teams, and change a team's name     | No     | Yes             |
| Create, edit, reorder and delete workflow states      | No     | Yes             |
| Delete issues permanently from the Trash              | No     | Yes             |

### Tables

Every table has `workspace_id` and is added to the `zero_curved` publication.

| Table               | Columns                                                                                                                                                                                                 | Keys and constraints                                                                                            |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `team`              | `id`, `workspace_id`, `key`, `name`, `next_issue_number`, `default_state_id`, `created_at`, `updated_at`                                                                                                | Unique `(workspace_id, key)`                                                                                    |
| `workflow_state`    | `id`, `workspace_id`, `team_id`, `name`, `color`, `category`, `position`, `created_at`, `updated_at`                                                                                                    | Check on `category`                                                                                             |
| `issue`             | `id`, `workspace_id`, `team_id`, `number`, `title`, `state_id`, `priority`, `assignee_id`, `creator_id`, `due_date`, `parent_id`, `sort_order`, `archived_at`, `deleted_at`, `created_at`, `updated_at` | Unique `(team_id, number)`; checks `number > 0` and `priority` between 0 and 4; `sort_order` uses `COLLATE "C"` |
| `issue_description` | `issue_id`, `workspace_id`, `body`, `created_at`, `updated_at`                                                                                                                                          | Primary key `issue_id`                                                                                          |
| `issue_key_alias`   | `id`, `workspace_id`, `team_id`, `number`, `issue_id`, `created_at`                                                                                                                                     | Unique `(team_id, number)`                                                                                      |
| `label`             | `id`, `workspace_id`, `team_id`, `name`, `color`, `created_at`, `updated_at`                                                                                                                            | Partial unique indexes on `lower(name)` per scope                                                               |
| `issue_label`       | `workspace_id`, `issue_id`, `label_id`, `created_at`                                                                                                                                                    | Primary key `(issue_id, label_id)`                                                                              |
| `comment`           | `id`, `workspace_id`, `issue_id`, `author_id`, `body`, `edited_at`, `created_at`, `updated_at`                                                                                                          | Adds `author_id` and `edited_at` to the spike's table; `body` is Markdown                                       |

### Consequences

- Good, because the MVP needs no service beyond Postgres, Zero and the API.
- Good, because teams, keys, states and labels follow Linear, so Linear users feel at home and an importer can map data directly.
- Good, because issue numbers never collide or change after the server saves them.
- Good, because the issue row stays small. Descriptions load only on the issue page.
- Good, because every filterable field is a column or a junction table that ZQL can filter.
- Bad, because a new issue shows `ENG-…` for about one server round trip before its number appears.
- Bad, because filters by state category need `whereExists`, and every query must use the shared archive and trash filter.
- Bad, because `issue_label` and `issue_description` break the rule that every primary key is a UUIDv7 `id`. The exception covers only junction and 1:1 tables.
- Bad, because concurrent description edits overwrite each other until co-editing exists.
- Bad, because Markdown cannot hold every editor feature without a convention, such as mention links.
- Neutral, because trash is emptied by hand until Phase 2.

## More information

Implementation follow-up:

- Replace `issue.status` and its check with `state_id`, and add the tables above. The spike seed must create a team and states.
- Add `author_id` and `edited_at` to `comment`.
- Confirm how Zero 1.11.3 exposes a Postgres `date` column, and keep `due_date` free of time zone shifts in the UI.
- Add the shared archive and trash filter next to the membership filter from [0005](0005-authentication.md).
- Update [conventions.md](../conventions.md) with the primary key exception for junction and 1:1 tables, and with `COLLATE "C"` for sort keys.
- Measure size again, as [0004](0004-zero-spike-results.md) requires: seed `issue_description` with about 2KB of Markdown per issue, then measure the replica and the time to open an issue page.
- Confirm that `tx.location` and server-only mutator logic behave as described in Zero 1.11.3, with an integration test where two clients create issues in the same team at once.

### Implementation notes

Migrations 0006 and 0007 implement this record. Where the code differs from the text above:

- `issue.status` stays as a nullable column that nothing reads, writes or syncs, so open tabs with the previous Zero schema keep working ([conventions](../conventions.md), expand then contract). A later release drops it. Migration 0006 gives every workspace its first team, maps each status to a state, numbers existing issues in creation order, and deletes issues whose workspace no longer exists.
- Unassigning a removed member is a Postgres trigger on `workspace_member`, not a Better Auth hook. Better Auth 1.7 runs no hook when a member leaves, and the trigger also covers deleting a user or a workspace.
- Deleting a workspace deletes its issues, labels and teams in a Postgres trigger on `workspace`, for the same reasons: it covers every way a workspace is deleted and runs in the delete's transaction. Tenant tables have no foreign key to `workspace` ([0005](0005-authentication.md)), so nothing cascades on its own. If tenant data moves into cells, this becomes a job that the central auth service starts.
- `team.default_state_id` is a deferred foreign key, so a team and its states can be inserted in one transaction.
- The server allocates numbers in `apps/api/src/zero/server-mutators.ts`, which overrides `issues.create` and `issues.moveToTeam`. The shared versions insert 0, which Postgres rejects, so a server that forgets the override fails safely. An integration test confirms this, and that two clients pushing through `/mutate` at once get every number exactly once.
- Zero 1.11.3 exposes `date` as milliseconds at UTC midnight and writes it back through `AT TIME ZONE 'UTC'`, so mutators accept only UTC-midnight values.
- Zero 1.11.3 cannot order a many-to-many relationship, so `issue.labels` comes unsorted and the UI sorts it.
- List queries return plain issue rows. Views look up teams and states in `teams.byWorkspace`. Relating them on every row made the first load of 20,000 issues about 30% slower.
- Choices this record left open: a first team's key is the first three letters or digits of the workspace slug, and its name is the workspace's. Todo is the default state. A workspace keeps at least one team. Editing a state changes its name and color, never its category.

Measurements, with the setup from [0004](0004-zero-spike-results.md) and descriptions of 2,048 to 2,500 bytes of Markdown (`pnpm db:seed:spike`, then `pnpm test:spike`):

| Measure                                          | 0004            | Now                                     |
| ------------------------------------------------ | --------------- | --------------------------------------- |
| Replica per row: issue / description / comment   | 294 / — / 535 B | 693 / 4,150 / 620 B                     |
| Postgres per row: issue / description / comment  | 253 / — / 454 B | 526 / 1,119 / 456 B                     |
| Fresh replica (20,001 issues, 60,000 comments)   | 38MB            | 138MB, healthy 15 s after start         |
| Open an issue: load its description              | —               | p50 25 ms, p95 56 ms; again: under 1 ms |
| First load of all 20,000 issues: cold / warm p50 | 999 / 877 ms    | 1,573 / 1,090 ms                        |
| State change seen in a second browser, p95       | 126 ms          | 156 ms                                  |

No decision changes. Descriptions add about 4KB per issue to the replica, because a 2KB row fills most of a 4KB SQLite page, while Postgres compresses the text. At about 7KB per issue with three comments, 50GB holds roughly 7 million issues. The issue row grew from 6 to 16 columns, so the unlimited list is slower but still under 2 seconds. The virtualized list and limited queries from 0004 remain required before real use.
