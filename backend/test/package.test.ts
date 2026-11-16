// Package smoke test (motif-input 13.1 to 13.5): exact pins, scripts, layering.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = join(here, "..");
const workspaceRoot = join(here, "..", "..");
const pkg = JSON.parse(readFileSync(join(pkgRoot, "package.json"), "utf8")) as Record<string, Record<string, string> | string>;

describe("package.json", () => {
  it("pins every non-workspace dependency exactly", () => {
    for (const field of ["dependencies", "devDependencies"]) {
      for (const [name, version] of Object.entries((pkg[field] ?? {}) as Record<string, string>)) {
        if (version.startsWith("workspace:")) continue;
        expect(version, `${field} ${name}`).toMatch(/^[0-9]+(\.[0-9]+)*$/);
      }
    }
  });

  it("defines typecheck and test scripts (13.5)", () => {
    const scripts = pkg["scripts"] as Record<string, string>;
    expect(scripts["typecheck"]).toBeTruthy();
    expect(scripts["test"]).toBeTruthy();
  });

  it("leaves the engine with no runtime dependencies (13.2)", () => {
    const engine = JSON.parse(readFileSync(join(workspaceRoot, "packages", "engine", "package.json"), "utf8")) as Record<string, unknown>;
    expect(Object.keys((engine["dependencies"] ?? {}) as object)).toHaveLength(0);
  });
});
