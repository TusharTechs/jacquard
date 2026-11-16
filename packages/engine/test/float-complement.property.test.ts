// Property 21: Complement swaps face and back.
// Feature: weave-engine, Property 21: Complement swaps face and back
// **Validates: Requirements 4.1**

import * as fc from "fast-check";
import { describe, expect, it } from "vitest";

import { checkFloats } from "../src/floats.js";
import type { LiftPlan, Violation } from "../src/types.js";

import { liftPlanArb } from "./arbitraries.js";

/** Invert every analysed cell. Idle hooks stay unlifted; with repeatAcross every tile copy is inverted. */
function complement(plan: LiftPlan): LiftPlan {
  const limit = plan.repeatAcross ? plan.hookCount : plan.designWidth;
  return {
    ...plan,
    lifts: plan.lifts.map((row) => row.map((cell, hook) => (hook < limit ? !cell : cell))),
  };
}

function swapSide(violation: Violation): Violation {
  return { ...violation, side: violation.side === "face" ? "back" : "face" };
}

// 4.6 sort key: kind, side, direction, row key, column key.
function sortKey(v: Violation): number[] {
  const row = v.kind === "float" ? v.pick : v.direction === "warp" ? 0 : v.line;
  const col = v.kind === "float" ? v.end : v.direction === "warp" ? v.line : 0;
  return [
    v.kind === "unbound" ? 0 : 1,
    v.side === "face" ? 0 : 1,
    v.direction === "warp" ? 0 : 1,
    row,
    col,
  ];
}

function compareViolations(a: Violation, b: Violation): number {
  const ka = sortKey(a);
  const kb = sortKey(b);
  for (let i = 0; i < ka.length; i += 1) {
    const diff = (ka[i] ?? 0) - (kb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

describe("Property 21: Complement swaps face and back (4.1)", () => {
  it("inverting every analysed cell swaps face and back in every violation and changes nothing else", () => {
    fc.assert(
      fc.property(liftPlanArb(), ({ plan, profile }) => {
        const original = checkFloats(plan, profile);
        const inverted = checkFloats(complement(plan), profile);
        if (!original.ok) throw new Error(`checkFloats failed: ${original.error.code}`);
        if (!inverted.ok) throw new Error(`checkFloats (complement) failed: ${inverted.error.code}`);
        const expected = original.value.map(swapSide).sort(compareViolations);
        expect(inverted.value).toEqual(expected);
      }),
      { numRuns: 500 },
    );
  });
});
