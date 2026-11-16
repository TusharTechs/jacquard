// Example tests for badness and incremental run tables (task 11.1). Requirement 5.1.
import { describe, expect, it } from "vitest";
import { createWorkUnit, flipCell, type WorkUnit } from "../src/auto-fix.js";
import { checkFloats } from "../src/floats.js";
import { defineProfile } from "../src/profiles.js";
import type { LiftPlan, LoomProfile } from "../src/types.js";

const profile: LoomProfile = defineProfile({ hookCount: 6, maxFloat: 2 });

function planOf(rows: readonly (readonly boolean[])[], repeatAcross = false): LiftPlan {
  return { pickCount: rows.length, hookCount: 6, designWidth: 6, repeatAcross, lifts: rows };
}

/** Badness from checkFloats output, as Property 33 defines it. */
function badnessFromViolations(plan: LiftPlan): number {
  const result = checkFloats(plan, profile);
  if (!result.ok) throw new Error("plan should be valid");
  let total = 0;
  for (const v of result.value) {
    const limit = v.direction === "warp" ? profile.maxWarpFloat : profile.maxWeftFloat;
    total += v.kind === "unbound" ? Math.max(1, v.length - limit) : v.length - limit;
  }
  return total;
}

function toPlan(unit: WorkUnit): LiftPlan {
  return planOf(unit.cells.map((row) => [...row]), unit.repeatAcross);
}

describe("badness and run tables (5.1)", () => {
  const rows = [
    [true, true, true, true, true, false],
    [false, false, false, true, false, true],
    [true, false, true, false, true, false],
    [false, true, false, false, false, true],
  ];

  it("matches the badness computed from checkFloats", () => {
    const plan = planOf(rows);
    expect(createWorkUnit(plan, profile).badness).toBe(badnessFromViolations(plan));
  });

  it("stays equal to a full recomputation after each flip, and changes only its two lines", () => {
    const plan = planOf(rows);
    const unit = createWorkUnit(plan, profile);
    for (const [end, pick] of [[0, 0], [3, 1], [5, 3], [3, 1]] as const) {
      const before = unit.badness;
      const untouchedWarp = unit.warpRuns.map((runs, e) => (e === end ? null : runs));
      const delta = flipCell(unit, end, pick);
      expect(unit.badness - before).toBe(delta);
      expect(unit.badness).toBe(badnessFromViolations(toPlan(unit)));
      unit.warpRuns.forEach((runs, e) => {
        if (e !== end) expect(runs).toBe(untouchedWarp[e]);
      });
    }
  });

  it("does not modify the input plan", () => {
    const plan = planOf(rows.map((row) => Object.freeze([...row])));
    const unit = createWorkUnit(plan, profile);
    flipCell(unit, 1, 1);
    expect(plan.lifts).toEqual(rows);
  });

  it("gives a constant line max(1, L - limit)", () => {
    const plan = planOf([[true, true, true, true, true, true], [true, false, true, false, true, false]]);
    const unit = createWorkUnit(plan, profile);
    expect(unit.weftBadness[0]).toBe(4); // L=6, limit 2
    expect(unit.badness).toBe(badnessFromViolations(plan));
  });
});
