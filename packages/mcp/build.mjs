// Bundles the server entry with the engine source inlined, so `node dist/index.js` runs under plain
// node (design, Build and entry point). Exits non-zero on failure so `pretest` fails the test run.
import { build } from "esbuild";

try {
  await build({
    entryPoints: ["src/index.ts"],
    outfile: "dist/index.js",
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node22",
    external: ["@modelcontextprotocol/sdk", "@modelcontextprotocol/sdk/*"],
    logLevel: "warning",
  });
} catch (error) {
  console.error(error);
  process.exit(1);
}
