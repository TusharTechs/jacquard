// Writes the gallery (kiro-product 2.1, 2.3): bundles generate.ts with esbuild to a temporary file,
// imports it and writes every file under apps/web/public/gallery/. With `--check` it compares
// instead of writing, lists every difference and exits 1 if there is any.
import { build } from "esbuild";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..", "..");
const galleryDir = join(root, "apps", "web", "public", "gallery");
const check = process.argv.slice(2).includes("--check");

const temp = mkdtempSync(join(tmpdir(), "jacquard-gallery-"));
let exitCode = 0;
try {
  const outfile = join(temp, "generate.mjs");
  await build({
    absWorkingDir: root,
    entryPoints: [join(here, "generate.ts")],
    outfile,
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node22",
    logLevel: "warning",
  });
  const { buildGallery } = await import(pathToFileURL(outfile).href);
  const files = buildGallery();
  if (check) {
    const problems = [];
    const expected = new Set(files.map((file) => file.path));
    for (const file of files) {
      const path = join(galleryDir, file.path);
      if (!existsSync(path)) problems.push(`missing: ${file.path}`);
      else if (readFileSync(path, "utf8") !== file.text) problems.push(`differs: ${file.path}`);
    }
    if (existsSync(galleryDir)) {
      for (const name of readdirSync(galleryDir)) {
        if (name.endsWith(".json") && !expected.has(name)) problems.push(`not produced by the generator: ${name}`);
      }
    }
    if (problems.length > 0) {
      for (const problem of problems) console.error(`gallery --check: ${problem}`);
      console.error("Run `pnpm gallery` to regenerate.");
      exitCode = 1;
    } else {
      console.error(`gallery --check: ${files.length} files match`);
    }
  } else {
    mkdirSync(galleryDir, { recursive: true });
    for (const file of files) writeFileSync(join(galleryDir, file.path), file.text);
    console.error(`gallery: wrote ${files.length} files to apps/web/public/gallery`);
  }
} catch (error) {
  console.error(error);
  exitCode = 1;
} finally {
  rmSync(temp, { recursive: true, force: true });
}
process.exit(exitCode);
