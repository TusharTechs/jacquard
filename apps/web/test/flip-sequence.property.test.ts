// Feature: studio-experience, Property 6: Auto-fix placement shows the engine's flips in order
// For the engine's autoFix output on random plans: one schedule entry per flip in the engine's
// order, start times non-decreasing and inside the duration, the flips shown at any time are a
// prefix of the engine's list, and all are shown at the duration.
// Validates: Requirements 11.3
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { FLIP_MS, flipSchedule, flipsShownAt } from "../src/lib/flip-sequence";
import { fixDesign } from "../src/lib/engine-check";
import { flipCells } from "../src/lib/violation-marks";
import { loomCaseArb } from "./loom-arbitraries";

const SEED = 6606;
const NUM_RUNS = 100;
const TIMEOUT_MS = NUM_RUNS * 300;

describe("Feature: studio-experience, Property 6: Auto-fix placement shows the engine's flips in order", () => {
  it(
    "schedules the engine's flips in order and shows a growing prefix",
    () => {
      let withFlips = 0;
      fc.assert(
        fc.property(loomCaseArb, fc.array(fc.double({ min: -50, max: FLIP_MS * 1.5, noNaN: true }), { maxLength: 16 }), ({ plan, profile }, times) => {
          const fixed = fixDesign(plan, profile);
          if (!fixed.ok) return; // AUTOFIX_FAILED: nothing is placed.
          if (fixed.flips.length > 0) withFlips += 1;
          // The point paper shows the flips as cells of the design repeat, in the engine's order.
          const ordered = [...flipCells(fixed.flips, plan.designWidth, plan.pickCount)];
          const schedule = flipSchedule(ordered.length);
          expect(schedule).toHaveLength(ordered.length);
          for (let index = 0; index < schedule.length; index += 1) {
            expect(schedule[index]).toBeGreaterThanOrEqual(0);
            expect(schedule[index]).toBeLessThan(FLIP_MS);
            if (index > 0) expect(schedule[index]).toBeGreaterThanOrEqual(schedule[index - 1]!);
          }
          // The cell keys keep the engine's first-seen order.
          const firstSeen: string[] = [];
          for (const flip of fixed.flips) {
            const key = `${flip.pick % plan.pickCount},${flip.end % plan.designWidth}`;
            if (!firstSeen.includes(key)) firstSeen.push(key);
          }
          expect(ordered).toEqual(firstSeen);
          let last = 0;
          for (const t of [...times].sort((a, b) => a - b)) {
            const shown = flipsShownAt(schedule, t);
            expect(shown).toBeGreaterThanOrEqual(last);
            expect(shown).toBeLessThanOrEqual(ordered.length);
            last = shown;
          }
          expect(flipsShownAt(schedule, FLIP_MS)).toBe(ordered.length);
          expect(flipsShownAt(schedule, -1)).toBe(0);
        }),
        { seed: SEED, numRuns: NUM_RUNS, verbose: 1 },
      );
      // Not vacuous: a real share of the generated plans needed auto-fix.
      expect(withFlips).toBeGreaterThanOrEqual(NUM_RUNS / 5);
    },
    TIMEOUT_MS,
  );
});
