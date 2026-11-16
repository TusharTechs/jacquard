// Property 23: Violations are over the limit, exclusive and sorted.
// Feature: weave-engine, Property 23: Violations are over the limit, exclusive and sorted
// **Validates: Requirements 4.3, 4.4, 4.6**

import * as fc from "fast-check";
import { describe, it } from "vitest";

import { checkFloats } from "../src/index.js";
import type { Violation } from "../src/types.js";

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

/** A warp line is identified by its end, a weft line by its pick. */
function lineId(v: Violation): string {
  const index = v.kind === "unbound" ? v.line : v.direction === "warp" ? v.end : v.pick;
  return `${v.direction}:${index}`;
}

describe("Property 23: Violations are over the limit, exclusive and sorted (4.3, 4.4, 4.6)", () => {
  it("floats exceed their direction limit, no line is both float and unbound, output follows the 4.6 key", () => {
    fc.assert(
      fc.property(liftPlanArb(), ({ plan, profile }) => {
        const result = checkFloats(plan, profile);
        if (!result.ok) throw new Error(`checkFloats failed: ${result.error.code}`);
        const violations = result.value;
        const context = () =>
          `repeatAcross=${plan.repeatAcross} maxWarpFloat=${profile.maxWarpFloat} ` +
          `maxWeftFloat=${profile.maxWeftFloat} wovenFaceDown=${profile.wovenFaceDown}\n` +
          JSON.stringify(violations);

        for (const v of violations) {
          if (v.kind !== "float") continue;
          const limit = v.direction === "warp" ? profile.maxWarpFloat : profile.maxWeftFloat;
          if (!(v.length > limit)) throw new Error(`float not over limit ${limit}: ${JSON.stringify(v)}\n${context()}`);
        }

        const unboundLines = new Set(violations.filter((v) => v.kind === "unbound").map(lineId));
        for (const v of violations) {
          if (v.kind === "float" && unboundLines.has(lineId(v))) {
            throw new Error(`line ${lineId(v)} is both float and unbound\n${context()}`);
          }
        }

        for (let i = 1; i < violations.length; i += 1) {
          if (compare(violations[i - 1] as Violation, violations[i] as Violation) > 0) {
            throw new Error(`out of order at index ${i}\n${context()}`);
          }
        }
      }),
      { numRuns: 500 },
    );
  });
});
