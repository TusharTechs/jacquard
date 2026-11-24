// The Amplify custom headers file (motif-builder 6.1 to 6.4): every security header is there, the
// CSP keeps scripts to this origin only, and index.html is not cached while hashed assets are.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const file = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "scripts", "amplify-custom-headers.yml");
const yaml = readFileSync(file, "utf8");

/** Headers of one pattern block: `key` lines followed by their `value` lines. */
function headersFor(pattern: string): Map<string, string> {
  const start = yaml.indexOf(`- pattern: '${pattern}'`);
  expect(start, pattern).toBeGreaterThanOrEqual(0);
  const next = yaml.indexOf("- pattern:", start + 1);
  const block = yaml.slice(start, next === -1 ? undefined : next);
  const result = new Map<string, string>();
  const pairs = [...block.matchAll(/- key: '([^']+)'\s*\n\s*value: (?:'([^']*)'|"([^"]*)")/g)];
  for (const pair of pairs) result.set(pair[1]!, pair[2] ?? pair[3] ?? "");
  return result;
}

describe("Amplify custom headers", () => {
  const all = headersFor("**");

  it("sends every security header on every path (6.1)", () => {
    expect(all.get("Strict-Transport-Security")).toMatch(/max-age=\d{7,}/);
    expect(all.get("X-Content-Type-Options")).toBe("nosniff");
    expect(all.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(all.get("Permissions-Policy")).toBe("camera=(), microphone=(), geolocation=()");
  });

  it("keeps scripts and connections to this origin only (6.1, 6.4)", () => {
    const csp = all.get("Content-Security-Policy") ?? "";
    const directives = new Map(csp.split(";").map((part) => {
      const [name, ...values] = part.trim().split(/\s+/);
      return [name ?? "", values.join(" ")] as const;
    }));
    expect(directives.get("default-src")).toBe("'self'");
    expect(directives.get("script-src")).toBe("'self'");
    expect(directives.get("connect-src")).toBe("'self'");
    expect(directives.get("object-src")).toBe("'none'");
    expect(csp).not.toMatch(/unsafe-eval|wasm-unsafe-eval|https?:|\*/);
    expect(directives.get("worker-src")).toBe("'self' blob:");
  });

  it("does not cache index.html and keeps hashed assets immutable (6.2)", () => {
    expect(headersFor("/").get("Cache-Control")).toBe("no-cache");
    expect(headersFor("/index.html").get("Cache-Control")).toBe("no-cache");
    expect(headersFor("/assets/*").get("Cache-Control")).toBe("public, max-age=31536000, immutable");
  });
});
