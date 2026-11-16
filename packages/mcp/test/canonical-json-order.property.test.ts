// Feature: weave-mcp, Property 4: Canonical_JSON is ordered and independent of key order
// Validates: Requirements 11.4, 11.5, 11.7
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { canonicalJson } from "../src/canonical-json.js";

const SEED = 4004;
const NUM_RUNS = 100;

/** Rebuilds every object with its keys inserted in the order given by `order`. */
function reorder(value: unknown, order: (keys: string[]) => string[]): unknown {
  if (Array.isArray(value)) return value.map((item) => reorder(item, order));
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    // defineProperty, not assignment: `out["__proto__"] = v` would set the prototype instead of a key.
    for (const key of order(Object.keys(record))) {
      Object.defineProperty(out, key, {
        value: reorder(record[key], order),
        enumerable: true,
        writable: true,
        configurable: true,
      });
    }
    return out;
  }
  return value;
}

/** Strips string literals, so whitespace inside them is not counted. */
function withoutStrings(text: string): string {
  return text.replace(/"(?:[^"\\]|\\.)*"/g, '""');
}

/** Key order at the top level of an object, read from the text. */
function topLevelKeys(text: string): string[] {
  const keys: string[] = [];
  let depth = 0;
  let i = 0;
  while (i < text.length) {
    const ch = text[i] as string;
    if (ch === '"') {
      let j = i + 1;
      while (text[j] !== '"') j += text[j] === "\\" ? 2 : 1;
      const literal = text.slice(i, j + 1);
      if (depth === 1 && text[j + 1] === ":") keys.push(JSON.parse(literal) as string);
      i = j + 1;
      continue;
    }
    if (ch === "{" || ch === "[") depth += 1;
    if (ch === "}" || ch === "]") depth -= 1;
    i += 1;
  }
  return keys;
}

function everyObjectSorted(value: unknown): boolean {
  if (Array.isArray(value)) return value.every(everyObjectSorted);
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const text = canonicalJson(record);
    const keys = topLevelKeys(text);
    const expected = Object.keys(record).filter((k) => record[k] !== undefined).sort();
    if (JSON.stringify(keys) !== JSON.stringify(expected)) return false;
    return Object.values(record).every(everyObjectSorted);
  }
  return true;
}

describe("Feature: weave-mcp, Property 4: Canonical_JSON is ordered and independent of key order", () => {
  it("gives the same text for any key insertion order, sorted keys, no whitespace, arrays in order", () => {
    fc.assert(
      fc.property(fc.jsonValue(), fc.boolean(), (value, reverse) => {
        const text = canonicalJson(value);
        const shuffled = reorder(value, (keys) => (reverse ? [...keys].reverse() : [...keys].sort().reverse()));
        expect(canonicalJson(shuffled)).toBe(text);
        expect(/\s/.test(withoutStrings(text))).toBe(false);
        expect(everyObjectSorted(value)).toBe(true);
        expect(canonicalJson(value)).toBe(text);
        if (Array.isArray(value)) {
          const parsed = JSON.parse(text) as unknown[];
          parsed.forEach((item, index) => {
            expect(canonicalJson(item)).toBe(canonicalJson(value[index]));
          });
        }
      }),
      { seed: SEED, numRuns: NUM_RUNS, verbose: 1 },
    );
  });
});
