// Feature: simulate-and-export, Property 6: Card count, order and positions
// For any valid plan and profile, cardSheetLayout has exactly pickCount cards numbered 1 to
// pickCount in order; card n has exactly hookCount + spareHookCount drawn positions; the drawn
// punched count of card n equals the punched count of card n in buildCards; and the positions
// follow cardRows slot by slot.
// Validates: Requirements 4.1, 4.2, 4.3, 4.4
import * as fc from "fast-check";
import { buildCards, cardRows } from "@jacquard/engine";
import { describe, expect, it } from "vitest";
import { cardSheetLayout } from "../src/index.js";
import { planCaseArb } from "./arbitraries.js";

const SEED = 5106;
const NUM_RUNS = 100;

describe("Feature: simulate-and-export, Property 6: Card count, order and positions", () => {
  it("lays out one card per pick, in lacing order, with every position in cardRows order", () => {
    fc.assert(
      fc.property(planCaseArb, ({ plan, profile }) => {
        const before = structuredClone({ plan, profile });
        const laid = cardSheetLayout(plan, profile);
        expect(laid.ok).toBe(true);
        if (!laid.ok) return;
        const engine = buildCards(plan, profile);
        if (!engine.ok) throw new Error(engine.error.message);
        const layout = laid.value;
        const positions = plan.hookCount + profile.spareHookCount;
        const slotsPerRow = profile.hooksPerCardRow;
        const down = profile.holeMeans === "noLift";
        // 4.1 one card per pick; 4.2 numbered 1 to pickCount, card n encodes pick n - 1.
        expect(layout.cards).toHaveLength(plan.pickCount);
        layout.cards.forEach((card, index) => {
          expect(card.number).toBe(index + 1);
          expect(card.pick).toBe(index);
          const engineCard = engine.value.cards[index]!;
          // 4.3 exactly hookCount + spareHookCount positions.
          expect(card.holes).toHaveLength(positions);
          // 4.3 slot by slot as cardRows lays them out: rows of hooksPerCardRow, null slots not drawn.
          const rows = cardRows(engineCard, profile);
          const expected: { row: number; slot: number; punched: boolean }[] = [];
          rows.forEach((slots, row) =>
            slots.forEach((punched, slot) => {
              if (punched !== null) expected.push({ row, slot, punched });
            }),
          );
          expect(card.holes.map(({ row, slot, punched }) => ({ row, slot, punched }))).toEqual(expected);
          card.holes.forEach((hole, q) => {
            // Position q sits at row floor(q / slots), slot q mod slots.
            expect(hole.position).toBe(q);
            expect(hole.row).toBe(Math.floor(q / slotsPerRow));
            expect(hole.slot).toBe(q % slotsPerRow);
            // Punched from the plan: figuring hook h punched when lifts !== down; spares punched when down.
            const fromPlan = q < plan.hookCount ? plan.lifts[index]![q]! !== down : down;
            expect(hole.punched, `card ${card.number}, position ${q}`).toBe(fromPlan);
          });
          // 4.4 drawn punched count equals the engine's punched count.
          expect(card.holes.filter((hole) => hole.punched).length).toBe(engineCard.punched.filter(Boolean).length);
          // Geometry: rows run left to right from the numbered end, slot 0 at the top of a row.
          const at = new Map(card.holes.map((hole) => [`${hole.row}:${hole.slot}`, hole]));
          for (const hole of card.holes) {
            const right = at.get(`${hole.row + 1}:${hole.slot}`);
            const below = at.get(`${hole.row}:${hole.slot + 1}`);
            if (right !== undefined) expect(right.x).toBeGreaterThan(hole.x);
            if (below !== undefined) expect(below.y).toBeGreaterThan(hole.y);
            expect(hole.x).toBeGreaterThan(layout.numberX);
            expect(hole.x).toBeLessThan(layout.cardWidth);
            expect(hole.y).toBeGreaterThan(0);
            expect(hole.y).toBeLessThan(layout.cardHeight);
          }
        });
        expect(layout.rowsPerCard).toBe(Math.ceil(positions / slotsPerRow));
        expect(layout.slotsPerRow).toBe(slotsPerRow);
        expect({ plan, profile }).toEqual(before);
      }),
      { seed: SEED, numRuns: NUM_RUNS, verbose: 1 },
    );
  });
});
