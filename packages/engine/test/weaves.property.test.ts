// Property tests for weaves (tasks 5.2 to 5.7): Properties 1 to 6.
// Each runs 200 fast-check cases. On a failure fast-check prints the shrunk counterexample and the
// seed; neither is to be edited away. See design.md, Correctness Properties.

import * as fc from "fast-check";
import { describe, it } from "vitest";

import { evaluateWeave, weavePeriod } from "../src/weaves.js";
import type { Weave } from "../src/types.js";
import { plainArb, satinArb, twillArb, weaveArb } from "./arbitraries.js";
import type { SatinWeave } from "./arbitraries.js";

const RUNS = { numRuns: 200 };
/** Coordinates well beyond one weave period, so every residue class is reached. */
const coordinate = fc.integer({ min: 0, max: 1000 });

/** The period of a weave, worked out here from the glossary, not by calling the engine. */
function expectedPeriod(weave: Weave): number {
  switch (weave.kind) {
    case "plain":
      return 2;
    case "twill":
      return weave.up + weave.down;
    case "satin":
      return weave.size;
  }
}

/** A satin cell is a binding cell when the weave lifts it (weft-faced) or does not lift it (warp-faced). */
function isBindingCell(weave: SatinWeave, end: number, pick: number): boolean {
  const lifted = evaluateWeave(weave, end, pick);
  return weave.facing === "weft" ? lifted : !lifted;
}

describe("weave properties", () => {
  it("Property 1: Weave periodicity (Validates: Requirements 2.3, 2.12)", () => {
    fc.assert(
      fc.property(weaveArb, coordinate, coordinate, (weave, end, pick) => {
        const period = weavePeriod(weave);
        if (period !== expectedPeriod(weave)) return false;
        const here = evaluateWeave(weave, end, pick);
        return (
          here === evaluateWeave(weave, end + period, pick) &&
          here === evaluateWeave(weave, end, pick + period)
        );
      }),
      RUNS,
    );
  });

  it("Property 2: Plain weave alternates (Validates: Requirements 2.3)", () => {
    fc.assert(
      fc.property(plainArb, coordinate, coordinate, (weave, end, pick) => {
        const here = evaluateWeave(weave, end, pick);
        return (
          here !== evaluateWeave(weave, end + 1, pick) &&
          here !== evaluateWeave(weave, end, pick + 1) &&
          evaluateWeave(weave, 0, 0) === true
        );
      }),
      RUNS,
    );
  });

  it("Property 3: Twill ratio and slope (Validates: Requirements 1.6, 2.3)", () => {
    fc.assert(
      fc.property(twillArb, coordinate, coordinate, (weave, end, pick) => {
        const period = weave.up + weave.down;
        // In any `up + down` consecutive ends of one pick, exactly `up` are lifted.
        let lifted = 0;
        for (let offset = 0; offset < period; offset += 1) {
          if (evaluateWeave(weave, end + offset, pick)) lifted += 1;
        }
        if (lifted !== weave.up) return false;
        // Slope: Z is unchanged along (+1 end, +1 pick); S is unchanged along (+1 end, -1 pick).
        const slopeHolds =
          weave.direction === "Z"
            ? evaluateWeave(weave, end + 1, pick + 1) === evaluateWeave(weave, end, pick)
            : evaluateWeave(weave, end, pick + 1) === evaluateWeave(weave, end + 1, pick);
        return slopeHolds && evaluateWeave(weave, 0, 0) === true;
      }),
      RUNS,
    );
  });

  it("Property 4: Satin has one binding cell per line in every window (Validates: Requirements 1.6, 2.3)", () => {
    fc.assert(
      fc.property(satinArb, coordinate, coordinate, (weave, endOffset, pickOffset) => {
        const size = weave.size;
        for (let pick = pickOffset; pick < pickOffset + size; pick += 1) {
          let bindings = 0;
          for (let end = endOffset; end < endOffset + size; end += 1) {
            if (isBindingCell(weave, end, pick)) bindings += 1;
          }
          if (bindings !== 1) return false;
        }
        for (let end = endOffset; end < endOffset + size; end += 1) {
          let bindings = 0;
          for (let pick = pickOffset; pick < pickOffset + size; pick += 1) {
            if (isBindingCell(weave, end, pick)) bindings += 1;
          }
          if (bindings !== 1) return false;
        }
        return true;
      }),
      RUNS,
    );
  });

  it("Property 5: Satin is never a twill (Validates: Requirements 1.6, 1.7)", () => {
    fc.assert(
      fc.property(satinArb, coordinate, (weave, pick) => {
        const size = weave.size;
        const bindingEnd = (atPick: number): number => {
          for (let end = 0; end < size; end += 1) {
            if (isBindingCell(weave, end, atPick)) return end;
          }
          throw new Error("no binding cell in the first period");
        };
        // The binding cells of consecutive picks are never neighbouring ends, modulo the size.
        const step = (bindingEnd(pick + 1) - bindingEnd(pick) + size) % size;
        return step !== 1 && step !== size - 1;
      }),
      RUNS,
    );
  });

  it("Property 6: Satin facings are complements (Validates: Requirements 2.3)", () => {
    fc.assert(
      fc.property(satinArb, coordinate, coordinate, (weave, end, pick) => {
        const warp: Weave = { ...weave, facing: "warp" };
        const weft: Weave = { ...weave, facing: "weft" };
        return evaluateWeave(warp, end, pick) !== evaluateWeave(weft, end, pick);
      }),
      RUNS,
    );
  });
});
