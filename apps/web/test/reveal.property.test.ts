// Feature: studio-experience, Property 5: The motif reveal places every cell once
// For any ends, picks and elapsed times: revealOrder is a permutation of the ends × picks cells in
// pick-major order from pick 0; revealedCount is non-decreasing in elapsed time, 0 at the start and
// ends × picks at the duration or later.
// Validates: Requirements 11.1, 11.5
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { REVEAL_MS, revealOrder, revealedCount } from "../src/lib/reveal";

const SEED = 6505;
const NUM_RUNS = 100;

describe("Feature: studio-experience, Property 5: The motif reveal places every cell once", () => {
  it("places every cell once, in weaving order, and finishes on time", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 120 }),
        fc.integer({ min: 0, max: 120 }),
        fc.array(fc.double({ min: -100, max: REVEAL_MS * 2, noNaN: true }), { maxLength: 20 }),
        fc.integer({ min: 1, max: 5000 }),
        (ends, picks, times, duration) => {
          const order = revealOrder(ends, picks);
          const total = ends * picks;
          expect(order.length).toBe(total);
          const seen = new Set<number>();
          let previous = -1;
          for (const cell of order) {
            expect(cell).toBeGreaterThanOrEqual(0);
            expect(cell).toBeLessThan(total);
            seen.add(cell);
            // Pick-major from pick 0: pick = floor(cell / ends) never goes down, and within a pick the end rises.
            expect(cell).toBeGreaterThan(previous);
            previous = cell;
          }
          expect(seen.size).toBe(total);
          expect(revealedCount(0, total, duration)).toBe(0);
          expect(revealedCount(duration, total, duration)).toBe(total);
          expect(revealedCount(duration + 1, total, duration)).toBe(total);
          let last = -1;
          for (const t of [...times].sort((a, b) => a - b)) {
            const count = revealedCount(t, total, duration);
            expect(Number.isInteger(count)).toBe(true);
            expect(count).toBeGreaterThanOrEqual(Math.max(0, last));
            expect(count).toBeLessThanOrEqual(total);
            last = count;
          }
        },
      ),
      { seed: SEED, numRuns: NUM_RUNS, verbose: 1 },
    );
  });
});
