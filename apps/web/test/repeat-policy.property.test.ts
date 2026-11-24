// Feature: studio-experience, Property 8: Repeat follows the design until the user chooses
// For any sequence of arrivals, reshapes (profile or width) and user choices: while no choice has
// been made since the last arrival, repeatAcross equals repeatFits(ends, hookCount) for the latest
// shape; after a choice it equals that choice until the next arrival, whatever the reshapes.
// Validates: Requirements 17.1, 17.2
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { repeatFits, repeatPolicy } from "../src/lib/repeat-policy";
import type { RepeatEvent, RepeatPolicy } from "../src/lib/repeat-policy";

const SEED = 6808;
const NUM_RUNS = 100;

const shape = fc.record({ ends: fc.integer({ min: 1, max: 400 }), hookCount: fc.constantFrom(120, 240, 400) });
const eventArb: fc.Arbitrary<RepeatEvent> = fc.oneof(
  shape.map(({ ends, hookCount }): RepeatEvent => ({ type: "arrive", ends, hookCount })),
  shape.map(({ ends, hookCount }): RepeatEvent => ({ type: "reshape", ends, hookCount })),
  fc.boolean().map((repeatAcross): RepeatEvent => ({ type: "choose", repeatAcross })),
);

describe("Feature: studio-experience, Property 8: Repeat follows the design until the user chooses", () => {
  it("matches a simple model of arrivals, reshapes and choices", () => {
    fc.assert(
      fc.property(fc.boolean(), fc.array(eventArb, { maxLength: 30 }), (start, events) => {
        let state: RepeatPolicy = { repeatAcross: start, chosen: false };
        // Model: the last choice since the last arrival, else the latest shape's fit.
        let choice: boolean | null = null;
        let expected = start;
        for (const event of events) {
          state = repeatPolicy(state, event);
          if (event.type === "arrive") {
            choice = null;
            expected = repeatFits(event.ends, event.hookCount);
          } else if (event.type === "choose") {
            choice = event.repeatAcross;
            expected = event.repeatAcross;
          } else if (choice === null) {
            expected = repeatFits(event.ends, event.hookCount);
          }
          expect(state.repeatAcross).toBe(expected);
          expect(state.chosen).toBe(choice !== null);
        }
      }),
      { seed: SEED, numRuns: NUM_RUNS, verbose: 1 },
    );
  });

  it("fits means a whole number of repeats", () => {
    expect([repeatFits(48, 240), repeatFits(40, 240), repeatFits(50, 400), repeatFits(24, 120)]).toEqual([true, true, true, true]);
    expect([repeatFits(48, 120), repeatFits(0, 240), repeatFits(7, 240)]).toEqual([false, false, false]);
  });
});
