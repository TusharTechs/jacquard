// Property 8: Idle hooks never lift.
// Feature: weave-engine, Property 8: Idle hooks never lift
// **Validates: Requirements 2.4**

import * as fc from "fast-check";
import { describe, it } from "vitest";

import { buildLiftPlan } from "../src/lift-plan.js";

import { validInputArb } from "./arbitraries.js";

describe("Property 8: Idle hooks never lift (2.4)", () => {
  it("with repeat off, idleHooks is [W .. hookCount - 1] and every idle hook is unlifted on every pick", () => {
    fc.assert(
      fc.property(validInputArb({ allowRepeat: false }), (input) => {
        const result = buildLiftPlan({ ...input, repeatAcross: false });
        if (!result.ok) throw new Error(`buildLiftPlan failed: ${result.error.code}`);
        const { plan, idleHooks } = result.value;
        const width = input.design[0]!.length;
        const hookCount = input.profile.hookCount;

        const expected = Array.from({ length: hookCount - width }, (_, index) => width + index);
        if (JSON.stringify(idleHooks) !== JSON.stringify(expected)) {
          throw new Error(`idleHooks ${JSON.stringify(idleHooks)} != ${JSON.stringify(expected)}`);
        }
        for (const hook of idleHooks) {
          for (let pick = 0; pick < plan.pickCount; pick += 1) {
            if (plan.lifts[pick]![hook] !== false) {
              throw new Error(`idle hook ${hook} lifted on pick ${pick}`);
            }
          }
        }
      }),
      { numRuns: 300 },
    );
  });

  it("when width equals hookCount, idleHooks is empty", () => {
    fc.assert(
      fc.property(
        validInputArb({ allowRepeat: false }).map((input) => {
          const hookCount = input.profile.hookCount;
          const design = input.design.map((row) =>
            Array.from({ length: hookCount }, (_, end) => row[end % row.length]!),
          );
          return { ...input, design };
        }),
        (input) => {
          const result = buildLiftPlan({ ...input, repeatAcross: false });
          if (!result.ok) throw new Error(`buildLiftPlan failed: ${result.error.code}`);
          if (result.value.idleHooks.length !== 0) {
            throw new Error(`idleHooks not empty: ${JSON.stringify(result.value.idleHooks)}`);
          }
        },
      ),
      { numRuns: 200 },
    );
  });
});
