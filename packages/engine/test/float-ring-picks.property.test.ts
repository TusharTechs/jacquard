// Property 19: Ring invariance along the picks.
// Feature: weave-engine, Property 19: Ring invariance along the picks
// **Validates: Requirements 4.2, 4.3**

import * as fc from "fast-check";
import { describe, it } from "vitest";

import { checkFloats } from "../src/index.js";
import type { LiftPlan, Violation } from "../src/types.js";

import { liftPlanArb } from "./arbitraries.js";

const SIDE_RANK = { face: 0, back: 1 } as const;
const DIRECTION_RANK = { warp: 0, weft: 1 } as const;

function rowKey(v: Violation): number {
  if (v.kind === "float") return v.pick;
  return v.direction === "warp" ? 0 : v.line;
}

function columnKey(v: Violation): number {
  if (v.kind === "float") return v.end;
  return v.direction === "warp" ? v.line : 0;
}

/** The 4.6 ordering key: kind, side, direction, row key, column key. */
function compare(a: Violation, b: Violation): number {
  return (
    (a.kind === b.kind ? 0 : a.kind === "unbound" ? -1 : 1) ||
    SIDE_RANK[a.side] - SIDE_RANK[b.side] ||
    DIRECTION_RANK[a.direction] - DIRECTION_RANK[b.direction] ||
    rowKey(a) - rowKey(b) ||
    columnKey(a) - columnKey(b)
  );
}

function mapViolation(v: Violation, shift: number, pickCount: number): Violation {
  const moved = (index: number): number => (index + shift) % pickCount;
  if (v.kind === "float") return { ...v, pick: moved(v.pick) };
  return v.direction === "weft" ? { ...v, line: moved(v.line) } : { ...v };
}

function rotatePicks(plan: LiftPlan, shift: number): LiftPlan {
  const lifts: boolean[][] = plan.lifts.map(() => []);
  plan.lifts.forEach((row, pick) => {
    lifts[(pick + shift) % plan.pickCount] = [...row];
  });
  return { ...plan, lifts };
}

describe("Property 19: Ring invariance along the picks (4.2, 4.3)", () => {
  it("rotating the lift rows by k picks maps float picks and unbound weft lines by k mod P", () => {
    fc.assert(
      fc.property(liftPlanArb(), fc.nat(), ({ plan, profile }, rawShift) => {
        const shift = rawShift % plan.pickCount;
        const original = checkFloats(plan, profile);
        const rotated = checkFloats(rotatePicks(plan, shift), profile);
        if (!original.ok) throw new Error(`checkFloats failed: ${original.error.code}`);
        if (!rotated.ok) throw new Error(`checkFloats failed on rotated plan: ${rotated.error.code}`);
        const expected = original.value
          .map((v) => mapViolation(v, shift, plan.pickCount))
          .sort(compare);
        const actual = [...rotated.value].sort(compare);
        if (JSON.stringify(actual) !== JSON.stringify(expected)) {
          throw new Error(
            `shift=${shift} P=${plan.pickCount} repeatAcross=${plan.repeatAcross}\n` +
              `actual:   ${JSON.stringify(actual)}\nexpected: ${JSON.stringify(expected)}`,
          );
        }
      }),
      { numRuns: 500 },
    );
  });
});
