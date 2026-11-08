import { readFileSync } from "node:fs";
import { builtinModules } from "node:module";

import { build, type Plugin } from "esbuild";

// Bundles the API for the production image (ADR 0008). Our code and the
// @curved/* packages go into the bundle. npm packages stay external, and the
// image installs them with `pnpm deploy --prod`, so packages that break when
// bundled keep working.

const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const dependencies = new Set(Object.keys(packageJson.dependencies ?? {}));
const builtins = new Set(builtinModules);

function packageName(specifier: string) {
  const parts = specifier.split("/");
  return specifier.startsWith("@") ? parts.slice(0, 2).join("/") : (parts[0] ?? specifier);
}

const externalDependencies: Plugin = {
  name: "external-dependencies",
  setup(context) {
    context.onResolve({ filter: /^[^./]/ }, (args) => {
      if (args.path.startsWith("node:") || builtins.has(args.path)) {
        return { external: true };
      }
      const name = packageName(args.path);
      if (name.startsWith("@curved/")) {
        return undefined;
      }
      if (dependencies.has(name)) {
        return { external: true };
      }
      return {
        errors: [
          {
            text: `${name} is imported by ${args.importer}, but it is not in the dependencies of @curved/api, so the image would not install it.`,
          },
        ],
      };
    });
  },
};

await build({
  entryPoints: {
    server: "src/index.ts",
    migrate: "src/migrate.ts",
    "reset-password": "src/cli/reset-password.ts",
  },
  outdir: "dist",
  bundle: true,
  platform: "node",
  target: "node24",
  format: "esm",
  sourcemap: true,
  logLevel: "info",
  plugins: [externalDependencies],
});
