// Property 25: Clean plans are returned unchanged.
// Feature: weave-engine, Property 25: Clean plans are returned unchanged
// **Validates: Requirements 5.2**

import * as fc from "fast-check";
import { describe, expect, it } from "vitest";

import { autoFix } from "../src/auto-fix.js"; // not exported from index until task 12.1
import { checkFloats } from "../src/index.js";
import type { LiftPlan, LoomProfile } from "../src/types.js";

import { liftPlanArb, liftPlanFromDesignArb, type PlanCase } from "./arbitraries.js";

const NUM_RUNS = 300;

/** The plan has no violations under the profile (checkFloats is empty). */
function isClean(plan: LiftPlan, profile: LoomProfile): boolean {
  const floats = checkFloats(plan, profile);
  return floats.ok && floats.value.length === 0;
}

/** The property for one clean plan. */
function expectUnchanged(plan: LiftPlan, profile: LoomProfile): void {
  const snapshot = JSON.parse(JSON.stringify(plan)) as LiftPlan;
  const result = autoFix(plan, profile);
  if (!result.ok) throw new Error(`clean plan rejected: ${result.error.code}`);
  expect(result.value.flips).toEqual([]);
  expect(result.value.plan).toEqual(snapshot);
  expect(plan).toEqual(snapshot);
}

/**
 * Clean plans by construction: the output of a successful autoFix on any generated plan is clean
 * (Property 24). Failed fixes are skipped by mapping them to undefined, not by fc.pre.
 */
function fixedPlanArb(source: fc.Arbitrary<PlanCase>): fc.Arbitrary<PlanCase | undefined> {
  return source.map(({ plan, profile, repeatAcross }) => {
    const result = autoFix(plan, profile);
    return result.ok ? { plan: result.value.plan, profile, repeatAcross } : undefined;
  });
}

function runClean(arb: fc.Arbitrary<PlanCase | undefined>): number {
  let tested = 0;
  fc.assert(
    fc.property(arb, (item) => {
      if (item === undefined || !isClean(item.plan, item.profile)) return;
      tested += 1;
      expectUnchanged(item.plan, item.profile);
    }),
    { numRuns: NUM_RUNS },
  );
  return tested;
}

describe("Property 25: Clean plans are returned unchanged (5.2)", () => {
  it("autoFix returns a clean plan unchanged with no flips (fixed random lift plans)", () => {
    const tested = runClean(fixedPlanArb(liftPlanArb()));
    expect(tested, `clean plans tested ${tested}`).toBeGreaterThanOrEqual(NUM_RUNS * 0.2);
  });

  it("autoFix returns a clean plan unchanged with no flips (fixed plans built from designs)", () => {
    const tested = runClean(fixedPlanArb(liftPlanFromDesignArb()));
    expect(tested, `clean plans tested ${tested}`).toBeGreaterThanOrEqual(NUM_RUNS * 0.2);
  });

  it("autoFix returns a clean plan unchanged with no flips (generated plans that are already clean)", () => {
    const tested = runClean(liftPlanFromDesignArb());
    expect(tested, `clean plans tested ${tested}`).toBeGreaterThanOrEqual(20);
  });
});
