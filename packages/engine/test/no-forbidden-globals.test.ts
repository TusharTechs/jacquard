import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Requirement 6.2: the engine reads no clock, random source, locale,
// environment or network.
const here = dirname(fileURLToPath(import.meta.url));
const srcDir = join(here, "..", "src");
const packageJsonPath = join(here, "..", "package.json");

const FORBIDDEN: ReadonlyArray<{ name: string; pattern: RegExp }> = [
  { name: "Date", pattern: /\bDate\b/ },
  { name: "Math.random", pattern: /\bMath\s*\.\s*random\b/ },
  { name: "Intl", pattern: /\bIntl\b/ },
  { name: "toLocale", pattern: /\btoLocale\w*/ },
  { name: "process", pattern: /\bprocess\b/ },
  { name: "globalThis", pattern: /\bglobalThis\b/ },
  { name: "fetch", pattern: /\bfetch\b/ },
];

function listSourceFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...listSourceFiles(full));
    else if (entry.isFile()) files.push(full);
  }
  return files.sort();
}

describe("engine purity (Requirement 6.2)", () => {
  const files = listSourceFiles(srcDir);

  it("finds source files to scan", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it("uses no clock, random, locale, environment or network names in src/", () => {
    const hits: string[] = [];
    for (const file of files) {
      const lines = readFileSync(file, "utf8").split("\n");
      lines.forEach((line, index) => {
        for (const { name, pattern } of FORBIDDEN) {
          if (pattern.test(line)) {
            hits.push(`${file}:${index + 1} uses ${name}`);
          }
        }
      });
    }
    expect(hits).toEqual([]);
  });

  it("declares no runtime dependencies in package.json", () => {
    const pkg = JSON.parse(readFileSync(packageJsonPath, "utf8")) as Record<
      string,
      unknown
    >;
    expect("dependencies" in pkg).toBe(false);
  });
});
