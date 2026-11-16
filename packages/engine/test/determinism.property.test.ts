// Property 31: Identical input gives identical output.
// Feature: weave-engine, Property 31: Identical input gives identical output
// **Validates: Requirements 6.1**
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  autoFix,
  buildCards,
  buildLiftPlan,
  checkFloats,
  decodeCards,
  defineProfile,
  evaluateWeave,
  validatePlan,
  validateProfile,
  weavePeriod,
} from "../src/index.js";
import type { BuildInput, CardSet, LiftPlan, LoomProfile } from "../src/index.js";
import {
  applyFaults,
  faultBaseArb,
  faultSpecsArb,
  liftPlanArb,
  validInputArb,
  weaveArb,
} from "./arbitraries.js";

/** Deep copy of plain data (objects, arrays, primitives). Keeps NaN and undefined as they are. */
function deepCopy<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => deepCopy(item)) as unknown as T;
  if (value !== null && typeof value === "object") {
    const copy: Record<string, unknown> = {};
    for (const key of Object.keys(value)) copy[key] = deepCopy((value as Record<string, unknown>)[key]);
    return copy as T;
  }
  return value;
}

/** JSON with object keys sorted at every level. */
function sortedJson(value: unknown): string {
  return JSON.stringify(value, (_key, item: unknown) => {
    if (item !== null && typeof item === "object" && !Array.isArray(item)) {
      const sorted: Record<string, unknown> = {};
      for (const key of Object.keys(item).sort()) sorted[key] = (item as Record<string, unknown>)[key];
      return sorted;
    }
    return item;
  });
}

/** Calls `fn` on two deep copies of `input` and requires equal results. */
function expectDeterministic<I, O>(input: I, fn: (copy: I) => O): O {
  const first = fn(deepCopy(input));
  const second = fn(deepCopy(input));
  expect(second).toStrictEqual(first);
  expect(sortedJson(second)).toBe(sortedJson(first));
  return first;
}

const NUM_RUNS = 300;

describe("Property 31: Identical input gives identical output (6.1)", () => {
  it("buildLiftPlan, validatePlan, buildCards, decodeCards, checkFloats and autoFix are deterministic", () => {
    fc.assert(
      fc.property(validInputArb(), (input) => {
        const built = expectDeterministic<BuildInput, ReturnType<typeof buildLiftPlan>>(input, buildLiftPlan);
        if (!built.ok) throw new Error(`valid input rejected: ${built.error.code}`);
        const { plan } = built.value;
        const { profile } = input;

        expectDeterministic({ plan, profile }, (c) => validatePlan(c.plan, c.profile));
        expectDeterministic({ plan, profile }, (c) => checkFloats(c.plan, c.profile));
        expectDeterministic({ plan, profile }, (c) => autoFix(c.plan, c.profile));

        const cards = expectDeterministic({ plan, profile }, (c) => buildCards(c.plan, c.profile));
        if (!cards.ok) throw new Error(`buildCards failed: ${cards.error.code}`);
        expectDeterministic<{ cardSet: CardSet; profile: LoomProfile }, unknown>(
          { cardSet: cards.value, profile },
          (c) => decodeCards(c.cardSet, c.profile),
        );
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("the same functions are deterministic on lift plans biased toward floats", () => {
    fc.assert(
      fc.property(liftPlanArb(), ({ plan, profile }) => {
        expectDeterministic<{ plan: LiftPlan; profile: LoomProfile }, unknown>(
          { plan, profile },
          (c) => checkFloats(c.plan, c.profile),
        );
        expectDeterministic({ plan, profile }, (c) => autoFix(c.plan, c.profile));
        expectDeterministic({ plan, profile }, (c) => buildCards(c.plan, c.profile));
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("buildLiftPlan returns the same typed error for the same invalid input", () => {
    fc.assert(
      fc.property(faultBaseArb, faultSpecsArb, (base, specs) => {
        const { input } = applyFaults(base, specs);
        expectDeterministic(input, (c) => buildLiftPlan(c as unknown as BuildInput));
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("evaluateWeave and weavePeriod are deterministic", () => {
    fc.assert(
      fc.property(weaveArb, fc.nat({ max: 200 }), fc.nat({ max: 200 }), (weave, end, pick) => {
        expectDeterministic(weave, (w) => weavePeriod(w));
        expectDeterministic(weave, (w) => evaluateWeave(w, end, pick));
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("defineProfile and validateProfile are deterministic", () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.constantFrom(120, 240, 400), fc.integer({ min: 1, max: 500 })),
        fc.option(fc.integer({ min: 1, max: 10 }), { nil: undefined }),
        fc.option(fc.integer({ min: 0, max: 20 }), { nil: undefined }),
        fc.option(fc.boolean(), { nil: undefined }),
        (hookCount, maxFloat, spareHookCount, wovenFaceDown) => {
          const fields = { hookCount, maxFloat, spareHookCount, wovenFaceDown };
          const profile = expectDeterministic(fields, (f) => defineProfile(f));
          expectDeterministic(profile, (p) => validateProfile(p));
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});
