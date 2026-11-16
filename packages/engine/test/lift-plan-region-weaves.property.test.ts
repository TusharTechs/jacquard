// Property 7: Lift plan follows region weaves.
// Feature: weave-engine, Property 7: Lift plan follows region weaves
// **Validates: Requirements 2.1, 2.2**

import * as fc from "fast-check";
import { describe, it } from "vitest";

import { buildLiftPlan } from "../src/lift-plan.js";
import type { Weave } from "../src/types.js";
import { evaluateWeave } from "../src/weaves.js";

import { validInputArb, weaveArb } from "./arbitraries.js";

describe("Property 7: Lift plan follows region weaves (2.1, 2.2)", () => {
  it("every analysed cell equals its region's weave at (end, pick)", () => {
    fc.assert(
      fc.property(validInputArb(), (input) => {
        const result = buildLiftPlan(input);
        if (!result.ok) throw new Error(`buildLiftPlan failed: ${result.error.code}`);
        const { plan } = result.value;
        const width = input.design[0]!.length;
        for (let pick = 0; pick < input.design.length; pick += 1) {
          for (let end = 0; end < width; end += 1) {
            const region = input.design[pick]![end]!;
            const expected = evaluateWeave(input.weaves[region] as Weave, end, pick);
            if (plan.lifts[pick]![end] !== expected) {
              throw new Error(`cell (pick ${pick}, end ${end}, region ${region}) differs from its weave`);
            }
          }
        }
      }),
      { numRuns: 300 },
    );
  });

  it("changing the weave of region r changes only cells whose region is r", () => {
    fc.assert(
      fc.property(
        validInputArb(),
        fc.nat(),
        weaveArb,
        (input, regionSeed, replacement) => {
          const region = regionSeed % input.profile.regionLimit;
          const before = buildLiftPlan(input);
          const changedInput = { ...input, weaves: { ...input.weaves, [region]: replacement } };
          const after = buildLiftPlan(changedInput);
          if (!before.ok || !after.ok) throw new Error("buildLiftPlan failed on valid input");
          const width = input.design[0]!.length;
          for (let pick = 0; pick < input.design.length; pick += 1) {
            for (let hook = 0; hook < input.profile.hookCount; hook += 1) {
              // Hooks beyond the width tile the design when repeatAcross is on; they are unlifted otherwise.
              const analysedEnd = hook < width ? hook : input.repeatAcross ? hook % width : -1;
              const cellRegion = analysedEnd >= 0 ? input.design[pick]![analysedEnd]! : -1;
              const a = before.value.plan.lifts[pick]![hook];
              const b = after.value.plan.lifts[pick]![hook];
              if (cellRegion !== region && a !== b) {
                throw new Error(
                  `cell (pick ${pick}, hook ${hook}, region ${cellRegion}) changed when region ${region} changed`,
                );
              }
              if (cellRegion === region && b !== evaluateWeave(replacement, analysedEnd, pick)) {
                throw new Error(`cell (pick ${pick}, hook ${hook}) in region ${region} ignores the new weave`);
              }
            }
          }
        },
      ),
      { numRuns: 300 },
    );
  });
});
