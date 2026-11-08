---
status: accepted
date: 2026-11-08
---

# Authentication

## Context and problem statement

The Zero query and mutate endpoints accept every request (`userID: null`), so anyone can read and write every workspace. Product work needs sign-in, workspaces with members, and permission checks first.

Zero has no sign-in and no row-level security. zero-cache forwards credentials to our endpoints, and our queries and mutators must enforce access ([Zero authentication](https://zero.rocicorp.dev/docs/auth)).

Constraints:

- Self-hosting must not depend on an outside service. Self-hosted instances serve one person up to teams of tens.
- The maintainer prefers low maintenance effort.
- Tenant data stays keyed by `workspace_id`, so it can be split into cells later.

## Considered options

Sign-in:

- Better Auth, a library that runs inside the API
- A hosted service, such as Clerk, WorkOS or Auth0
- A separate identity provider, such as Keycloak, Zitadel or Ory
- Our own implementation

Lucia is no longer maintained, and Auth.js is now maintained by the Better Auth team, so neither was considered separately.

## Decision outcome

Chosen option: Better Auth, because it runs inside the Hono API, stores its data in our Postgres through its Drizzle adapter, and adds no service for self-hosters to run. Its organization plugin provides workspaces, members, invitations and roles.

### Sessions

- Better Auth database sessions in an `HttpOnly` cookie. No JWTs for the web app.
- zero-cache forwards the cookie to the API, with `ZERO_QUERY_FORWARD_COOKIES` and `ZERO_MUTATE_FORWARD_COOKIES` set to `true`.
- In production, the web app, API and zero-cache share one site, such as `app.example.com` and `sync.example.com`. The cookie sets `Domain` to the parent domain and uses `SameSite=Lax`, never `SameSite=None`.
- Clients outside the browser use the public REST API with API keys, not Zero. Add bearer tokens only if a client needs Zero sync outside the browser.

### Sign-in methods

- Email and password, always on.
- Google and GitHub OAuth, off by default on every deployment. A deployment turns each one on with explicit configuration and its credentials.
- SMTP is optional. When it is set, email verification and password reset by email are on, and the cloud deployment always sets it. Without SMTP, email verification is skipped, and an instance admin resets passwords with a CLI command.
- Magic links, passkeys and two-factor authentication come later as Better Auth plugins.

Sign-up:

- Cloud: anyone can sign up and create a workspace.
- Self-host: the first user to sign up becomes the instance admin. Sign-up then closes, so new users join by invitation. An admin can reopen sign-up with configuration.

### Workspaces, members and roles

- The organization plugin's organization is our workspace. Rename its tables to `workspace`, `workspace_member` and `workspace_invitation`. Rename foreign key columns to `workspace_id` if the plugin's `schema` option allows it. Otherwise auth tables keep `organization_id`, and our own tables still use `workspace_id`.
- Generate IDs as UUIDv7 with `advanced.database.generateId`.
- A user can belong to many workspaces.
- Roles: `owner`, `admin` and `member`. Add `guest` later as a custom role.
- Teams inside a workspace come later, in their own decision record, because they shape issue keys such as `ENG-123`. The plugin can turn them on with `teams: { enabled: true }`.
- On the cloud deployment, any user can create a workspace. On a self-hosted instance, only an instance admin can, using Better Auth's admin plugin. An instance admin differs from a workspace owner.
- The app always shows an invitation link to copy, and also emails it when SMTP is set.
- Members, roles and invitations are managed through Better Auth's API, not Zero mutators.

### Permissions in Zero

On each request from zero-cache, the API calls Better Auth's `getSession` with the forwarded cookie. With no valid session, it returns `401`, Zero moves to `needs-auth`, and the web app shows sign-in. With a session, it passes `userID` and a context of `{ userID }` to `handleQueryRequest` and `handleMutateRequest`.

Reads:

- Every query limits rows to workspaces where the user is a member, with `whereExists` on `workspace_member`. A shared helper builds this filter, so no query writes it by hand.
- Removing a member removes the workspace's data from their client right away, because zero-cache keeps the filter up to date.

Writes:

- Every server mutator first checks membership, and a role when needed, with a shared helper. On failure, it throws an `app` error, so the client rolls back and shows the message.
- When a mutator changes an existing row, it reads `workspace_id` from the database, not from the arguments. This stops moving or changing rows in another workspace.
- Client mutators only make optimistic changes. The server result always wins.

Synced data:

| Table                                              | Synced columns            |
| -------------------------------------------------- | ------------------------- |
| `workspace`                                        | ID, name, slug, logo      |
| `workspace_member`                                 | ID, workspace, user, role |
| `user`                                             | ID, name, email, image    |
| `account`, `session`, `verification`, `invitation` | None                      |

The publication lists these columns, so no other column reaches zero-cache. A user sees other users only when they share a workspace, so members of a workspace see each other's email, as in Linear.

Sign-out calls `zero.delete()`, so no synced data stays on the device.

### Consequences

- Good, because sign-in, sessions, invitations and roles come from one library inside the API, with no extra service to run.
- Good, because cookie sessions keep the session ID away from page scripts and can be revoked at once.
- Good, because self-hosting works with no SMTP and no OAuth app.
- Good, because membership changes take effect on clients immediately.
- Bad, because code and Better Auth's API say "organization" while the product says "workspace".
- Bad, because the API checks the session in the database on every request from zero-cache. Better Auth's cookie cache can reduce this if it becomes a bottleneck.
- Bad, because the web app, API and zero-cache must share one site for the cookie to reach zero-cache.
- Bad, because auth tables are global, not per workspace. If tenant data is split into cells, auth becomes a central service that every cell uses.
- Neutral, because we must follow Better Auth releases ourselves, and its plugin tables come from its schema generator.

## More information

Tests must show that a user outside a workspace cannot read it or write to it, and that removing a member removes the workspace's data from their client.

Follow-up work:

- Add Better Auth, its tables and sign-in screens, and replace `userID: null` in the Zero endpoints.
- Add the membership filter and check helpers, and apply them to existing queries and mutators.
- Map database errors in mutators to safe messages, as [0004](0004-zero-spike-results.md) requires.
- Revisit enterprise single sign-on (SAML) when a cloud customer needs it.
