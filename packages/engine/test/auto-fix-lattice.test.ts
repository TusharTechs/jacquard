// Example tests for satin-lattice placement (task 11.4). Requirement 5.7.
// Solid regions with limits of 8 have long warp and weft floats. The lattice for limit 8 is
// (pick - 2 * end) mod 9 = 0 (n = 9, s = 2). Warp lines are rings, so the lattice only tiles every
// end evenly when pickCount is a multiple of n.
import { describe, expect, it } from "vitest";
import {
  candidatesOf,
  createWorkUnit,
  flipCell,
  isSafeFlip,
  latticeFor,
  onLattice,
  type FixTarget,
  type WorkUnit,
} from "../src/auto-fix.js";
import { autoFix } from "../src/auto-fix.js";
import { checkFloats } from "../src/floats.js";
import { defineProfile } from "../src/profiles.js";
import type { Flip, LiftPlan } from "../src/types.js";

function solidPlan(size: number, lifted: boolean): LiftPlan {
  const lifts: boolean[][] = [];
  for (let pick = 0; pick < size; pick += 1) lifts.push(new Array<boolean>(size).fill(lifted));
  return { pickCount: size, hookCount: size, designWidth: size, repeatAcross: false, lifts };
}

function hasDiagonalTriple(flips: readonly Flip[]): boolean {
  const at = new Set(flips.map(({ end, pick }) => `${end},${pick}`));
  return flips.some(
    ({ end, pick }) =>
      (at.has(`${end + 1},${pick + 1}`) && at.has(`${end + 2},${pick + 2}`)) ||
      (at.has(`${end + 1},${pick - 1}`) && at.has(`${end + 2},${pick - 2}`)),
  );
}

/** Violating targets (over-limit run or unbound line) that contain cell (end, pick), in `unit`. */
function targetsThrough(unit: WorkUnit, end: number, pick: number): FixTarget[] {
  const targets: FixTarget[] = [];
  const lines = [
    { direction: "warp" as const, line: end, index: pick, runs: unit.warpRuns[end], limit: unit.maxWarpFloat, length: unit.pickCount },
    { direction: "weft" as const, line: pick, index: end, runs: unit.weftRuns[pick], limit: unit.maxWeftFloat, length: unit.designWidth },
  ];
  for (const { direction, line, index, runs, limit, length } of lines) {
    if (runs === undefined) continue;
    if (runs.kind === "constant") {
      targets.push({ direction, line, start: 0, length: runs.length, unbound: true });
      continue;
    }
    for (const run of runs.runs) {
      if (run.length <= limit) continue;
      if ((index - run.start + length) % length < run.length) {
        targets.push({ direction, line, start: run.start, length: run.length, unbound: false });
      }
    }
  }
  return targets;
}

describe("auto-fix places flips on the satin lattice (5.7)", () => {
  for (const lifted of [true, false]) {
    const name = lifted ? "lifted" : "unlifted";

    it(`27 x 27 solid region, all ${name}: every flip is on the lattice`, () => {
      const size = 27;
      const profile = defineProfile({ hookCount: size, maxFloat: 8 });
      const result = autoFix(solidPlan(size, lifted), profile);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const { flips } = result.value;
      expect(flips.length).toBeGreaterThan(0);
      for (const { end, pick } of flips) {
        expect((((pick - 2 * end) % 9) + 9) % 9).toBe(0);
      }
      expect(hasDiagonalTriple(flips)).toBe(false);
    });

    it(`24 x 24 solid region, all ${name}: off-lattice only when no lattice cell of the target run is safe`, () => {
      const size = 24;
      const profile = defineProfile({ hookCount: size, maxFloat: 8 });
      const plan = solidPlan(size, lifted);
      const result = autoFix(plan, profile);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const { flips } = result.value;
      expect(flips.length).toBeGreaterThan(0);

      // Replay the flips, applying the engine's own safe-flip rule to the state before each one.
      const unit = createWorkUnit(plan, profile);
      const lattice = latticeFor(8);
      expect(lattice).toEqual({ size: 9, step: 2 });
      for (const { end, pick } of flips) {
        if (!onLattice(lattice, end, pick)) {
          const targets = targetsThrough(unit, end, pick);
          expect(targets.length).toBeGreaterThan(0);
          const someTargetHasNoSafeLatticeCell = targets.some(
            (target) =>
              !candidatesOf(unit, target).some(
                (cell) => onLattice(lattice, cell.end, cell.pick) && isSafeFlip(unit, cell.end, cell.pick),
              ),
          );
          expect(someTargetHasNoSafeLatticeCell, `off-lattice flip at end ${end}, pick ${pick}`).toBe(true);
        }
        flipCell(unit, end, pick);
      }

      expect(hasDiagonalTriple(flips)).toBe(false);
      expect(checkFloats(result.value.plan, profile)).toEqual({ ok: true, value: [] });
    });
  }
});
