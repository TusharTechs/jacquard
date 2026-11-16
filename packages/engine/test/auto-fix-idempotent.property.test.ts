// Property 26: Auto-fix is idempotent.
// Feature: weave-engine, Property 26: Auto-fix is idempotent
// **Validates: Requirements 5.3**

import * as fc from "fast-check";
import { describe, expect, it } from "vitest";

import { autoFix } from "../src/auto-fix.js"; // not exported from index until task 12.1
import type { LiftPlan } from "../src/types.js";

import { liftPlanArb, liftPlanFromDesignArb, type PlanCase } from "./arbitraries.js";

const NUM_RUNS = 300;

/** Runs the property; a first autoFix that fails (AUTOFIX_FAILED) is skipped. Returns the count tested. */
function runIdempotent(arb: fc.Arbitrary<PlanCase>): number {
  let tested = 0;
  fc.assert(
    fc.property(arb, ({ plan, profile }) => {
      const first = autoFix(plan, profile);
      if (!first.ok) return;
      tested += 1;
      const fixed: LiftPlan = first.value.plan;
      const snapshot = JSON.parse(JSON.stringify(fixed)) as LiftPlan;
      const second = autoFix(fixed, profile);
      if (!second.ok) throw new Error(`second autoFix failed: ${second.error.code}`);
      expect(second.value.flips).toEqual([]);
      expect(second.value.plan).toEqual(snapshot);
    }),
    { numRuns: NUM_RUNS },
  );
  return tested;
}

describe("Property 26: Auto-fix is idempotent (5.3)", () => {
  it("autoFix(autoFix(x).plan) is the same plan with no flips (random lift plans)", () => {
    const tested = runIdempotent(liftPlanArb());
    expect(tested, `successful first fixes ${tested}`).toBeGreaterThanOrEqual(NUM_RUNS * 0.2);
  });

  it("autoFix(autoFix(x).plan) is the same plan with no flips (plans built from designs)", () => {
    const tested = runIdempotent(liftPlanFromDesignArb());
    expect(tested, `successful first fixes ${tested}`).toBeGreaterThanOrEqual(NUM_RUNS * 0.2);
  });
});
