// Feature: motif-input, Property 5: Raster shape and range
// For any parsed motif and repeat (ends and picks 1 to 64), rasterizeMotif returns `picks` rows of
// `ends` cells, every value is an integer from 0 to palette length minus 1, and two calls are
// deeply equal.
// Validates: Requirements 5.1, 5.5
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { parseMotif, rasterizeMotif } from "../src/index.js";
import { motifDocArb, serializeMotif } from "./arbitraries.js";

const SEED = 4805;
const NUM_RUNS = 100;

describe("Feature: motif-input, Property 5: Raster shape and range", () => {
  it("returns repeat-sized grids of palette indices, the same on every call", () => {
    fc.assert(
      fc.property(
        motifDocArb,
        fc.record({ ends: fc.integer({ min: 1, max: 64 }), picks: fc.integer({ min: 1, max: 64 }) }),
        (doc, repeat) => {
          // The colour pool has at most nine colours, so a limit of 16 never rejects.
          const parsed = parseMotif(serializeMotif(doc), 16);
          expect(parsed.ok).toBe(true);
          if (!parsed.ok) return;
          const motif = parsed.value;
          const design = rasterizeMotif(motif, repeat);
          expect(design.length).toBe(repeat.picks);
          for (const row of design) {
            expect(row.length).toBe(repeat.ends);
            for (const value of row) {
              expect(Number.isInteger(value)).toBe(true);
              expect(value).toBeGreaterThanOrEqual(0);
              expect(value).toBeLessThan(motif.palette.length);
            }
          }
          expect(rasterizeMotif(motif, repeat)).toStrictEqual(design);
        },
      ),
      { seed: SEED, numRuns: NUM_RUNS, verbose: 1 },
    );
  });
});
