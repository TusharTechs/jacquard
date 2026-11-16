// Feature: motif-input, Property 9: Symmetry
// For any design and Symmetry, applySymmetry returns a design of the same size that is symmetric
// for that Symmetry, equal to applySymmetry of itself, with the source half (low ends for
// mirrorEnds, low picks for mirrorPicks) unchanged; `none` returns an equal design; `mirrorBoth`
// equals `mirrorPicks` of `mirrorEnds`.
// Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { applySymmetry } from "../src/index.js";
import { designArb, symmetryArb } from "./arbitraries.js";
import { copyGrid, isSymmetric } from "./grid.js";

const SEED = 4809;
const NUM_RUNS = 100;

describe("Feature: motif-input, Property 9: Symmetry", () => {
  it("is symmetric, idempotent, keeps the source half and composes as specified", () => {
    fc.assert(
      fc.property(designArb(24, 6), symmetryArb, (design, symmetry) => {
        const input = copyGrid(design);
        const result = applySymmetry(design, symmetry);
        expect(design).toEqual(input);
        const picks = design.length;
        const ends = design[0]!.length;
        expect(result.length).toBe(picks);
        for (const row of result) expect(row.length).toBe(ends);
        expect(isSymmetric(result, symmetry)).toBe(true);
        expect(applySymmetry(result, symmetry)).toEqual(result);
        const endsMirrored = symmetry === "mirrorEnds" || symmetry === "mirrorBoth";
        const picksMirrored = symmetry === "mirrorPicks" || symmetry === "mirrorBoth";
        const endHalf = endsMirrored ? Math.ceil(ends / 2) : ends;
        const pickHalf = picksMirrored ? Math.ceil(picks / 2) : picks;
        for (let pick = 0; pick < pickHalf; pick += 1) {
          for (let end = 0; end < endHalf; end += 1) expect(result[pick]![end]).toBe(design[pick]![end]);
        }
        // 7.1 and 7.2 stated as copies: every target cell comes from its mirror source.
        for (let pick = 0; pick < picks; pick += 1) {
          for (let end = 0; end < ends; end += 1) {
            const sourcePick = picksMirrored && pick >= pickHalf ? picks - 1 - pick : pick;
            const sourceEnd = endsMirrored && end >= endHalf ? ends - 1 - end : end;
            expect(result[pick]![end]).toBe(design[sourcePick]![sourceEnd]);
          }
        }
        if (symmetry === "none") expect(result).toEqual(design);
        if (symmetry === "mirrorBoth") {
          expect(result).toEqual(applySymmetry(applySymmetry(design, "mirrorEnds"), "mirrorPicks"));
        }
      }),
      { seed: SEED, numRuns: NUM_RUNS, verbose: 1 },
    );
  });
});
