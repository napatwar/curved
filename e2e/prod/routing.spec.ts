import { expect, test } from "@playwright/test";

test("the health check reaches the database", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ status: "ok", database: "ok" });
});

test("client routes get the web app, so a reload works", async ({ request }) => {
  const response = await request.get("/some/client/route");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("text/html");
  expect(response.headers()["cache-control"]).toBe("no-cache");
  expect(await response.text()).toContain('<div id="root">');
});

test("unknown API paths return a JSON 404, not the web app", async ({ request }) => {
  const response = await request.get("/api/does-not-exist");
  expect(response.status()).toBe(404);
  expect(await response.json()).toEqual({
    error: { code: "not_found", message: "Not found" },
  });
});

test("hashed assets are cached for a year and missing ones are 404", async ({ request }) => {
  const html = await (await request.get("/")).text();
  const asset = /\/assets\/[^"]+\.js/.exec(html)?.[0];
  expect(asset).toBeDefined();

  const response = await request.get(asset ?? "");
  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toBe("public, max-age=31536000, immutable");

  expect((await request.get("/assets/missing.js")).status()).toBe(404);
});
