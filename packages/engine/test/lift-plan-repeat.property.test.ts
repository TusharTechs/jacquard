// Property 9: Repeat across tiles the design.
// Feature: weave-engine, Property 9: Repeat across tiles the design
// **Validates: Requirements 2.5, 2.6**

import * as fc from "fast-check";
import { describe, it } from "vitest";

import { buildLiftPlan } from "../src/lift-plan.js";

import { validInputArb } from "./arbitraries.js";

describe("Property 9: Repeat across tiles the design (2.5, 2.6)", () => {
  it("with repeat on, lifts[p][h] = lifts[p][h mod W] for every hook and idleHooks is empty", () => {
    fc.assert(
      fc.property(
        validInputArb().filter((input) => input.repeatAcross),
        (input) => {
          const result = buildLiftPlan({ ...input, repeatAcross: true });
          if (!result.ok) throw new Error(`buildLiftPlan failed: ${result.error.code}`);
          const { plan, idleHooks } = result.value;
          const width = input.design[0]!.length;
          if (idleHooks.length !== 0) {
            throw new Error(`idleHooks not empty: ${JSON.stringify(idleHooks)}`);
          }
          for (let pick = 0; pick < plan.pickCount; pick += 1) {
            const row = plan.lifts[pick]!;
            if (row.length !== input.profile.hookCount) throw new Error(`row ${pick} length ${row.length}`);
            for (let hook = 0; hook < row.length; hook += 1) {
              if (row[hook] !== row[hook % width]) {
                throw new Error(`pick ${pick}: lifts[${hook}] != lifts[${hook % width}]`);
              }
            }
          }
        },
      ),
      { numRuns: 300 },
    );
  });

  it("with repeat on and hookCount mod W != 0, the result is REPEAT_NOT_DIVISIBLE with width and hookCount", () => {
    fc.assert(
      fc.property(
        validInputArb({ minHooks: 3, allowRepeat: false }).filter(
          (input) => input.profile.hookCount % input.design[0]!.length !== 0,
        ),
        (input) => {
          const result = buildLiftPlan({ ...input, repeatAcross: true });
          if (result.ok) throw new Error("expected REPEAT_NOT_DIVISIBLE, got ok");
          const error = result.error;
          if (error.code !== "REPEAT_NOT_DIVISIBLE") throw new Error(`got ${error.code}`);
          const width = input.design[0]!.length;
          if (error.width !== width || error.hookCount !== input.profile.hookCount) {
            throw new Error(`fields ${JSON.stringify(error)}`);
          }
        },
      ),
      { numRuns: 300 },
    );
  });
});
