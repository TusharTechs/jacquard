// Property 18: Float checker agrees with a naive oracle.
// Feature: weave-engine, Property 18: Float checker agrees with a naive oracle
// **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5**

import * as fc from "fast-check";
import { describe, it } from "vitest";

import { checkFloats } from "../src/floats.js";

import { liftPlanArb } from "./arbitraries.js";
import { naiveCheckFloats } from "./oracle.js";

describe("Property 18: Float checker agrees with a naive oracle (4.1 to 4.5)", () => {
  it("checkFloats equals the naive oracle for any valid plan and profile", () => {
    fc.assert(
      fc.property(liftPlanArb(), ({ plan, profile }) => {
        const result = checkFloats(plan, profile);
        if (!result.ok) throw new Error(`checkFloats failed: ${result.error.code}`);
        const expected = naiveCheckFloats(plan, profile);
        if (JSON.stringify(result.value) !== JSON.stringify(expected)) {
          throw new Error(
            `mismatch (repeatAcross=${plan.repeatAcross}, wovenFaceDown=${profile.wovenFaceDown}, ` +
              `maxWarpFloat=${profile.maxWarpFloat}, maxWeftFloat=${profile.maxWeftFloat})\n` +
              `actual:   ${JSON.stringify(result.value)}\nexpected: ${JSON.stringify(expected)}`,
          );
        }
      }),
      { numRuns: 500 },
    );
  });
});
