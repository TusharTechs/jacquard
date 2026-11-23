// Feature: studio-experience, Property 3: Loom time maps to card and phase
// For any model and any finite t (negative and past pickCount included):
// pick = min(floor(clamp(t)), pickCount - 1), cardNumber = pick + 1, Phases follow advance, lift,
// shuttle, beat, settle as the fraction grows, and progress is in [0, 1].
// Validates: Requirements 9.2, 7.2
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { PHASE_ORDER, buildLoomModel, loomFrame } from "../src/lib/loom-model";
import { loomCaseArb } from "./loom-arbitraries";

const SEED = 6303;
const NUM_RUNS = 100;
const TIMEOUT_MS = NUM_RUNS * 300;

describe("Feature: studio-experience, Property 3: Loom time maps to card and phase", () => {
  it(
    "maps any time to the right card and an ordered Phase",
    () => {
      fc.assert(
        fc.property(
          loomCaseArb,
          fc.array(fc.double({ min: -1e6, max: 1e6, noNaN: true }), { minLength: 1, maxLength: 6 }),
          fc.integer({ min: 0, max: 1000 }),
          ({ plan, profile, yarns }, times, seedPick) => {
            const built = buildLoomModel(plan, profile, yarns);
            if (!built.ok) throw new Error(built.error.code);
            const model = built.value;
            for (const t of times) {
              const frame = loomFrame(model, t);
              const clamped = Math.min(plan.pickCount, Math.max(0, t));
              expect(frame.pick).toBe(Math.min(Math.floor(clamped), plan.pickCount - 1));
              expect(frame.cardNumber).toBe(frame.pick + 1);
              expect(frame.progress).toBeGreaterThanOrEqual(0);
              expect(frame.progress).toBeLessThanOrEqual(1);
              expect(frame.rise).toBeGreaterThanOrEqual(0);
              expect(frame.rise).toBeLessThanOrEqual(1);
            }
            // Within one pick, the Phase never goes back as the fraction grows.
            const pick = seedPick % plan.pickCount;
            let last = -1;
            for (let step = 0; step < 100; step += 1) {
              const frame = loomFrame(model, pick + step / 100);
              expect(frame.pick).toBe(pick);
              const index = PHASE_ORDER.indexOf(frame.phase);
              expect(index).toBeGreaterThanOrEqual(last);
              last = index;
            }
            expect(last).toBe(PHASE_ORDER.length - 1);
          },
        ),
        { seed: SEED, numRuns: NUM_RUNS, verbose: 1 },
      );
    },
    TIMEOUT_MS,
  );
});
