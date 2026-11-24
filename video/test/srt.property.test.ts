// Feature: demo-video, Property 2: SRT round trip
// For any list of ordered, non-overlapping cues with millisecond times under 10 minutes and text
// without blank lines, fromSrt(toSrt(cues)) equals the cues.
// Validates: Requirements 2.6
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { fromSrt, toSrt } from "../src/cues.ts";
import type { Cue } from "../src/cues.ts";

const SEED = 7102;
const NUM_RUNS = 100;

const lineArb = fc.string({ minLength: 1, maxLength: 42, unit: fc.constantFrom(..."abcdefghijklmnopqrstuvwxyz ABCDEFGHIJ.,;:!?'’—-0123456789") }).filter((line) => line.trim() !== "" && !/^\d+$/.test(line.trim()));
const cuesArb: fc.Arbitrary<Cue[]> = fc
  .array(fc.tuple(fc.integer({ min: 0, max: 5000 }), fc.integer({ min: 1, max: 8000 }), fc.array(lineArb, { minLength: 1, maxLength: 2 })), { minLength: 1, maxLength: 60 })
  .map((parts) => {
    let at = 0;
    return parts.map(([gap, length, lines]) => {
      const start = at + gap;
      const end = start + length;
      at = end;
      return { start: start / 1000, end: end / 1000, lines: lines.map((line) => line.trim()) };
    });
  })
  .filter((cues) => cues[cues.length - 1]!.end < 600);

describe("Feature: demo-video, Property 2: SRT round trip", () => {
  it("reads back what it writes", () => {
    fc.assert(
      fc.property(cuesArb, (cues) => {
        expect(fromSrt(toSrt(cues))).toEqual(cues);
      }),
      { seed: SEED, numRuns: NUM_RUNS, verbose: 1 },
    );
  });
});
