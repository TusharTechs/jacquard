// Feature: motif-input, Property 7: Speck removal postconditions
// For any design up to 24 by 24 with up to 6 regions and any Minimum_Feature from 1 to 10, the
// result of removeSpecks has the same size, uses only region indices present in the input,
// contains no 4-connected component smaller than Minimum_Feature unless it is a single component,
// leaves every cell of every input component of size at least Minimum_Feature unchanged, and is
// idempotent. With Minimum_Feature 1 it equals the input.
// Validates: Requirements 6.1, 6.2, 6.4, 6.5, 6.6
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { removeSpecks } from "../src/index.js";
import { designArb } from "./arbitraries.js";
import { componentsOf, copyGrid } from "./grid.js";

const SEED = 4807;
const NUM_RUNS = 100;

describe("Feature: motif-input, Property 7: Speck removal postconditions", () => {
  it("keeps the size and the large components, adds no region, leaves no speck, is idempotent", () => {
    fc.assert(
      fc.property(designArb(24, 6), fc.integer({ min: 1, max: 10 }), (design, minFeature) => {
        const input = copyGrid(design);
        const result = removeSpecks(design, minFeature);
        // Pure: the input is not changed.
        expect(design).toEqual(input);
        // 6.1 same size.
        expect(result.length).toBe(design.length);
        result.forEach((row, pick) => expect(row.length).toBe(design[pick]!.length));
        // 6.4 no new region index.
        const inputRegions = new Set(design.flat());
        for (const value of result.flat()) expect(inputRegions.has(value)).toBe(true);
        // 6.2 no speck unless the result is one component.
        const after = componentsOf(result);
        if (after.length > 1) {
          for (const component of after) {
            expect(component.cells.length, `component of region ${component.region} at ${JSON.stringify(component.cells[0])}`).toBeGreaterThanOrEqual(minFeature);
          }
        }
        // 6.4 cells of input components that are not specks are unchanged.
        for (const component of componentsOf(design)) {
          if (component.cells.length < minFeature) continue;
          for (const [pick, end] of component.cells) expect(result[pick]![end]).toBe(design[pick]![end]);
        }
        // 6.5 idempotent.
        expect(removeSpecks(result, minFeature)).toEqual(result);
        // 6.6 Minimum_Feature 1 is the identity.
        expect(removeSpecks(design, 1)).toEqual(design);
      }),
      { seed: SEED, numRuns: NUM_RUNS, verbose: 1 },
    );
  });
});
