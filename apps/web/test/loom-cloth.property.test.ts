// Feature: studio-experience, Property 2: Cloth growth matches the lift plan pick for pick
// For the same inputs and any t1 <= t2: woven(t1) <= woven(t2); woven(t) is pick before the end of
// the beat and pick + 1 after; woven(pickCount) = pickCount. clothTexture(model, woven) holds, for
// each pick below woven, the RGBA of clothModel's colour for every hook, and alpha 0 for every
// other pick; on a profile with wovenFaceDown false a texel is the warp colour exactly when
// plan.lifts[pick][hook].
// Validates: Requirements 9.4, 9.5, 6.3
import * as fc from "fast-check";
import { clothModel } from "@jacquard/export";
import { describe, expect, it } from "vitest";
import { PHASE_ENDS, buildLoomModel, clothTexture, loomFrame } from "../src/lib/loom-model";
import { loomCaseArb, timeArb } from "./loom-arbitraries";

const SEED = 6202;
const NUM_RUNS = 100;
const TIMEOUT_MS = NUM_RUNS * 300;

function rgb(colour: string): [number, number, number] {
  const value = parseInt(colour.slice(1), 16);
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
}

describe("Feature: studio-experience, Property 2: Cloth growth matches the lift plan pick for pick", () => {
  it(
    "the woven count follows the beat and the cloth texture matches clothModel row by row",
    () => {
      fc.assert(
        fc.property(
          loomCaseArb.chain((loomCase) => fc.tuple(fc.constant(loomCase), fc.array(timeArb(loomCase.plan.pickCount), { minLength: 2, maxLength: 10 }))),
          ([{ plan, profile, yarns }, times]) => {
            const built = buildLoomModel(plan, profile, yarns);
            expect(built.ok).toBe(true);
            if (!built.ok) return;
            const model = built.value;
            const sorted = [...times].sort((a, b) => a - b);
            let previous = -1;
            for (const t of sorted) {
              const frame = loomFrame(model, t);
              expect(frame.woven).toBeGreaterThanOrEqual(previous);
              previous = frame.woven;
              const clamped = Math.min(plan.pickCount, Math.max(0, t));
              const fraction = clamped >= plan.pickCount ? 1 : clamped - Math.floor(clamped);
              expect(frame.woven).toBe(fraction >= PHASE_ENDS.beat ? frame.pick + 1 : frame.pick);
            }
            expect(loomFrame(model, plan.pickCount).woven).toBe(plan.pickCount);
            const face = clothModel(plan, profile, yarns, "face");
            expect(face.ok).toBe(true);
            if (!face.ok) return;
            const woven = loomFrame(model, sorted[sorted.length - 1]!).woven;
            const data = clothTexture(model, woven);
            expect(data.length).toBe(plan.hookCount * plan.pickCount * 4);
            for (let pick = 0; pick < plan.pickCount; pick += 1) {
              for (let hook = 0; hook < plan.hookCount; hook += 1) {
                const offset = (pick * plan.hookCount + hook) * 4;
                if (pick < woven) {
                  const cell = face.value[pick]![hook]!;
                  expect([data[offset], data[offset + 1], data[offset + 2], data[offset + 3]]).toEqual([...rgb(cell.colour), 255]);
                  if (!profile.wovenFaceDown && yarns.warp[0] !== yarns.weft[0]) {
                    const showsWarp = data[offset] === rgb(yarns.warp[0]!)[0] && data[offset + 1] === rgb(yarns.warp[0]!)[1] && data[offset + 2] === rgb(yarns.warp[0]!)[2];
                    expect(showsWarp).toBe(plan.lifts[pick]![hook]!);
                  }
                } else {
                  expect(data[offset + 3]).toBe(0);
                }
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
