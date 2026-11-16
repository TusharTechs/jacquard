// Package and dependency smoke tests (13.1, 13.2, 13.4, 13.5, 13.8, 14.9).
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(here, "..");
const workspaceRoot = join(packageRoot, "..", "..");

function readJson(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
}

function listTs(folder: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(folder, { withFileTypes: true })) {
    const path = join(folder, entry.name);
    if (entry.isDirectory()) out.push(...listTs(path));
    else if (entry.name.endsWith(".ts")) out.push(path);
  }
  return out;
}

const pkg = readJson(join(packageRoot, "package.json"));
const deps = (pkg["dependencies"] ?? {}) as Record<string, string>;
const scripts = (pkg["scripts"] ?? {}) as Record<string, string>;

describe("package.json", () => {
  it("is @jacquard/mcp and depends on the engine through the workspace protocol (13.1)", () => {
    expect(pkg["name"]).toBe("@jacquard/mcp");
    expect(deps["@jacquard/engine"]).toBe("workspace:*");
  });

  it("pins every other dependency exactly, with the SDK at 1.32.2 (13.4, 14.9)", () => {
    for (const [name, version] of Object.entries(deps)) {
      if (name === "@jacquard/engine") continue;
      expect(version, name).toMatch(/^[0-9]+(\.[0-9]+)*$/);
    }
    expect(deps["@modelcontextprotocol/sdk"]).toBe("1.32.2");
  });

  it("does not declare zod, and no source or test file imports it", () => {
    expect(deps["zod"]).toBeUndefined();
    for (const file of [...listTs(join(packageRoot, "src")), ...listTs(here)]) {
      const text = readFileSync(file, "utf8");
      expect(/from\s+["']zod["']|import\(\s*["']zod["']/.test(text), file).toBe(false);
    }
  });

  it("records SDK 1.32.2 in the lockfile, and it is the only lockfile (13.4)", () => {
    const lock = readFileSync(join(workspaceRoot, "pnpm-lock.yaml"), "utf8");
    expect(lock).toContain("'@modelcontextprotocol/sdk@1.32.2'");
    const roots = readdirSync(workspaceRoot);
    expect(roots).not.toContain("package-lock.json");
    expect(roots).not.toContain("yarn.lock");
  });

  it("defines typecheck, test and a pretest build (13.5, 13.8)", () => {
    expect(scripts["typecheck"]).toBeTruthy();
    expect(scripts["test"]).toBeTruthy();
    expect(scripts["pretest"]).toContain("build");
  });

  it("leaves the engine without runtime dependencies or a dependency on mcp (13.2)", () => {
    const engine = readJson(join(workspaceRoot, "packages", "engine", "package.json"));
    const engineDeps = (engine["dependencies"] ?? {}) as Record<string, string>;
    expect(Object.keys(engineDeps)).toHaveLength(0);
    for (const field of ["dependencies", "devDependencies", "peerDependencies"]) {
      const entries = (engine[field] ?? {}) as Record<string, string>;
      expect(entries["@jacquard/mcp"], field).toBeUndefined();
    }
  });
});
