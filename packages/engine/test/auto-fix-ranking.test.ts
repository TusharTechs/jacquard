// Example tests for safe-flip detection and cell ranking (task 11.2). Requirements 5.4, 5.7.
import { describe, expect, it } from "vitest";
import {
  candidatesOf,
  createWorkUnit,
  isSafeFlip,
  latticeFor,
  onLattice,
  rankSafeCandidates,
  type FixTarget,
} from "../src/auto-fix.js";
import { defineProfile } from "../src/profiles.js";
import type { LiftPlan } from "../src/types.js";

function unitOf(rows: readonly (readonly boolean[])[], limit: number, repeatAcross = false) {
  const width = (rows[0] as readonly boolean[]).length;
  const profile = defineProfile({ hookCount: width, maxFloat: limit });
  const plan: LiftPlan = { pickCount: rows.length, hookCount: width, designWidth: width, repeatAcross, lifts: rows };
  return createWorkUnit(plan, profile);
}

/** Rows of "1"/"0" text, one string per pick, one character per end. */
const grid = (...picks: string[]): boolean[][] => picks.map((text) => [...text].map((c) => c === "1"));

describe("lattice parameters (5.7)", () => {
  it("gives n = 9, s = 2 for limit 8", () => {
    expect(latticeFor(8)).toEqual({ size: 9, step: 2 });
  });
  it("uses the largest size with a satin step", () => {
    expect(latticeFor(7)).toEqual({ size: 8, step: 3 });
    expect(latticeFor(6)).toEqual({ size: 7, step: 2 });
    expect(latticeFor(5)).toEqual({ size: 5, step: 2 }); // 6 has no satin step
    expect(latticeFor(4)).toEqual({ size: 5, step: 2 });
  });
  it("falls back to size limit + 1, step 1 below 5", () => {
    expect(latticeFor(3)).toEqual({ size: 4, step: 1 });
    expect(latticeFor(2)).toEqual({ size: 3, step: 1 });
    expect(latticeFor(1)).toEqual({ size: 2, step: 1 });
  });
  it("tests the lattice with a non-negative modulo", () => {
    const lattice = latticeFor(8);
    expect(onLattice(lattice, 0, 0)).toBe(true);
    expect(onLattice(lattice, 1, 2)).toBe(true);
    expect(onLattice(lattice, 5, 1)).toBe(true); // 1 - 10 = -9
    expect(onLattice(lattice, 1, 1)).toBe(false);
  });
});

describe("safe flips (5.4)", () => {
  it("is safe when both new runs stay within the limits", () => {
    // Limit 3. Flipping end 0 of pick 0 gives warp ring 0,0,1,0 (run 3) and weft 0010 (run 2).
    const unit = unitOf(grid("1010", "0101", "1010", "0101"), 3);
    expect(isSafeFlip(unit, 0, 0)).toBe(true);
  });

  it("is unsafe when merging neighbours exceeds the weft limit", () => {
    // Limit 2. Pick 0 is 110110; flipping end 2 gives 111110, a run of 5.
    const unit = unitOf(grid("110110", "010101", "101010", "010101"), 2);
    expect(isSafeFlip(unit, 2, 0)).toBe(false);
  });

  it("is unsafe when merging neighbours exceeds the warp limit", () => {
    // Limit 2. End 0 over picks is 1,1,0,1,0; flipping pick 2 gives 1,1,1,1,0, a run of 4.
    const unit = unitOf(grid("1010", "1101", "0010", "1101", "0010"), 2);
    expect(isSafeFlip(unit, 0, 2)).toBe(false);
  });

  it("counts the warp run across the ring seam", () => {
    // Limit 3. End 0 is 1,0,0,1,1; flipping pick 1 gives 1,1,0,1,1: a ring run of 4 over the seam.
    const unit = unitOf(grid("1010", "0101", "0010", "1101", "1010"), 3);
    expect(isSafeFlip(unit, 0, 1)).toBe(false);
  });

  it("is unsafe when the flip makes a line constant", () => {
    // Limit 3. Pick 0 is 1110; flipping end 3 gives 1111.
    const unit = unitOf(grid("1110", "0101", "1010", "0101"), 3);
    expect(isSafeFlip(unit, 3, 0)).toBe(false);
  });

  it("treats a weft line as a ring only with repeatAcross", () => {
    // Limit 2. Flipping end 3 of pick 3 gives 0100: zeros at ends 2,3 (run 2), or 2,3,0 (run 3) on a ring.
    const rows = grid("1011", "0100", "1011", "0101");
    expect(isSafeFlip(unitOf(rows, 2, false), 3, 3)).toBe(true);
    expect(isSafeFlip(unitOf(rows, 2, true), 3, 3)).toBe(false);
  });
});

describe("cell ranking (5.7)", () => {
  // Limit 8, so the lattice is (pick - 2*end) mod 9 = 0. End 0 has a lifted run over picks 0..11 of
  // a 20-pick ring. Ends 1 and 2 alternate so that no weft line is constant.
  const rows: boolean[][] = [];
  for (let pick = 0; pick < 20; pick += 1) rows.push([pick < 12, pick % 2 === 1, pick % 2 === 0]);
  const target: FixTarget = { direction: "warp", line: 0, start: 0, length: 12, unbound: false };

  it("lists every cell of a run in ring order from its start", () => {
    const unit = unitOf(grid("0000", "0000", "1111"), 2);
    const wrapped: FixTarget = { direction: "weft", line: 0, start: 3, length: 3, unbound: false };
    expect(candidatesOf(unit, wrapped).map((c) => [c.end, c.offset])).toEqual([[3, 0], [0, 1], [1, 2]]);
  });

  it("ranks the safe lattice cell first", () => {
    const unit = unitOf(rows, 8);
    // Picks 0 and 9 are on the lattice for end 0. Flipping pick 0 joins the unlifted run over the
    // seam (picks 12..19 and 0: 9 > 8), so it is unsafe; pick 9 is safe.
    expect(isSafeFlip(unit, 0, 0)).toBe(false);
    expect(rankSafeCandidates(unit, target)[0]).toEqual({ end: 0, pick: 9, offset: 9 });
  });

  it("orders off-lattice cells by smaller longest piece, then lower offset", () => {
    const unit = unitOf(rows, 8);
    const ranked = rankSafeCandidates(unit, target);
    // After pick 9, the best pieces are max(o, 11 - o) = 6 at offsets 5 and 6; offset 5 wins the tie.
    expect(ranked[1]).toEqual({ end: 0, pick: 5, offset: 5 });
    expect(ranked[2]).toEqual({ end: 0, pick: 6, offset: 6 });
    // Unsafe cells (pick 0 and pick 11, which merge over the seam to 9) are absent.
    expect(ranked.map((c) => c.pick)).not.toContain(0);
    expect(ranked.map((c) => c.pick)).not.toContain(11);
  });
});
