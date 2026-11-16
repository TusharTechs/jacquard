// Property 11: Plan validation accepts built plans and rejects corruptions.
// Feature: weave-engine, Property 11: Plan validation accepts built plans and rejects corruptions
// **Validates: Requirements 2.13**

import * as fc from "fast-check";
import { describe, expect, it } from "vitest";

import type { PlanProblem } from "../src/errors.js";
import { validatePlan } from "../src/lift-plan.js";
import type { LiftPlan, LoomProfile } from "../src/types.js";

import { liftPlanFromDesignArb, type PlanCase } from "./arbitraries.js";

const NUM_RUNS = 300;

function cloneLifts(plan: LiftPlan): unknown[][] {
  return plan.lifts.map((row) => [...row]);
}

function withLifts(plan: LiftPlan, lifts: unknown[][]): LiftPlan {
  return { ...plan, lifts: lifts as unknown as boolean[][] };
}

/** Asserts the result is PLAN_INVALID with exactly this problem, pick and hook. */
function expectPlanError(
  plan: LiftPlan,
  profile: LoomProfile,
  problem: PlanProblem,
  pick?: number,
  hook?: number,
): void {
  const result = validatePlan(plan, profile);
  expect(result.ok).toBe(false);
  if (result.ok) return;
  const error = result.error;
  expect(error.code).toBe("PLAN_INVALID");
  if (error.code !== "PLAN_INVALID") return;
  expect(error.problem).toBe(problem);
  expect(error.pick).toBe(pick);
  expect(error.hook).toBe(hook);
}

const planArb = liftPlanFromDesignArb();

describe("Property 11: Plan validation accepts built plans and rejects corruptions (2.13)", () => {
  it("accepts every plan made by buildLiftPlan, unchanged", () => {
    fc.assert(
      fc.property(planArb, ({ plan, profile }: PlanCase) => {
        const before = JSON.stringify(plan);
        const result = validatePlan(plan, profile);
        expect(result.ok).toBe(true);
        if (result.ok) expect(result.value).toBe(plan);
        expect(JSON.stringify(plan)).toBe(before);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("rejects a lifted idle hook with idleLifted at that pick and hook", () => {
    fc.assert(
      fc.property(planArb, fc.nat(), fc.nat(), ({ plan, profile }, a, b) => {
        fc.pre(!plan.repeatAcross && plan.designWidth < plan.hookCount);
        const pick = a % plan.pickCount;
        const idleCount = plan.hookCount - plan.designWidth;
        const hook = plan.designWidth + (b % idleCount);
        const lifts = cloneLifts(plan);
        lifts[pick]![hook] = true;
        expectPlanError(withLifts(plan, lifts), profile, "idleLifted", pick, hook);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("rejects a row of the wrong length with rowLength at that pick", () => {
    fc.assert(
      fc.property(planArb, fc.nat(), fc.boolean(), ({ plan, profile }, a, shorter) => {
        const pick = a % plan.pickCount;
        const lifts = cloneLifts(plan);
        if (shorter) lifts[pick]!.pop();
        else lifts[pick]!.push(false);
        expectPlanError(withLifts(plan, lifts), profile, "rowLength", pick);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("rejects a repeat plan with one flipped tiled cell as notPeriodic", () => {
    fc.assert(
      fc.property(planArb, fc.nat(), fc.nat(), ({ plan, profile }, a, b) => {
        fc.pre(plan.repeatAcross && plan.designWidth < plan.hookCount);
        const pick = a % plan.pickCount;
        const hook = plan.designWidth + (b % (plan.hookCount - plan.designWidth));
        const lifts = cloneLifts(plan);
        lifts[pick]![hook] = !lifts[pick]![hook];
        expectPlanError(withLifts(plan, lifts), profile, "notPeriodic", pick, hook);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("rejects a flipped first-tile cell as notPeriodic at its next tile", () => {
    fc.assert(
      fc.property(planArb, fc.nat(), fc.nat(), ({ plan, profile }, a, b) => {
        fc.pre(plan.repeatAcross && plan.designWidth < plan.hookCount);
        const pick = a % plan.pickCount;
        const source = b % plan.designWidth;
        const lifts = cloneLifts(plan);
        lifts[pick]![source] = !lifts[pick]![source];
        expectPlanError(
          withLifts(plan, lifts),
          profile,
          "notPeriodic",
          pick,
          source + plan.designWidth,
        );
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("rejects pickCount below 1 with noPicks", () => {
    fc.assert(
      fc.property(planArb, fc.constantFrom(0, -1, 1.5, Number.NaN), ({ plan, profile }, bad) => {
        expectPlanError({ ...plan, pickCount: bad }, profile, "noPicks");
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("rejects a missing or extra row with pickCountMismatch", () => {
    fc.assert(
      fc.property(planArb, fc.nat(), fc.boolean(), ({ plan, profile }, a, remove) => {
        const lifts = cloneLifts(plan);
        if (remove) lifts.splice(a % plan.pickCount, 1);
        else lifts.push(Array.from({ length: plan.hookCount }, () => false));
        expectPlanError(withLifts(plan, lifts), profile, "pickCountMismatch");
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("rejects a profile with a different hookCount with hookCountMismatch", () => {
    fc.assert(
      fc.property(planArb, fc.integer({ min: 1, max: 5 }), ({ plan, profile }, delta) => {
        expectPlanError(plan, { ...profile, hookCount: profile.hookCount + delta }, "hookCountMismatch");
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("rejects a non-boolean cell with notBoolean at that pick and hook", () => {
    fc.assert(
      fc.property(
        planArb,
        fc.nat(),
        fc.nat(),
        fc.constantFrom<unknown>(0, 1, "true", null, undefined),
        ({ plan, profile }, a, b, bad) => {
          const pick = a % plan.pickCount;
          const hook = b % plan.hookCount;
          const lifts = cloneLifts(plan);
          lifts[pick]![hook] = bad;
          expectPlanError(withLifts(plan, lifts), profile, "notBoolean", pick, hook);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it("rejects a designWidth outside 1 to hookCount with designWidth", () => {
    fc.assert(
      fc.property(planArb, fc.integer({ min: 1, max: 5 }), fc.boolean(), ({ plan, profile }, delta, low) => {
        const bad = low ? 1 - delta : plan.hookCount + delta;
        expectPlanError({ ...plan, designWidth: bad }, profile, "designWidth");
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("rejects repeatAcross with a width that does not divide hookCount", () => {
    fc.assert(
      fc.property(planArb, fc.nat(), ({ plan, profile }, a) => {
        const widths: number[] = [];
        for (let w = 2; w < plan.hookCount; w += 1) if (plan.hookCount % w !== 0) widths.push(w);
        fc.pre(widths.length > 0);
        const designWidth = widths[a % widths.length]!;
        expectPlanError({ ...plan, designWidth, repeatAcross: true }, profile, "repeatNotDivisible");
      }),
      { numRuns: NUM_RUNS },
    );
  });
});
