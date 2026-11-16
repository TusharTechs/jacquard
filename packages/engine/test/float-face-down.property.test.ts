// Property 22: wovenFaceDown swaps face and back.
// Feature: weave-engine, Property 22: wovenFaceDown swaps face and back
// **Validates: Requirements 1.2, 4.1**

import * as fc from "fast-check";
import { describe, expect, it } from "vitest";

import { checkFloats } from "../src/floats.js";
import type { Violation } from "../src/types.js";

import { liftPlanArb } from "./arbitraries.js";

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

describe("Property 22: wovenFaceDown swaps face and back (1.2, 4.1)", () => {
  it("flipping wovenFaceDown swaps face and back in every violation and changes nothing else", () => {
    fc.assert(
      fc.property(liftPlanArb(), ({ plan, profile }) => {
        const original = checkFloats(plan, profile);
        const flipped = checkFloats(plan, { ...profile, wovenFaceDown: !profile.wovenFaceDown });
        if (!original.ok) throw new Error(`checkFloats failed: ${original.error.code}`);
        if (!flipped.ok) throw new Error(`checkFloats (flipped) failed: ${flipped.error.code}`);
        const expected = original.value.map(swapSide).sort(compareViolations);
        expect(flipped.value).toEqual(expected);
      }),
      { numRuns: 500 },
    );
  });
});
