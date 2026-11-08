import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

import { type FullConfig, request } from "@playwright/test";

import { adminStatePath, e2eWorkspaceSlug } from "./support";

const admin = { name: "E2E Admin", email: "e2e-admin@example.com", password: "e2e-admin-password" };

/**
 * A fresh production stack has no users. The first sign-up becomes the
 * instance admin (ADR 0005), who then creates the workspace the tests use.
 * On later runs sign-up is closed, so this signs in instead.
 */
export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]?.use.baseURL ?? "http://localhost";
  const api = await request.newContext({
    baseURL,
    // Better Auth checks the Origin header on requests that change state.
    extraHTTPHeaders: { origin: new URL(baseURL).origin },
  });

  const signUp = await api.post("/api/auth/sign-up/email", { data: admin });
  if (!signUp.ok()) {
    const signIn = await api.post("/api/auth/sign-in/email", {
      data: { email: admin.email, password: admin.password },
    });
    if (!signIn.ok()) {
      throw new Error(`Cannot sign up or sign in the e2e admin: ${await signIn.text()}`);
    }
  }

  const workspaces: { slug: string }[] = await (
    await api.get("/api/auth/organization/list")
  ).json();
  if (!workspaces.some((workspace) => workspace.slug === e2eWorkspaceSlug)) {
    const created = await api.post("/api/auth/organization/create", {
      data: { name: "E2E", slug: e2eWorkspaceSlug },
    });
    if (!created.ok()) {
      throw new Error(`Cannot create the e2e workspace: ${await created.text()}`);
    }
  }

  mkdirSync(dirname(adminStatePath), { recursive: true });
  await api.storageState({ path: adminStatePath });
  await api.dispose();
}
