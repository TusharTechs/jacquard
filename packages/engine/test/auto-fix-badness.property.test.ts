// Property 33: Badness strictly decreases with every flip.
// Feature: weave-engine, Property 33: Badness strictly decreases with every flip
// **Validates: Requirements 5.1, 5.8**

import * as fc from "fast-check";
import { describe, it } from "vitest";

import { autoFix } from "../src/auto-fix.js"; // not exported from index until task 12.1
import { checkFloats } from "../src/index.js";
import type { LiftPlan, LoomProfile } from "../src/types.js";

import { liftPlanArb } from "./arbitraries.js";

/** Badness from checkFloats output only (design, Auto-fix, Badness). */
function badnessOf(plan: LiftPlan, profile: LoomProfile): number {
  const result = checkFloats(plan, profile);
  if (!result.ok) throw new Error(`checkFloats failed: ${result.error.code}`);
  let total = 0;
  for (const violation of result.value) {
    const limit = violation.direction === "warp" ? profile.maxWarpFloat : profile.maxWeftFloat;
    total += violation.kind === "float" ? violation.length - limit : Math.max(1, violation.length - limit);
  }
  return total;
}

/** Flips one design cell in a copy of the plan, in every tile copy with repeatAcross. */
function applyFlip(plan: LiftPlan, pick: number, end: number): LiftPlan {
  const lifts = plan.lifts.map((row) => row.slice());
  const row = lifts[pick] as boolean[];
  const step = plan.designWidth;
  const last = plan.repeatAcross ? plan.hookCount : step;
  for (let hook = end; hook < last; hook += step) row[hook] = !(row[hook] as boolean);
  return { ...plan, lifts };
}

describe("Property 33: Badness strictly decreases with every flip (5.1, 5.8)", () => {
  it("each replayed flip lowers B, B ends at 0, and every default-limit failure is 'stuck'", () => {
    fc.assert(
      fc.property(liftPlanArb(), ({ plan, profile }) => {
        const result = autoFix(plan, profile);
        if (!result.ok) {
          if (result.error.code !== "AUTOFIX_FAILED") {
            throw new Error(`unexpected error ${result.error.code}`);
          }
          if (result.error.reason !== "stuck") {
            throw new Error(`AUTOFIX_FAILED reason ${result.error.reason}, expected "stuck"`);
          }
          return;
        }
        let current = plan;
        let previous = badnessOf(current, profile);
        const trace = [previous];
        for (const flip of result.value.flips) {
          current = applyFlip(current, flip.pick, flip.end);
          const next = badnessOf(current, profile);
          trace.push(next);
          if (!(next < previous)) {
            throw new Error(
              `badness did not decrease at flip ${JSON.stringify(flip)}: trace ${trace.join(" -> ")}`,
            );
          }
          previous = next;
        }
        if (previous !== 0) throw new Error(`badness ends at ${previous}, expected 0: ${trace.join(" -> ")}`);
      }),
      { numRuns: 500, verbose: true },
    );
  });
});
