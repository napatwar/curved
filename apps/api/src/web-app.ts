import { readFileSync } from "node:fs";
import { join } from "node:path";

import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";

/**
 * Serves the web app's build output from `root`. Unknown paths outside `/api`
 * get `index.html`, so client routes work on reload. Mount it after every API
 * route.
 */
export function webApp(root: string) {
  // Read once at startup, so a missing build fails fast.
  const indexHtml = readFileSync(join(root, "index.html"), "utf8");
  const web = new Hono();

  web.use("*", async (c, next) => {
    const path = c.req.path;
    if (path === "/api" || path.startsWith("/api/")) {
      return c.json({ error: { code: "not_found", message: "Not found" } }, 404);
    }
    return next();
  });

  web.use(
    "*",
    serveStatic({
      root,
      onFound: (path, c) => {
        // Vite puts a content hash in every file name under assets/.
        c.header(
          "Cache-Control",
          path.includes("/assets/") ? "public, max-age=31536000, immutable" : "no-cache",
        );
      },
    }),
  );

  web.get("*", (c) => {
    // A missing file is a 404, not the app, so a stale tab loads no HTML as script.
    if (c.req.path.startsWith("/assets/")) {
      return c.notFound();
    }
    return c.html(indexHtml, 200, { "Cache-Control": "no-cache" });
  });

  return web;
}
