// Property 32: Inputs are never modified.
// Feature: weave-engine, Property 32: Inputs are never modified
// **Validates: Requirements 6.3**
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  autoFix,
  buildCards,
  buildLiftPlan,
  cardRows,
  checkFloats,
  decodeCards,
  defineProfile,
  evaluateWeave,
  validatePlan,
  validateProfile,
  weavePeriod,
} from "../src/index.js";
import type { BuildInput } from "../src/index.js";
import {
  applyFaults,
  faultBaseArb,
  faultSpecsArb,
  liftPlanArb,
  validInputArb,
  weaveArb,
} from "./arbitraries.js";

const NUM_RUNS = 300;

/** Freezes a value and everything reachable from it. Writing to it throws a TypeError in strict mode. */
function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value)) deepFreeze((value as Record<string, unknown>)[key]);
  }
  return value;
}

/** Deep copy that keeps prototypes (fast-check builds some objects with a null prototype), NaN and undefined. */
function snapshotOf<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => snapshotOf(item)) as unknown as T;
  if (value !== null && typeof value === "object") {
    const copy = Object.create(Object.getPrototypeOf(value)) as Record<string, unknown>;
    for (const key of Reflect.ownKeys(value)) {
      copy[key as string] = snapshotOf((value as Record<string, unknown>)[key as string]);
    }
    return copy as T;
  }
  return value;
}

/**
 * Freezes `input` deeply after taking a snapshot, calls `fn`, and requires that the call does not
 * throw and that the input still equals the snapshot.
 */
function expectUntouched<I, O>(input: I, fn: (frozen: I) => O): O {
  const snapshot = snapshotOf(input);
  const frozen = deepFreeze(input);
  const output = fn(frozen);
  expect(frozen).toStrictEqual(snapshot);
  return output;
}

describe("Property 32: Inputs are never modified (6.3)", () => {
  it("buildLiftPlan, validatePlan, buildCards, decodeCards, cardRows, checkFloats and autoFix leave frozen inputs equal to their snapshots", () => {
    fc.assert(
      fc.property(validInputArb(), (input) => {
        const built = expectUntouched<BuildInput, ReturnType<typeof buildLiftPlan>>(
          input,
          buildLiftPlan,
        );
        if (!built.ok) throw new Error(`valid input rejected: ${built.error.code}`);
        // Outputs are fresh values: freeze them too, so later calls see frozen inputs.
        const plan = deepFreeze(snapshotOf(built.value.plan));
        const profile = input.profile;

        expectUntouched({ plan, profile }, (c) => validatePlan(c.plan, c.profile));
        expectUntouched({ plan, profile }, (c) => checkFloats(c.plan, c.profile));
        expectUntouched({ plan, profile }, (c) => autoFix(c.plan, c.profile));

        const cards = expectUntouched({ plan, profile }, (c) => buildCards(c.plan, c.profile));
        if (!cards.ok) throw new Error(`buildCards failed: ${cards.error.code}`);
        const cardSet = cards.value;
        expectUntouched({ cardSet, profile }, (c) => decodeCards(c.cardSet, c.profile));
        for (const card of cardSet.cards) {
          expectUntouched({ card, profile }, (c) => cardRows(c.card, c.profile));
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("the same functions leave frozen inputs alone on lift plans biased toward floats", () => {
    fc.assert(
      fc.property(liftPlanArb(), ({ plan, profile }) => {
        expectUntouched({ plan, profile }, (c) => validatePlan(c.plan, c.profile));
        expectUntouched({ plan, profile }, (c) => checkFloats(c.plan, c.profile));
        expectUntouched({ plan, profile }, (c) => autoFix(c.plan, c.profile));
        expectUntouched({ plan, profile }, (c) => buildCards(c.plan, c.profile));
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("autoFix leaves its frozen input alone when it fixes something", () => {
    fc.assert(
      fc.property(liftPlanArb(), ({ plan, profile }) => {
        const result = expectUntouched({ plan, profile }, (c) => autoFix(c.plan, c.profile));
        if (result.ok) {
          // The returned plan is a new object, not the frozen input mutated.
          expect(result.value).not.toBe(plan);
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("buildLiftPlan leaves frozen invalid input alone and returns a typed error", () => {
    fc.assert(
      fc.property(faultBaseArb, faultSpecsArb, (base, specs) => {
        const { input } = applyFaults(base, specs);
        expectUntouched(input, (c) => buildLiftPlan(c as unknown as BuildInput));
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("evaluateWeave and weavePeriod leave a frozen weave alone", () => {
    fc.assert(
      fc.property(weaveArb, fc.nat({ max: 200 }), fc.nat({ max: 200 }), (weave, end, pick) => {
        expectUntouched(weave, (w) => weavePeriod(w));
        expectUntouched(weave, (w) => evaluateWeave(w, end, pick));
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("defineProfile and validateProfile leave frozen inputs alone", () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.constantFrom(120, 240, 400), fc.integer({ min: 1, max: 500 })),
        fc.option(fc.integer({ min: 1, max: 10 }), { nil: undefined }),
        fc.option(fc.integer({ min: 0, max: 20 }), { nil: undefined }),
        fc.option(fc.boolean(), { nil: undefined }),
        (hookCount, maxFloat, spareHookCount, wovenFaceDown) => {
          const fields = { hookCount, maxFloat, spareHookCount, wovenFaceDown };
          const profile = expectUntouched(fields, (f) => defineProfile(f));
          expectUntouched(profile, (p) => validateProfile(p));
          // A deliberately broken profile is also left alone.
          expectUntouched({ ...profile, hookCount: 0, holeMeans: "both" }, (p) =>
            validateProfile(p as unknown as typeof profile),
          );
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});
