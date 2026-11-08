import { fileURLToPath, URL } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

const envDir = "../..";
const apiPort = loadEnv("", envDir, "").API_PORT ?? "3000";

// The API serves auth routes under /api. Proxying keeps the web app and the
// API on one origin in development, as in production (decision record 0008),
// so the session cookie needs no cross-origin setup.
const apiProxy = { "/api": `http://localhost:${apiPort}` };

export default defineConfig({
  envDir,
  server: { proxy: apiProxy },
  preview: { proxy: apiProxy },
  plugins: [tanstackRouter({ target: "react", autoCodeSplitting: true }), react(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
