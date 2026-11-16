// Feature: simulate-and-export, Property 1: Cloth model matches the lift plan
// For any valid plan, profile, yarns and side, clothModel returns pickCount by hookCount cells;
// cell (pick, hook) has top warp exactly when lifts[pick][hook] !== (side === "back") !==
// profile.wovenFaceDown; its colour is the warp or weft colour by 1.3; face and back are
// complementary at every cell; inputs are unchanged.
// Validates: Requirements 1.1, 1.2, 1.3, 1.5
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { clothModel } from "../src/index.js";
import { planCaseArb, sideArb, yarnsArb } from "./arbitraries.js";

const SEED = 5101;
const NUM_RUNS = 100;

describe("Feature: simulate-and-export, Property 1: Cloth model matches the lift plan", () => {
  it("shows the warp exactly where the side and the lift plan say, in the yarn colours", () => {
    fc.assert(
      fc.property(planCaseArb, yarnsArb, sideArb, ({ plan, profile }, yarns, side) => {
        const before = structuredClone({ plan, profile, yarns });
        const result = clothModel(plan, profile, yarns, side);
        const other = clothModel(plan, profile, yarns, side === "face" ? "back" : "face");
        expect(result.ok && other.ok).toBe(true);
        if (!result.ok || !other.ok) return;
        const cells = result.value;
        // 1.1 pickCount rows of hookCount cells.
        expect(cells).toHaveLength(plan.pickCount);
        for (let pick = 0; pick < plan.pickCount; pick += 1) {
          const row = cells[pick]!;
          expect(row).toHaveLength(plan.hookCount);
          for (let hook = 0; hook < plan.hookCount; hook += 1) {
            const lifted = plan.lifts[pick]![hook]!;
            // 1.2 With wovenFaceDown false, the face is the side facing up on the loom, where a
            // lifted end shows. With wovenFaceDown true the face is the side facing down.
            const facingUp = side === "face" ? !profile.wovenFaceDown : profile.wovenFaceDown;
            const warpOnTop = facingUp ? lifted : !lifted;
            const cell = row[hook]!;
            const where = `pick ${pick}, hook ${hook}, side ${side}`;
            expect(cell.top, where).toBe(warpOnTop ? "warp" : "weft");
            // 1.3 colours repeat over the lists.
            const colour = warpOnTop ? yarns.warp[hook % yarns.warp.length] : yarns.weft[pick % yarns.weft.length];
            expect(cell.colour, where).toBe(colour);
            // Face and back are complementary.
            expect(other.value[pick]![hook]!.top, where).toBe(warpOnTop ? "weft" : "warp");
          }
        }
        // 1.5 inputs unchanged.
        expect({ plan, profile, yarns }).toEqual(before);
      }),
      { seed: SEED, numRuns: NUM_RUNS, verbose: 1 },
    );
  });
});
