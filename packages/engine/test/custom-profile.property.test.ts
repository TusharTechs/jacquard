// Property 34: A custom profile is used in place of a built-in.
// Validates: Requirements 1.4

import * as fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  PROFILE_120,
  PROFILE_240,
  PROFILE_400,
  buildCards,
  buildLiftPlan,
  cardRows,
  checkFloats,
  defineProfile,
} from "../src/index.js";
import type { LoomProfile } from "../src/index.js";
import { profileArb, validInputArb, weaveAssignmentArb } from "./arbitraries.js";
import { naiveCheckFloats } from "./oracle.js";

const NUM_RUNS = 200;

function unwrap<T>(result: { ok: true; value: T } | { ok: false; error: unknown }): T {
  if (!result.ok) throw new Error(`unexpected error: ${JSON.stringify(result.error)}`);
  return result.value;
}

describe("Property 34: a custom profile is used in place of a built-in", () => {
  it("plan, cards and floats depend on the custom profile alone", () => {
    fc.assert(
      fc.property(validInputArb(), ({ design, weaves, profile, repeatAcross }) => {
        const built = unwrap(buildLiftPlan({ design, weaves, profile, repeatAcross }));
        const plan = built.plan;
        const width = design[0]!.length;

        // plan shape
        expect(plan.hookCount).toBe(profile.hookCount);
        expect(plan.designWidth).toBe(width);
        const expectedIdle: number[] = [];
        if (!repeatAcross) {
          for (let hook = width; hook < profile.hookCount; hook += 1) expectedIdle.push(hook);
        }
        expect(built.idleHooks).toEqual(expectedIdle);

        // cards
        const cardSet = unwrap(buildCards(plan, profile));
        const positions = profile.hookCount + profile.spareHookCount;
        const down = profile.holeMeans === "noLift";
        expect(cardSet.cards.length).toBe(plan.pickCount);
        cardSet.cards.forEach((card, pick) => {
          expect(card.punched.length).toBe(positions);
          const rows = cardRows(card, profile);
          expect(rows.length).toBe(Math.ceil(positions / profile.hooksPerCardRow));
          for (const row of rows) expect(row.length).toBe(profile.hooksPerCardRow);
          for (let position = 0; position < positions; position += 1) {
            const lifted = position < profile.hookCount ? plan.lifts[pick]![position]! : false;
            expect(card.punched[position]).toBe(lifted !== down);
          }
        });

        // floats: sound and complete against the naive oracle
        const violations = unwrap(checkFloats(plan, profile));
        for (const violation of violations) {
          if (violation.kind === "float") {
            const limit = violation.direction === "warp" ? profile.maxWarpFloat : profile.maxWeftFloat;
            expect(violation.length).toBeGreaterThan(limit);
          }
        }
        expect(violations).toEqual(naiveCheckFloats(plan, profile));

        // no identity special-casing: a plain-object copy gives equal results
        const copy: LoomProfile = JSON.parse(JSON.stringify(profile)) as LoomProfile;
        expect(buildLiftPlan({ design, weaves, profile: copy, repeatAcross })).toEqual({
          ok: true,
          value: built,
        });
        expect(buildCards(plan, copy)).toEqual({ ok: true, value: cardSet });
        expect(checkFloats(plan, copy)).toEqual({ ok: true, value: violations });
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("a built-in profile and a plain-object copy give equal results", () => {
    const builtInArb = fc.constantFrom(PROFILE_120, PROFILE_240, PROFILE_400);
    fc.assert(
      fc.property(
        builtInArb,
        fc.integer({ min: 1, max: 24 }),
        fc.integer({ min: 1, max: 24 }),
        fc.integer({ min: 0, max: 99 }),
        weaveAssignmentArb(PROFILE_120.regionLimit),
        (builtIn, width, pickCount, seed, weaves) => {
          const design = Array.from({ length: pickCount }, (_, pick) =>
            Array.from({ length: width }, (_, end) => (pick * 7 + end * 3 + seed) % builtIn.regionLimit),
          );
          const copy: LoomProfile = { ...builtIn };
          const a = buildLiftPlan({ design, weaves, profile: builtIn });
          const b = buildLiftPlan({ design, weaves, profile: copy });
          expect(b).toEqual(a);
          const plan = unwrap(a).plan;
          expect(buildCards(plan, copy)).toEqual(buildCards(plan, builtIn));
          expect(checkFloats(plan, copy)).toEqual(checkFloats(plan, builtIn));
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it("defineProfile keeps given fields exactly and fills only omitted ones from the defaults", () => {
    const FALLBACK = {
      hooksPerCardRow: 8,
      spareHookCount: 0,
      spareHookPlacement: "afterFiguring",
      maxFloat: 8,
      regionLimit: 4,
      holeMeans: "lift",
      cardFillOrder: "ascending",
      wovenFaceDown: false,
    } as const;
    const BUILT_INS: Readonly<Record<number, LoomProfile>> = {
      120: PROFILE_120,
      240: PROFILE_240,
      400: PROFILE_400,
    };
    const keys = [
      "hooksPerCardRow",
      "spareHookCount",
      "spareHookPlacement",
      "maxFloat",
      "maxWarpFloat",
      "maxWeftFloat",
      "regionLimit",
      "holeMeans",
      "cardFillOrder",
      "wovenFaceDown",
    ] as const;

    fc.assert(
      fc.property(
        profileArb(1, 48),
        fc.constantFrom<number | undefined>(undefined, 120, 240, 400),
        fc.subarray([...keys]),
        (full, builtInHooks, given) => {
          const hookCount = builtInHooks ?? full.hookCount;
          const fields: Record<string, unknown> = { hookCount };
          for (const key of given) fields[key] = full[key];
          const result = defineProfile(fields as unknown as Parameters<typeof defineProfile>[0]);

          const base: Record<string, unknown> = { ...(BUILT_INS[hookCount] ?? FALLBACK) };
          const resolvedMaxFloat = (given.includes("maxFloat") ? full.maxFloat : base.maxFloat) as number;
          const expected: Record<string, unknown> = { hookCount };
          for (const key of keys) {
            if (given.includes(key)) expected[key] = full[key];
            else if (key === "maxWarpFloat" || key === "maxWeftFloat") expected[key] = resolvedMaxFloat;
            else expected[key] = base[key];
          }
          expect(result).toEqual(expected);
          expect(Object.keys(result).sort()).toEqual(Object.keys(expected).sort());
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});
