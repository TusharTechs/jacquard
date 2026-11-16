// Example test for design grid orientation (task 7.4). Requirement 1.1.

import { describe, expect, it } from "vitest";

import { buildLiftPlan } from "../src/lift-plan.js";
import { defineProfile } from "../src/profiles.js";
import type { Design, WeaveAssignment } from "../src/types.js";

describe("design grid orientation (1.1)", () => {
  it("maps design[pick][end] to lifts[pick][hook], not the transpose", () => {
    // 3 picks by 2 ends. Region 0 is plain, region 1 is a 5-end satin, move 2, weft facing
    // (lifted only on the binding cell, where end % 5 === (2 * pick) % 5).
    const design: Design = [
      [0, 1], // pick 0
      [0, 0], // pick 1
      [1, 1], // pick 2
    ];
    const weaves: WeaveAssignment = {
      0: { kind: "plain" },
      1: { kind: "satin", size: 5, move: 2, facing: "weft" },
    };
    const profile = defineProfile({ hookCount: 4 });

    const result = buildLiftPlan({ design, weaves, profile });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const { plan, idleHooks } = result.value;

    expect(plan.pickCount).toBe(3);
    expect(plan.designWidth).toBe(2);
    expect(plan.lifts).toHaveLength(3);

    // By hand, each cell uses its own region's weave at (end = hook, pick):
    // pick 0: hook 0 plain(0,0) lifts; hook 1 satin binding end is 0, so no lift.
    // pick 1: hook 0 plain(0,1) no lift; hook 1 plain(1,1) lifts.
    // pick 2: satin binding end is 4, so neither hook lifts.
    expect(plan.lifts).toEqual([
      [true, false, false, false],
      [false, true, false, false],
      [false, false, false, false],
    ]);
    expect(idleHooks).toEqual([2, 3]);

    // The transpose reads design[end][pick] and evaluates at (end = pick, pick = hook).
    // For pick 0, hook 1 that is region design[1][0] = 0 (plain), plain(0,1) = false... and for
    // pick 1, hook 0 it is region design[0][1] = 1 (satin), satin(1,0) = false. The correct
    // pick 1, hook 1 cell is true, which the transposed reading cannot produce here.
    expect(plan.lifts[1]?.[1]).toBe(true);
    expect(plan.lifts[1]?.[0]).toBe(false);
  });
});
