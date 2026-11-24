// Feature: studio-experience, Property 10: With repeat on, the cards span the card
// For random designs whose width divides the hook count and the engine's plan with repeat across
// on: every card's lift (read back through the engine's decodeCards) is periodic in the design
// width across all figuring hooks, so every column of holes in the first repeat is punched again
// in the last one.
// Validates: Requirements 17.3
import * as fc from "fast-check";
import { buildCards, defineProfile } from "@jacquard/engine";
import { describe, expect, it } from "vitest";
import { WEAVE_CHOICES } from "../src/lib/default-weaves";
import { checkDesign } from "../src/lib/engine-check";
import { buildLoomModel } from "../src/lib/loom-model";

const SEED = 6909;
const NUM_RUNS = 100;
const TIMEOUT_MS = NUM_RUNS * 300;

const caseArb = fc
  .record({
    width: fc.integer({ min: 2, max: 16 }),
    times: fc.integer({ min: 2, max: 6 }),
    picks: fc.integer({ min: 1, max: 16 }),
    regions: fc.integer({ min: 1, max: 3 }),
    holeMeans: fc.constantFrom<"lift" | "noLift">("lift", "noLift"),
    spare: fc.integer({ min: 0, max: 4 }),
    weaveIds: fc.array(fc.constantFrom(...WEAVE_CHOICES.map((choice) => choice.id)), { minLength: 3, maxLength: 3 }),
  })
  .chain((shape) =>
    fc
      .array(fc.array(fc.integer({ min: 0, max: shape.regions - 1 }), { minLength: shape.width, maxLength: shape.width }), {
        minLength: shape.picks,
        maxLength: shape.picks,
      })
      .map((design) => ({ ...shape, design })),
  );

describe("Feature: studio-experience, Property 10: With repeat on, the cards span the card", () => {
  it(
    "every card repeats the design's lift across all figuring hooks",
    () => {
      fc.assert(
        fc.property(caseArb, ({ width, times, design, holeMeans, spare, weaveIds }) => {
          const hookCount = width * times;
          if (hookCount < 8) return;
          const profile = defineProfile({ hookCount, spareHookCount: spare, holeMeans });
          const weaves = Object.fromEntries(weaveIds.map((id, region) => [region, WEAVE_CHOICES.find((choice) => choice.id === id)!.weave]));
          const check = checkDesign({ design, weaves, profile, repeatAcross: true });
          if (!check.ok) throw new Error(check.error.code);
          const built = buildLoomModel(check.plan, profile, { warp: ["#2b2b2b"], weft: ["#d9a441"] });
          if (!built.ok) throw new Error(built.error.code);
          const cards = buildCards(check.plan, profile);
          if (!cards.ok) throw new Error(cards.error.code);
          for (let card = 0; card < built.value.lifted.length; card += 1) {
            const lifted = built.value.lifted[card]!;
            expect(lifted).toHaveLength(hookCount);
            for (let hook = width; hook < hookCount; hook += 1) expect(lifted[hook]).toBe(lifted[hook % width]);
            // The punched holes of the last repeat match the first: holes span the card.
            const punched = cards.value.cards[card]!.punched;
            for (let end = 0; end < width; end += 1) expect(punched[hookCount - width + end]).toBe(punched[end]);
          }
        }),
        { seed: SEED, numRuns: NUM_RUNS, verbose: 1 },
      );
    },
    TIMEOUT_MS,
  );
});
