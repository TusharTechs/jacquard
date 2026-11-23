// Shared generators for the loom model properties (studio-experience Properties 1 to 4): a random
// design, weaves from the app's fixed list, and a profile with either hole meaning, spare hooks
// and repeat across on or off. The plan comes from the engine through the app's checkDesign.
import * as fc from "fast-check";
import { defineProfile } from "@jacquard/engine";
import type { LiftPlan, LoomProfile, WeaveAssignment } from "@jacquard/engine";
import type { YarnColours } from "@jacquard/export";
import { WEAVE_CHOICES } from "../src/lib/default-weaves";
import { checkDesign } from "../src/lib/engine-check";

export interface LoomCase {
  readonly plan: LiftPlan;
  readonly profile: LoomProfile;
  readonly yarns: YarnColours;
}

const hex = fc.integer({ min: 0, max: 0xffffff }).map((value) => `#${value.toString(16).padStart(6, "0")}`);

export const loomCaseArb: fc.Arbitrary<LoomCase> = fc
  .record({
    hookCount: fc.integer({ min: 8, max: 40 }),
    hooksPerCardRow: fc.integer({ min: 1, max: 12 }),
    spareHookCount: fc.integer({ min: 0, max: 6 }),
    holeMeans: fc.constantFrom<"lift" | "noLift">("lift", "noLift"),
    wovenFaceDown: fc.boolean(),
    regions: fc.integer({ min: 1, max: 4 }),
    maxFloat: fc.integer({ min: 2, max: 8 }),
    repeatAcross: fc.boolean(),
  })
  .chain((shape) =>
    fc.record({
      shape: fc.constant(shape),
      ends: fc.integer({ min: 1, max: shape.hookCount }).filter((ends) => !shape.repeatAcross || shape.hookCount % ends === 0),
      picks: fc.integer({ min: 1, max: 24 }),
      weaveIds: fc.array(fc.constantFrom(...WEAVE_CHOICES.map((choice) => choice.id)), { minLength: 4, maxLength: 4 }),
      warp: hex,
      weft: hex,
    }),
  )
  .chain(({ shape, ends, picks, weaveIds, warp, weft }) =>
    fc
      .array(fc.array(fc.integer({ min: 0, max: shape.regions - 1 }), { minLength: ends, maxLength: ends }), {
        minLength: picks,
        maxLength: picks,
      })
      .map((design): LoomCase | null => {
        const profile = defineProfile({
          hookCount: shape.hookCount,
          hooksPerCardRow: shape.hooksPerCardRow,
          spareHookCount: shape.spareHookCount,
          holeMeans: shape.holeMeans,
          wovenFaceDown: shape.wovenFaceDown,
          maxFloat: shape.maxFloat,
        });
        const weaves: Record<number, (typeof WEAVE_CHOICES)[number]["weave"]> = {};
        weaveIds.forEach((id, region) => {
          weaves[region] = WEAVE_CHOICES.find((choice) => choice.id === id)!.weave;
        });
        const check = checkDesign({ design, weaves: weaves as WeaveAssignment, profile, repeatAcross: shape.repeatAcross });
        return check.ok ? { plan: check.plan, profile, yarns: { warp: [warp], weft: [weft] } } : null;
      }),
  )
  .filter((value): value is LoomCase => value !== null);

/** A Loom_Time anywhere in [-2, pickCount + 2], including whole picks and Phase boundaries. */
export function timeArb(pickCount: number): fc.Arbitrary<number> {
  return fc.oneof(
    fc.double({ min: -2, max: pickCount + 2, noNaN: true }),
    fc.integer({ min: 0, max: pickCount }),
    fc.integer({ min: 0, max: Math.max(0, pickCount - 1) }).chain((pick) =>
      fc.constantFrom(0.2, 0.35, 0.7, 0.85, 0.999).map((fraction) => pick + fraction),
    ),
  );
}
