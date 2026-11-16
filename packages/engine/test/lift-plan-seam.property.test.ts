// Property 10: Seam warnings are exact and non-blocking.
// Feature: weave-engine, Property 10: Seam warnings are exact and non-blocking
// **Validates: Requirements 2.12**

import * as fc from "fast-check";
import { describe, expect, it } from "vitest";

import { buildLiftPlan } from "../src/lift-plan.js";
import type { Weave } from "../src/types.js";
import { evaluateWeave } from "../src/weaves.js";

import { validInputArb } from "./arbitraries.js";

/** Independent period per weave kind: plain 2, twill up + down, satin size. */
function period(weave: Weave): number {
  switch (weave.kind) {
    case "plain":
      return 2;
    case "twill":
      return weave.up + weave.down;
    case "satin":
      return weave.size;
  }
}

describe("Property 10: Seam warnings are exact and non-blocking (2.12)", () => {
  it("warnings equal the independently computed list, and the plan ignores them", () => {
    fc.assert(
      fc.property(validInputArb(), (input) => {
        const result = buildLiftPlan(input);
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        const { plan, idleHooks, warnings } = result.value;

        const pickCount = input.design.length;
        const width = input.design[0]!.length;
        const used = [...new Set(input.design.flat())].sort((a, b) => a - b);
        const expected: unknown[] = [];
        for (const region of used) {
          const p = period(input.weaves[region] as Weave);
          if (pickCount % p !== 0) {
            expected.push({ code: "WEAVE_PERIOD_SEAM", region, period: p, dimension: "picks", size: pickCount });
          }
          if (input.repeatAcross && width % p !== 0) {
            expected.push({ code: "WEAVE_PERIOD_SEAM", region, period: p, dimension: "ends", size: width });
          }
        }
        expect(warnings).toEqual(expected);

        // Non-blocking: the plan is exactly the per-cell weave evaluation, warnings or not.
        const hookCount = input.profile.hookCount;
        expect(plan.lifts.length).toBe(pickCount);
        for (let pick = 0; pick < pickCount; pick += 1) {
          for (let hook = 0; hook < hookCount; hook += 1) {
            const end = hook < width ? hook : input.repeatAcross ? hook % width : -1;
            const want =
              end < 0
                ? false
                : evaluateWeave(input.weaves[input.design[pick]![end]!] as Weave, end, pick);
            if (plan.lifts[pick]![hook] !== want) {
              throw new Error(`cell (pick ${pick}, hook ${hook}) differs from independent evaluation`);
            }
          }
        }
        const expectedIdle: number[] = [];
        if (!input.repeatAcross) for (let hook = width; hook < hookCount; hook += 1) expectedIdle.push(hook);
        expect(idleHooks).toEqual(expectedIdle);
      }),
      { numRuns: 300 },
    );
  });
});
