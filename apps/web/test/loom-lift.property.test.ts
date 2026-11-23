// Feature: studio-experience, Property 1: The loom lifts exactly the hooks the current card punches
// For random designs, weaves and profiles (holeMeans lift and noLift, spare hooks, repeat across
// on and off), the engine's plan, and any Loom_Time: in the shuttle Phase the positions with
// hookHeight === 1 equal { h < hookCount : card.punched[h] !== (holeMeans === "noLift") } for the
// current card, which equals { h : plan.lifts[pick][h] }; in every Phase each position with
// hookHeight > 0 is in that set; spare positions are always 0.
// Validates: Requirements 9.1, 9.3, 6.2, 6.3
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { buildLoomModel, hookHeight, loomFrame, raisedPositions } from "../src/lib/loom-model";
import { loomCaseArb, timeArb } from "./loom-arbitraries";

const SEED = 6101;
const NUM_RUNS = 100;
const TIMEOUT_MS = NUM_RUNS * 300;

describe("Feature: studio-experience, Property 1: The loom lifts exactly the hooks the current card punches", () => {
  it(
    "raises exactly the punched hooks of the card on the cylinder",
    () => {
      fc.assert(
        fc.property(
          loomCaseArb.chain((loomCase) => fc.tuple(fc.constant(loomCase), fc.array(timeArb(loomCase.plan.pickCount), { minLength: 1, maxLength: 8 }))),
          ([{ plan, profile, yarns }, times]) => {
            const built = buildLoomModel(plan, profile, yarns);
            expect(built.ok).toBe(true);
            if (!built.ok) return;
            const model = built.value;
            const noLift = profile.holeMeans === "noLift";
            // Every pick at its shuttle Phase, plus the random times.
            const samples = [...times, ...Array.from({ length: plan.pickCount }, (_, pick) => pick + 0.5)];
            for (const t of samples) {
              const frame = loomFrame(model, t);
              const card = model.cards[frame.pick]!;
              expect(card.number).toBe(frame.pick + 1);
              const punchedLift = new Set<number>();
              for (let hook = 0; hook < plan.hookCount; hook += 1) {
                if (card.punched[hook] !== noLift) punchedLift.add(hook);
              }
              const planLift = new Set<number>();
              plan.lifts[frame.pick]!.forEach((lifted, hook) => {
                if (lifted) planLift.add(hook);
              });
              expect([...punchedLift].sort((a, b) => a - b)).toEqual([...planLift].sort((a, b) => a - b));
              for (let position = plan.hookCount; position < model.positionCount; position += 1) {
                expect(hookHeight(model, frame, position)).toBe(0);
              }
              const raised = raisedPositions(model, frame);
              for (const position of raised) expect(punchedLift.has(position)).toBe(true);
              if (frame.phase === "shuttle") {
                const full = [];
                for (let position = 0; position < model.positionCount; position += 1) {
                  if (hookHeight(model, frame, position) === 1) full.push(position);
                }
                expect(full).toEqual([...punchedLift].sort((a, b) => a - b));
                expect(raised).toEqual(full);
              }
            }
          },
        ),
        { seed: SEED, numRuns: NUM_RUNS, verbose: 1 },
      );
    },
    TIMEOUT_MS,
  );
});
