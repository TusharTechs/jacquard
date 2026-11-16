// Source scan for @jacquard/motif (motif-input task 3.13, Requirement 13.1): no DOM, Node or
// network globals, no clock or randomness, and only relative imports in `src`.
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const srcDir = join(dirname(fileURLToPath(import.meta.url)), "..", "src");

/** Removes `//` and block comments, keeping string and template literal contents. */
function stripComments(text: string): string {
  let out = "";
  let i = 0;
  while (i < text.length) {
    const c = text[i]!;
    const next = text[i + 1];
    if (c === "/" && next === "/") {
      while (i < text.length && text[i] !== "\n") i += 1;
      continue;
    }
    if (c === "/" && next === "*") {
      const close = text.indexOf("*/", i + 2);
      i = close === -1 ? text.length : close + 2;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      let j = i + 1;
      while (j < text.length && text[j] !== c) j += text[j] === "\\" ? 2 : 1;
      out += text.slice(i, j + 1);
      i = j + 1;
      continue;
    }
    out += c;
    i += 1;
  }
  return out;
}

const FORBIDDEN: readonly [string, RegExp][] = [
  ["document", /\bdocument\b/],
  ["window", /\bwindow\b/],
  ["globalThis", /\bglobalThis\b/],
  ["process", /\bprocess\b/],
  ["Buffer", /\bBuffer\b/],
  ["require(", /\brequire\s*\(/],
  ["node: import", /["']node:/],
  ["fetch", /\bfetch\b/],
  ["XMLHttpRequest", /\bXMLHttpRequest\b/],
  ["Date", /\bDate\b/],
  ["Math.random", /\bMath\s*\.\s*random\b/],
];

const files = readdirSync(srcDir).filter((name) => name.endsWith(".ts"));

describe("motif src scan (13.1)", () => {
  it("finds the source files", () => {
    expect(files).toContain("index.ts");
    expect(files.length).toBeGreaterThanOrEqual(8);
  });

  for (const file of files) {
    const code = stripComments(readFileSync(join(srcDir, file), "utf8"));

    it(`${file} uses no DOM, Node, network, clock or randomness`, () => {
      for (const [name, pattern] of FORBIDDEN) expect(pattern.test(code), `${file} uses ${name}`).toBe(false);
    });

    it(`${file} imports only relative paths`, () => {
      expect(/\bimport\s*\(/.test(code), `${file} uses a dynamic import`).toBe(false);
      const specifiers = [...code.matchAll(/\b(?:import|export)\b[^;"'`]*?\bfrom\s*["']([^"']+)["']/g)].map((m) => m[1]!);
      const bare = [...code.matchAll(/\bimport\s*["']([^"']+)["']/g)].map((m) => m[1]!);
      for (const specifier of [...specifiers, ...bare]) {
        expect(specifier.startsWith("./") || specifier.startsWith("../"), `${file} imports ${specifier}`).toBe(true);
      }
    });
  }

  it("the comment stripper keeps strings and drops comments", () => {
    expect(stripComments('a // fetch\nb /* window */ "http://x" c')).toBe('a \nb  "http://x" c');
  });
});
