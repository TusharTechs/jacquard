// Property 29: Auto-fix keeps repeat-across plans periodic.
// Feature: weave-engine, Property 29: Auto-fix keeps repeat-across plans periodic
// **Validates: Requirements 5.6**

import * as fc from "fast-check";
import { describe, expect, it } from "vitest";

import { autoFix } from "../src/auto-fix.js"; // not exported from index until task 12.1

import { liftPlanArb, liftPlanFromDesignArb } from "./arbitraries.js";
import type { PlanCase } from "./arbitraries.js";

const NUM_RUNS = 300;

// Only repeat-ready plans (repeatAcross on, designWidth divides hookCount).
const repeatOnly = (arb: fc.Arbitrary<PlanCase>): fc.Arbitrary<PlanCase> =>
  arb.filter((c) => c.repeatAcross);

function runProperty(arb: fc.Arbitrary<PlanCase>): { ok: number; stuck: number; narrow: number } {
  const counts = { ok: 0, stuck: 0, narrow: 0 };
  // fast-check reports the seed, path and shrunk counterexample on failure.
  fc.assert(
    fc.property(arb, ({ plan, profile }) => {
      const result = autoFix(plan, profile);
      if (!result.ok) {
        if (result.error.code !== "AUTOFIX_FAILED") {
          throw new Error(`unexpected error ${result.error.code}`);
        }
        counts.stuck += 1;
        return;
      }
      counts.ok += 1;
      const out = result.value.plan;
      expect(out.repeatAcross).toBe(true);
      const width = out.designWidth;
      if (width < out.hookCount) counts.narrow += 1;
      for (let pick = 0; pick < out.pickCount; pick += 1) {
        const row = out.lifts[pick] as readonly boolean[];
        for (let hook = 0; hook < out.hookCount; hook += 1) {
          expect(row[hook], `pick ${pick} hook ${hook} width ${width}`).toBe(row[hook % width]);
        }
      }
    }),
    { numRuns: NUM_RUNS, verbose: true },
  );
  return counts;
}

describe("Property 29: Auto-fix keeps repeat-across plans periodic (5.6)", () => {
  it("lifts[p][h] = lifts[p][h mod W] whenever autoFix succeeds (random lift plans)", () => {
    const { ok, stuck, narrow } = runProperty(repeatOnly(liftPlanArb()));
    expect(ok, `successes ${ok}, AUTOFIX_FAILED ${stuck}`).toBeGreaterThanOrEqual(NUM_RUNS * 0.2);
    expect(narrow, `successes with width < hookCount: ${narrow}`).toBeGreaterThan(0);
  });

  it("lifts[p][h] = lifts[p][h mod W] whenever autoFix succeeds (plans built from designs)", () => {
    const { ok, stuck, narrow } = runProperty(repeatOnly(liftPlanFromDesignArb()));
    expect(ok, `successes ${ok}, AUTOFIX_FAILED ${stuck}`).toBeGreaterThanOrEqual(NUM_RUNS * 0.2);
    expect(narrow, `successes with width < hookCount: ${narrow}`).toBeGreaterThan(0);
  });
});
