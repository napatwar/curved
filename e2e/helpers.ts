import { DEV_USER_EMAIL, DEV_USER_PASSWORD } from "@curved/db/dev";
import { expect, type Page } from "@playwright/test";

/** Signs in through the sign-in screen and waits for Zero to connect. */
export async function signIn(page: Page, email = DEV_USER_EMAIL, password = DEV_USER_PASSWORD) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("connected", { exact: true })).toBeVisible();
}

/**
 * Calls Better Auth's API with the page's session cookie. Better Auth checks
 * the Origin header on requests that carry cookies.
 */
export async function authApi<T = unknown>(page: Page, path: string, data: unknown): Promise<T> {
  const origin = new URL(page.url()).origin;
  const response = await page.request.post(`${origin}/api/auth${path}`, {
    data,
    headers: { origin },
  });
  expect(response.ok(), `${path}: ${await response.text()}`).toBe(true);
  const body: T = await response.json();
  return body;
}

export async function authApiGet<T = unknown>(page: Page, path: string): Promise<T> {
  const origin = new URL(page.url()).origin;
  const response = await page.request.get(`${origin}/api/auth${path}`);
  expect(response.ok(), `${path}: ${await response.text()}`).toBe(true);
  const body: T = await response.json();
  return body;
}
