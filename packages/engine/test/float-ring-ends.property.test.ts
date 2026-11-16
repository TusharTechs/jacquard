// Property 20: Ring invariance across the ends.
// Feature: weave-engine, Property 20: Ring invariance across the ends
// **Validates: Requirements 4.2**

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

/** Floats move `end`; unbound warp lines move `line` (the end); unbound weft lines keep `line` (the pick). */
function mapViolation(v: Violation, shift: number, width: number): Violation {
  const moved = (index: number): number => (index + shift) % width;
  if (v.kind === "float") return { ...v, end: moved(v.end) };
  return v.direction === "warp" ? { ...v, line: moved(v.line) } : { ...v };
}

/** Rotates the unit by `shift` ends and re-tiles it over every hook (repeatAcross is on). */
function rotateEnds(plan: LiftPlan, shift: number): LiftPlan {
  const width = plan.designWidth;
  const lifts = plan.lifts.map((row) => {
    const unit: boolean[] = [];
    for (let end = 0; end < width; end += 1) unit[(end + shift) % width] = row[end] as boolean;
    return Array.from({ length: plan.hookCount }, (_, hook) => unit[hook % width] as boolean);
  });
  return { ...plan, lifts };
}

describe("Property 20: Ring invariance across the ends (4.2)", () => {
  it("rotating the unit by k ends maps float ends and unbound warp lines by k mod W", () => {
    fc.assert(
      fc.property(
        liftPlanArb().filter((c) => c.plan.repeatAcross),
        fc.nat(),
        ({ plan, profile }, rawShift) => {
          const width = plan.designWidth;
          const shift = rawShift % width;
          const original = checkFloats(plan, profile);
          const rotated = checkFloats(rotateEnds(plan, shift), profile);
          if (!original.ok) throw new Error(`checkFloats failed: ${original.error.code}`);
          if (!rotated.ok) throw new Error(`checkFloats failed on rotated plan: ${rotated.error.code}`);
          const expected = original.value.map((v) => mapViolation(v, shift, width)).sort(compare);
          const actual = [...rotated.value].sort(compare);
          if (JSON.stringify(actual) !== JSON.stringify(expected)) {
            throw new Error(
              `shift=${shift} W=${width} repeatAcross=${plan.repeatAcross}\n` +
                `actual:   ${JSON.stringify(actual)}\nexpected: ${JSON.stringify(expected)}`,
            );
          }
        },
      ),
      { numRuns: 500 },
    );
  });
});
