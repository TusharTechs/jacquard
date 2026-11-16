// Property 28: Only flipped lift cells change.
// Feature: weave-engine, Property 28: Only flipped lift cells change
// **Validates: Requirements 5.5, 6.3**

import * as fc from "fast-check";
import { describe, expect, it } from "vitest";

import { autoFix } from "../src/auto-fix.js"; // not exported from index until task 12.1
import { buildLiftPlan } from "../src/index.js";
import type { LiftPlan, LoomProfile } from "../src/types.js";

import { liftPlanArb, validInputArb } from "./arbitraries.js";

const NUM_RUNS = 300;

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

/**
 * Checks Property 28 for one plan: the output equals the input with every cell flipped an odd number
 * of times toggled (on every tile copy with repeatAcross), idle hooks stay unlifted, and the input is
 * unchanged. Returns the number of flips seen, or -1 when autoFix failed (nothing to check).
 */
function checkPlan(plan: LiftPlan, profile: LoomProfile): number {
  const snapshot = structuredClone(plan);
  deepFreeze(plan); // a write to the input would throw
  const result = autoFix(plan, profile);
  expect(plan).toEqual(snapshot);
  if (!result.ok) return -1;

  const parity = new Set<string>();
  for (const flip of result.value.flips) {
    const key = `${flip.pick},${flip.end}`;
    if (parity.has(key)) parity.delete(key);
    else parity.add(key);
  }

  const out = result.value.plan;
  expect(out.pickCount).toBe(plan.pickCount);
  expect(out.hookCount).toBe(plan.hookCount);
  expect(out.designWidth).toBe(plan.designWidth);
  expect(out.repeatAcross).toBe(plan.repeatAcross);
  expect(out.lifts.length).toBe(plan.lifts.length);

  for (let pick = 0; pick < plan.pickCount; pick += 1) {
    const before = plan.lifts[pick] as readonly boolean[];
    const after = out.lifts[pick] as readonly boolean[];
    expect(after.length).toBe(before.length);
    for (let hook = 0; hook < plan.hookCount; hook += 1) {
      const inUnit = hook < plan.designWidth;
      const tiled = plan.repeatAcross;
      const idle = !inUnit && !tiled;
      if (idle) {
        expect(after[hook], `idle hook ${hook} pick ${pick} changed`).toBe(before[hook]);
        expect(after[hook], `idle hook ${hook} pick ${pick} is lifted`).toBe(false);
        continue;
      }
      const end = hook % plan.designWidth;
      const flipped = parity.has(`${pick},${end}`);
      expect(after[hook], `pick ${pick} hook ${hook}`).toBe(flipped ? !before[hook] : before[hook]);
    }
  }
  return result.value.flips.length;
}

describe("Property 28: Only flipped lift cells change (5.5, 6.3)", () => {
  it("output differs from the input exactly at odd-flip cells and their tile copies (random lift plans)", () => {
    let tested = 0;
    let flipped = 0;
    fc.assert(
      fc.property(liftPlanArb(), ({ plan, profile }) => {
        const flips = checkPlan(plan, profile);
        if (flips < 0) return;
        tested += 1;
        flipped += flips;
      }),
      { numRuns: NUM_RUNS },
    );
    expect(tested, `successful fixes ${tested}`).toBeGreaterThanOrEqual(NUM_RUNS * 0.2);
    expect(flipped, `flips ${flipped}`).toBeGreaterThan(0);
  });

  it("design and weave assignment stay unchanged, and the plan built from them changes only at flips", () => {
    let tested = 0;
    fc.assert(
      fc.property(validInputArb(), (input) => {
        const designBefore = structuredClone(input.design);
        const weavesBefore = structuredClone(input.weaves);
        deepFreeze(input);
        const built = buildLiftPlan(input);
        if (!built.ok) throw new Error(`valid input rejected: ${built.error.code}`);
        const flips = checkPlan(built.value.plan, input.profile);
        expect(input.design).toEqual(designBefore);
        expect(input.weaves).toEqual(weavesBefore);
        if (flips >= 0) tested += 1;
      }),
      { numRuns: NUM_RUNS },
    );
    expect(tested, `successful fixes ${tested}`).toBeGreaterThanOrEqual(NUM_RUNS * 0.2);
  });
});
