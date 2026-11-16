// Feature: weave-mcp, Property 3: Label_Table agrees with profiles.ts
// Validates: Requirements 2.3
// Reads packages/engine/src/profiles.ts as text (no import). Runs once per field of each built-in
// profile, a fixed finite set, so it has no random generator.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { LABEL_TABLE } from "../src/labels.js";
import type { BuiltInName, FieldLabel } from "../src/labels.js";

const here = dirname(fileURLToPath(import.meta.url));
const profilesPath = join(here, "..", "..", "engine", "src", "profiles.ts");
const source = readFileSync(profilesPath, "utf8");

/** Least certain first. */
const CERTAINTY: readonly FieldLabel[] = ["[to verify]", "[decision]", "[convention]", "[sourced]"];

/** Field lines of one `export const PROFILE_<n>` object literal: field name to comment text. */
function fieldComments(name: BuiltInName): Map<string, string> {
  const start = source.indexOf(`export const PROFILE_${name}`);
  expect(start, `PROFILE_${name} in profiles.ts`).toBeGreaterThanOrEqual(0);
  const end = source.indexOf("});", start);
  const body = source.slice(start, end);
  const out = new Map<string, string>();
  for (const line of body.split("\n")) {
    const match = /^\s+([A-Za-z]+):.*?\/\/(.*)$/.exec(line);
    if (match) out.set(match[1] as string, match[2] as string);
  }
  return out;
}

function leastCertain(comment: string): FieldLabel | undefined {
  const tokens = [...comment.matchAll(/\[(convention|sourced|decision|to verify)\]/g)].map(
    (m) => m[0] as FieldLabel,
  );
  if (tokens.length === 0) return undefined;
  return CERTAINTY.find((label) => tokens.includes(label));
}

const cases: { name: BuiltInName; field: string; comment: string }[] = [];
for (const name of ["120", "240", "400"] as const) {
  for (const [field, comment] of fieldComments(name)) cases.push({ name, field, comment });
}

describe("Feature: weave-mcp, Property 3: Label_Table agrees with profiles.ts", () => {
  it("finds every field of every built-in profile in profiles.ts", () => {
    for (const name of ["120", "240", "400"] as const) {
      const fields = [...fieldComments(name).keys()].sort();
      expect(fields).toEqual(Object.keys(LABEL_TABLE[name]).sort());
    }
  });

  it.each(cases)("PROFILE_$name.$field has the least certain token of its comment", ({ name, field, comment }) => {
    const expected = leastCertain(comment);
    expect(expected, `a label token on PROFILE_${name}.${field}`).toBeDefined();
    expect(LABEL_TABLE[name][field as keyof (typeof LABEL_TABLE)[typeof name]]).toBe(expected);
  });

  it("labels PROFILE_400.cardFillOrder [to verify]", () => {
    expect(LABEL_TABLE["400"].cardFillOrder).toBe("[to verify]");
  });
});
