// Property 27: Every flip lies in a current violation.
// Feature: weave-engine, Property 27: Every flip lies in a current violation
// **Validates: Requirements 5.4**

import * as fc from "fast-check";
import { describe, expect, it } from "vitest";

import { autoFix } from "../src/auto-fix.js"; // not exported from index until task 12.1
import { checkFloats } from "../src/floats.js";
import type { Flip, LiftPlan, Violation } from "../src/types.js";

import { liftPlanArb, liftPlanFromDesignArb, type PlanCase } from "./arbitraries.js";

const NUM_RUNS = 300;

/** True when the cell (pick, end) lies on the float or unbound line `violation` (ring wrap included). */
function covers(violation: Violation, plan: LiftPlan, flip: Flip): boolean {
  const { pickCount, designWidth } = plan;
  if (violation.kind === "unbound") {
    return violation.direction === "warp" ? violation.line === flip.end : violation.line === flip.pick;
  }
  if (violation.direction === "warp") {
    if (violation.end !== flip.end) return false;
    const offset = (flip.pick - violation.pick + pickCount) % pickCount;
    return offset < violation.length;
  }
  if (violation.pick !== flip.pick) return false;
  const offset = (flip.end - violation.end + designWidth) % designWidth;
  return offset < violation.length;
}

/** Replays the flips on a copy of the plan, tiling each flip across every tile with repeatAcross. */
function runReplay(arb: fc.Arbitrary<PlanCase>): number {
  let tested = 0;
  let flipsChecked = 0;
  fc.assert(
    fc.property(arb, ({ plan, profile }) => {
      const result = autoFix(plan, profile);
      if (!result.ok) return;
      tested += 1;
      const lifts = plan.lifts.map((row) => row.slice());
      const current: LiftPlan = { ...plan, lifts };
      for (const flip of result.value.flips) {
        const violations = checkFloats(current, profile);
        if (!violations.ok) throw new Error(`checkFloats failed: ${violations.error.code}`);
        const inside = violations.value.some((violation) => covers(violation, current, flip));
        expect(inside, `flip (pick ${flip.pick}, end ${flip.end}) is outside every current violation`).toBe(true);
        flipsChecked += 1;
        const ends = plan.repeatAcross ? plan.hookCount / plan.designWidth : 1;
        for (let tile = 0; tile < ends; tile += 1) {
          const row = lifts[flip.pick] as boolean[];
          const hook = flip.end + tile * plan.designWidth;
          row[hook] = !(row[hook] as boolean);
        }
      }
    }),
    { numRuns: NUM_RUNS },
  );
  expect(flipsChecked, `flips checked ${flipsChecked}`).toBeGreaterThan(0);
  return tested;
}

describe("Property 27: Every flip lies in a current violation (5.4)", () => {
  it("each flip is inside a violation of the plan it is applied to (random lift plans)", () => {
    const tested = runReplay(liftPlanArb());
    expect(tested, `successful fixes ${tested}`).toBeGreaterThanOrEqual(NUM_RUNS * 0.2);
  });

  it("each flip is inside a violation of the plan it is applied to (plans built from designs)", () => {
    const tested = runReplay(liftPlanFromDesignArb());
    expect(tested, `successful fixes ${tested}`).toBeGreaterThanOrEqual(NUM_RUNS * 0.2);
  });
});
