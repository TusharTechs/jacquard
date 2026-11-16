// Example test for golden fixtures (task 11.5). Requirement 5.1.
// Each fixture in test/fixtures is a small gallery-like design whose weaves leave floats over the
// limit. Fixtures are read-only once committed; this test only reads them.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { autoFix, buildLiftPlan, checkFloats, defineProfile } from "../src/index.js";
import type { WeaveAssignment } from "../src/index.js";

interface Fixture {
  readonly name: string;
  readonly hookCount: number;
  readonly maxFloat: number;
  readonly repeatAcross: boolean;
  readonly design: readonly string[];
  readonly weaves: Readonly<Record<string, unknown>>;
}

const FIXTURE_FILES = ["diamond.json", "border-stripe.json", "solid-block.json"] as const;

function loadFixture(file: string): Fixture {
  const url = new URL(`./fixtures/${file}`, import.meta.url);
  return JSON.parse(readFileSync(url, "utf8")) as Fixture;
}

describe("auto-fix golden fixtures (5.1)", () => {
  for (const file of FIXTURE_FILES) {
    const fixture = loadFixture(file);

    it(`${fixture.name}: has float violations before auto-fix and none after`, () => {
      const profile = defineProfile({ hookCount: fixture.hookCount, maxFloat: fixture.maxFloat });
      const design = fixture.design.map((row) => [...row].map(Number));
      const built = buildLiftPlan({
        design,
        weaves: fixture.weaves as unknown as WeaveAssignment,
        profile,
        repeatAcross: fixture.repeatAcross,
      });
      expect(built.ok).toBe(true);
      if (!built.ok) return;

      const before = checkFloats(built.value.plan, profile);
      expect(before.ok).toBe(true);
      if (!before.ok) return;
      expect(before.value.length).toBeGreaterThan(0);

      const fixed = autoFix(built.value.plan, profile);
      expect(fixed.ok).toBe(true);
      if (!fixed.ok) return;
      expect(fixed.value.flips.length).toBeGreaterThan(0);

      const after = checkFloats(fixed.value.plan, profile);
      expect(after).toEqual({ ok: true, value: [] });
    });
  }
});
