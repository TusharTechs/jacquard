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

});

/** Source text with comments removed, so a word in a comment does not count as a use. */
function code(file: string): string {
  return readFileSync(file, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
}

const srcFiles = listTs(join(packageRoot, "src"));
const testFiles = listTs(here);

describe("source scans", () => {
  it("imports the engine only as @jacquard/engine (13.3)", () => {
    for (const file of [...srcFiles, ...testFiles]) {
      const specifiers = [...code(file).matchAll(/(?:from|import)\s*\(?\s*["']([^"']+)["']/g)].map((m) => m[1] as string);
      for (const specifier of specifiers) {
        expect(specifier.includes("@jacquard/engine/"), `${file}: ${specifier}`).toBe(false);
        expect(specifier.includes("engine/src"), `${file}: ${specifier}`).toBe(false);
      }
    }
  });

  it("only engine-api.ts imports engine values (10.3)", () => {
    for (const file of srcFiles) {
      if (file.endsWith("engine-api.ts")) continue;
      const valueImports = [...code(file).matchAll(/import\s+(?!type\b)[^;]*?from\s*["']@jacquard\/engine["']/g)];
      expect(valueImports, file).toEqual([]);
    }
  });

  it("never writes to stdout from src (1.6)", () => {
    for (const file of srcFiles) {
      const text = code(file);
      for (const name of ["console.log", "console.info", "console.debug", "console.warn", "process.stdout"]) {
        expect(text.includes(name), `${file} uses ${name}`).toBe(false);
      }
    }
  });

  it("uses no clock, randomness, environment, locale, filesystem or network in src (11.3, 12.1 to 12.3)", () => {
    const forbidden = [
      /\bDate\b/,
      /Math\.random/,
      /process\.env/,
      /\bIntl\b/,
      /toLocale/,
      /\bfetch\s*\(/,
      /["']node:(fs|net|http|https|child_process|dgram|tls)["']/,
      /["'](fs|net|http|https|child_process|dgram|tls)["']/,
    ];
    for (const file of srcFiles) {
      const text = code(file);
      for (const pattern of forbidden) expect(pattern.test(text), `${file} matches ${pattern}`).toBe(false);
    }
  });
});

describe("engine package", () => {
  it("has no runtime dependencies and no dependency on mcp (13.2)", () => {
    const engine = readJson(join(workspaceRoot, "packages", "engine", "package.json"));
    const engineDeps = (engine["dependencies"] ?? {}) as Record<string, string>;
    expect(Object.keys(engineDeps)).toHaveLength(0);
    for (const field of ["dependencies", "devDependencies", "peerDependencies"]) {
      const entries = (engine[field] ?? {}) as Record<string, string>;
      expect(entries["@jacquard/mcp"], field).toBeUndefined();
    }
  });
});
