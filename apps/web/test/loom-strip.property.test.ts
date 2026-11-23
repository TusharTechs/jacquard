// Feature: studio-experience, Property 4: The card strip follows the lacing chain
// For any pickCount, pick, before and after: cardStrip returns min(before + 1 + after, pickCount)
// distinct indices, pick is among them at position min(before, length - 1), and each index is the
// engine's nextCard of the one before it.
// Validates: Requirements 9.6, 6.4, 12.2
import * as fc from "fast-check";
import { nextCard } from "@jacquard/engine";
import { describe, expect, it } from "vitest";
import { cardStrip } from "../src/lib/loom-model";

const SEED = 6404;
const NUM_RUNS = 100;

describe("Feature: studio-experience, Property 4: The card strip follows the lacing chain", () => {
  it("lists neighbouring cards in lacing order, wrapping round", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 500 }).chain((pickCount) =>
          fc.tuple(fc.constant(pickCount), fc.integer({ min: 0, max: pickCount - 1 }), fc.integer({ min: 0, max: 30 }), fc.integer({ min: 0, max: 30 })),
        ),
        ([pickCount, pick, before, after]) => {
          const strip = cardStrip(pickCount, pick, before, after);
          const length = Math.min(before + 1 + after, pickCount);
          expect(strip).toHaveLength(length);
          expect(new Set(strip).size).toBe(length);
          expect(strip[Math.min(before, length - 1)]).toBe(pick);
          for (let index = 1; index < strip.length; index += 1) {
            expect(strip[index]).toBe(nextCard(strip[index - 1]!, pickCount));
          }
        },
      ),
      { seed: SEED, numRuns: NUM_RUNS, verbose: 1 },
    );
  });

  it("is empty without cards", () => {
    expect(cardStrip(0, 0, 3, 3)).toEqual([]);
  });
});
