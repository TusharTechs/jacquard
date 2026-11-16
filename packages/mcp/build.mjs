// Bundles the server entry with the engine source inlined, so `node dist/index.js` runs under plain
// node (design, Build and entry point). Exits non-zero on failure so `pretest` fails the test run.
//
// `--power` builds the loom Power's server instead (kiro-product design, Power): the same entry with
// the MCP SDK inlined too, so `node power/dist/server.js` runs with no node_modules. `--outfile
// <path>` overrides the output file (used by test/power.test.ts to compare a fresh build with the
// committed file). Paths are resolved from this package folder, and `absWorkingDir` is fixed to it,
// so the output does not depend on the directory the script is run from.
import { build } from "esbuild";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageDir = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const power = args.includes("--power");
const outfileIndex = args.indexOf("--outfile");
const outfileArg = outfileIndex === -1 ? undefined : args[outfileIndex + 1];
if (outfileIndex !== -1 && outfileArg === undefined) {
  console.error("build.mjs: --outfile needs a path");
  process.exit(1);
}

const POWER_BANNER =
  "// loom Power MCP server, bundled from @jacquard/mcp. The card format has not been tested on a working loom.";

const common = {
  absWorkingDir: packageDir,
  entryPoints: [resolve(packageDir, "src/index.ts")],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  logLevel: "warning",
};

const options = power
  ? {
      ...common,
      outfile: outfileArg === undefined ? resolve(packageDir, "../../power/dist/server.js") : resolve(outfileArg),
      external: [],
      legalComments: "none",
      banner: { js: POWER_BANNER },
    }
  : {
      ...common,
      outfile: outfileArg === undefined ? resolve(packageDir, "dist/index.js") : resolve(outfileArg),
      external: ["@modelcontextprotocol/sdk", "@modelcontextprotocol/sdk/*"],
    };

try {
  await build(options);
} catch (error) {
  console.error(error);
  process.exit(1);
}
