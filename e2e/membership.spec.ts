import { expect, test } from "@playwright/test";

import { authApi, authApiGet, signIn } from "./helpers";

test("a removed member's client loses the workspace's data", async ({ browser }) => {
  // Two users, an invitation and a removal take longer than one screen.
  test.setTimeout(60_000);
  const owner = await (await browser.newContext()).newPage();
  const member = await (await browser.newContext()).newPage();
  const stamp = Date.now();
  const slug = `e2e-${stamp}`;
  const memberEmail = `member-${stamp}@example.com`;
  const title = `Members only ${stamp}`;

  // The dev user is the instance admin, so they can create a workspace.
  await signIn(owner);
  const workspace = await authApi<{ id: string }>(owner, "/organization/create", {
    name: `E2E ${stamp}`,
    slug,
  });
  await owner.goto(`/${slug}`);
  await owner.getByLabel("Issue title").fill(title);
  await owner.getByRole("button", { name: "Add" }).click();
  const invitation = await authApi<{ id: string }>(owner, "/organization/invite-member", {
    email: memberEmail,
    role: "member",
    organizationId: workspace.id,
  });

  try {
    // Sign-up is closed, but a pending invitation lets this person sign up.
    await member.goto("/sign-up");
    await member.getByLabel("Name").fill("Invited Member");
    await member.getByLabel("Email").fill(memberEmail);
    await member.getByLabel("Password").fill("member-password");
    await member.getByRole("button", { name: "Create account" }).click();
    await expect(member.getByRole("heading", { name: "No workspace yet" })).toBeVisible();

    await member.goto(`/invitations/${invitation.id}`);
    await member.getByRole("button", { name: "Accept invitation" }).click();
    await expect(member).toHaveURL(new RegExp(`/${slug}$`));
    await expect(member.getByText(title)).toBeVisible();

    await authApi(owner, "/organization/remove-member", {
      memberIdOrEmail: memberEmail,
      organizationId: workspace.id,
    });

    // zero-cache re-runs the membership filter and removes the rows.
    await expect(member.getByText(title)).toBeHidden();
    await expect(member.getByRole("heading", { name: "Workspace not found" })).toBeVisible();
  } finally {
    // Leave the shared dev database as it was.
    const { users } = await authApiGet<{ users: { id: string }[] }>(
      owner,
      `/admin/list-users?searchField=email&searchValue=${encodeURIComponent(memberEmail)}`,
    );
    for (const user of users) {
      await authApi(owner, "/admin/remove-user", { userId: user.id });
    }
    await authApi(owner, "/organization/delete", { organizationId: workspace.id });
  }
});
