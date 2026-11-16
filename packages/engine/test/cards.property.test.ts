// Property 12: Card count, numbering and layout.
// Feature: weave-engine, Property 12: Card count, numbering and layout
// **Validates: Requirements 2.7, 2.8, 2.9**

import * as fc from "fast-check";
import { describe, expect, it } from "vitest";

import { buildCards, cardRows, nextCard } from "../src/index.js";

import { liftPlanArb, liftPlanFromDesignArb } from "./arbitraries.js";

describe("Property 12: Card count, numbering and layout (2.7, 2.8, 2.9)", () => {
  it("one numbered card per pick, rows of hooksPerCardRow with null only after the last position, chain wraps", () => {
    // No fixed seed: fast-check picks a random one and prints it, with the shrunk counterexample, on failure.
    fc.assert(
      fc.property(fc.oneof(liftPlanArb(), liftPlanFromDesignArb()), ({ plan, profile }) => {
        const result = buildCards(plan, profile);
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        const { cards } = result.value;

        // 2.7: card count equals pick count; index = p, number = p + 1, in pick order.
        expect(cards.length).toBe(plan.pickCount);
        const positions = profile.hookCount + profile.spareHookCount;
        const slots = profile.hooksPerCardRow;
        cards.forEach((card, pick) => {
          expect(card.index).toBe(pick);
          expect(card.number).toBe(pick + 1);
          expect(card.punched.length).toBe(positions);

          // 2.8: layout.
          const rows = cardRows(card, profile);
          expect(rows.length).toBe(Math.ceil(positions / slots));
          for (let q = 0; q < rows.length * slots; q += 1) {
            const row = rows[Math.floor(q / slots)]!;
            expect(row.length).toBe(slots);
            const slot = row[q % slots];
            if (q < positions) expect(slot).toBe(card.punched[q]);
            else expect(slot).toBeNull();
          }
        });

        // 2.9: the lacing chain is endless.
        const last = plan.pickCount - 1;
        expect(nextCard(last, plan.pickCount)).toBe(0);
        for (let pick = 0; pick < last; pick += 1) {
          expect(nextCard(pick, plan.pickCount)).toBe(pick + 1);
        }
      }),
      { numRuns: 300 },
    );
  });
});

// Property 13: Punching follows holeMeans.
// Feature: weave-engine, Property 13: Punching follows holeMeans
// **Validates: Requirements 2.7**

describe("Property 13: Punching follows holeMeans (2.7)", () => {
  it("figuring position h is punched iff lifts[p][h] differs from (holeMeans === noLift); spare and idle positions are punched iff holeMeans === noLift", () => {
    // No fixed seed: fast-check prints the seed and the shrunk counterexample on failure.
    fc.assert(
      fc.property(fc.oneof(liftPlanArb(), liftPlanFromDesignArb()), ({ plan, profile }) => {
        const result = buildCards(plan, profile);
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        const { cards } = result.value;

        // The state that keeps a hook down: no hole under "lift", a hole under "noLift".
        const down = profile.holeMeans === "noLift";
        const positions = profile.hookCount + profile.spareHookCount;
        expect(cards.length).toBe(plan.pickCount);

        cards.forEach((card, pick) => {
          expect(card.punched.length).toBe(positions);
          const row = plan.lifts[pick]!;
          for (let position = 0; position < positions; position += 1) {
            if (position < profile.hookCount) {
              // Figuring hook (an idle hook is a figuring hook that never lifts).
              expect(card.punched[position]).toBe(row[position]! !== down);
              if (!plan.repeatAcross && position >= plan.designWidth) {
                // Idle hook: never lifts, so it is in the keep-down state.
                expect(row[position]).toBe(false);
                expect(card.punched[position]).toBe(down);
              }
            } else {
              // Spare hook: never lifts.
              expect(card.punched[position]).toBe(down);
            }
          }
        });
      }),
      { numRuns: 200 },
    );
  });
});

// Property 14: Card round trip.
// Feature: weave-engine, Property 14: Card round trip
// **Validates: Requirements 2.10**

import type { Card, LoomProfile } from "../src/types.js";
import { decodeCards } from "../src/index.js";

/** Deterministic Fisher-Yates shuffle driven by an integer seed, so fast-check can shrink it. */
function shuffle<T>(items: readonly T[], seed: number): T[] {
  const out = [...items];
  let state = seed >>> 0;
  for (let i = out.length - 1; i > 0; i -= 1) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const j = state % (i + 1);
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}

describe("Property 14: Card round trip (2.10)", () => {
  it("decodeCards(buildCards(plan)) equals plan for both holeMeans values and any card order", () => {
    // No fixed seed: fast-check prints the seed and the shrunk counterexample on failure.
    fc.assert(
      fc.property(
        fc.oneof(liftPlanArb(), liftPlanFromDesignArb()),
        fc.integer({ min: 0, max: 0xffffffff }),
        ({ plan, profile }, shuffleSeed) => {
          for (const holeMeans of ["lift", "noLift"] as const) {
            const variant: LoomProfile = { ...profile, holeMeans };
            const built = buildCards(plan, variant);
            expect(built.ok).toBe(true);
            if (!built.ok) return;

            const inOrder = decodeCards(built.value, variant);
            expect(inOrder.ok).toBe(true);
            if (inOrder.ok) expect(inOrder.value).toEqual(plan);

            const cards: Card[] = shuffle(built.value.cards, shuffleSeed);
            const shuffled = decodeCards({ ...built.value, cards }, variant);
            expect(shuffled.ok).toBe(true);
            if (shuffled.ok) expect(shuffled.value).toEqual(plan);
          }
        },
      ),
      { numRuns: 300 },
    );
  });
});
