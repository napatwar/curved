// Resets a user's password when the instance has no SMTP (decision record
// 0005). It prints a new random password and signs the user out everywhere.
//
//   pnpm --filter @curved/api auth:reset-password person@example.com
//   docker compose exec curved node dist/reset-password.js person@example.com
import { randomBytes } from "node:crypto";

import { auth } from "../auth/auth";
import { db } from "../db";

const email = process.argv[2];
if (!email) {
  console.error("Usage: pnpm --filter @curved/api auth:reset-password <email>");
  process.exit(1);
}

const context = await auth.$context;
const found = await context.internalAdapter.findUserByEmail(email.toLowerCase(), {
  includeAccounts: true,
});
if (!found) {
  console.error(`No user has the email ${email}.`);
  process.exit(1);
}

const password = randomBytes(12).toString("base64url");
const hash = await context.password.hash(password);
if (found.accounts.some((account) => account.providerId === "credential")) {
  await context.internalAdapter.updatePassword(found.user.id, hash);
} else {
  // The user signed up with OAuth only, so add email and password sign-in.
  await context.internalAdapter.linkAccount({
    userId: found.user.id,
    providerId: "credential",
    accountId: found.user.id,
    password: hash,
  });
}
await context.internalAdapter.deleteUserSessions(found.user.id);

console.log(`New password for ${found.user.email}: ${password}`);
console.log("Give it to them privately and ask them to change it after signing in.");

await db.$client.end();
