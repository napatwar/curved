import { boolean, index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

// Better Auth owns these tables (decision record 0005). They follow the
// schema that `npx auth generate` produces for Better Auth 1.7 with the admin
// and organization plugins, with these changes:
// - IDs are `uuid`, generated as UUIDv7 by `advanced.database.generateId`.
// - Timestamps are `timestamptz`.
// - The organization plugin's tables are renamed to `workspace`,
//   `workspace_member` and `workspace_invitation`, and its `organizationId`
//   field to `workspace_id`.
// - Columns that sync through Zero have no database default, so they stay
//   required in the Zero schema. Better Auth always sets them.
// Change them only together with the Better Auth options in apps/api.

const timestamptz = (name: string) => timestamp(name, { withTimezone: true });

export const user = pgTable("user", {
  id: uuid().primaryKey(),
  name: text().notNull(),
  email: text().notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text(),
  createdAt: timestamptz("created_at").defaultNow().notNull(),
  updatedAt: timestamptz("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  // Admin plugin: `admin` marks the instance admin of a self-hosted instance.
  role: text(),
  banned: boolean().default(false),
  banReason: text("ban_reason"),
  banExpires: timestamptz("ban_expires"),
});

export const session = pgTable(
  "session",
  {
    id: uuid().primaryKey(),
    expiresAt: timestamptz("expires_at").notNull(),
    token: text().notNull().unique(),
    createdAt: timestamptz("created_at").defaultNow().notNull(),
    updatedAt: timestamptz("updated_at")
      .$onUpdate(() => new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    impersonatedBy: uuid("impersonated_by"),
    activeWorkspaceId: uuid("active_workspace_id"),
  },
  (table) => [index("session_user_idx").on(table.userId)],
);

export const account = pgTable(
  "account",
  {
    id: uuid().primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamptz("access_token_expires_at"),
    refreshTokenExpiresAt: timestamptz("refresh_token_expires_at"),
    scope: text(),
    password: text(),
    createdAt: timestamptz("created_at").defaultNow().notNull(),
    updatedAt: timestamptz("updated_at")
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("account_user_idx").on(table.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: uuid().primaryKey(),
    identifier: text().notNull(),
    value: text().notNull(),
    expiresAt: timestamptz("expires_at").notNull(),
    createdAt: timestamptz("created_at").defaultNow().notNull(),
    updatedAt: timestamptz("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const workspace = pgTable("workspace", {
  id: uuid().primaryKey(),
  name: text().notNull(),
  // ASCII only (decision record 0007). The API checks it on create and update.
  slug: text().notNull().unique(),
  logo: text(),
  createdAt: timestamptz("created_at").notNull(),
  metadata: text(),
});

export const workspaceMember = pgTable(
  "workspace_member",
  {
    id: uuid().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    // `owner`, `admin` or `member`.
    role: text().notNull(),
    createdAt: timestamptz("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("workspace_member_workspace_user_idx").on(table.workspaceId, table.userId),
    // Every Zero query filters by the signed-in user's memberships.
    index("workspace_member_user_idx").on(table.userId),
  ],
);

export const workspaceInvitation = pgTable(
  "workspace_invitation",
  {
    id: uuid().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    email: text().notNull(),
    role: text(),
    status: text().default("pending").notNull(),
    expiresAt: timestamptz("expires_at").notNull(),
    createdAt: timestamptz("created_at").defaultNow().notNull(),
    inviterId: uuid("inviter_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("workspace_invitation_workspace_idx").on(table.workspaceId),
    index("workspace_invitation_email_idx").on(table.email),
  ],
);
