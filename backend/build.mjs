// Bundles the Lambda handler and the local dev server with esbuild (design.md, "Packages").
// The AWS SDK stays external: the Node.js Lambda runtime ships it.
import { build } from "esbuild";

const common = {
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  external: ["@aws-sdk/*"],
  logLevel: "info",
  legalComments: "none",
};

try {
  await build({ ...common, entryPoints: ["src/handler.ts"], outfile: "dist/handler.js" });
  await build({ ...common, entryPoints: ["src/dev-server.ts"], outfile: "dist/dev-server.js" });
} catch (error) {
  console.error(error);
  process.exit(1);
}
