// engine-check: the web app passes engine results and errors on unchanged (10.1, 10.3, 10.5, 10.6).
import { PROFILE_120, autoFix, buildLiftPlan, checkFloats, defineProfile } from "@jacquard/engine";
import type { Design } from "@jacquard/engine";
import { describe, expect, it } from "vitest";
import { defaultWeaves, WEAVE_CHOICES } from "../src/lib/default-weaves";
import { checkDesign, fixDesign } from "../src/lib/engine-check";

function stripes(ends: number, picks: number, regions: number): Design {
  return Array.from({ length: picks }, (_, pick) =>
    Array.from({ length: ends }, (_, end) => Math.floor(((end + pick) % (regions * 6)) / 6)),
  );
}

describe("engine-check", () => {
  it("returns the same plan and violations as calling the engine directly", () => {
    // A small float limit, so the 1/3 twill region has violations to compare.
    const profile = defineProfile({ hookCount: 240, maxFloat: 2 });
    const design = stripes(48, 48, 3);
    const weaves = defaultWeaves(3);
    const result = checkDesign({ design, weaves, profile, repeatAcross: false });
    const built = buildLiftPlan({ design, weaves, profile, repeatAcross: false });
    expect(built.ok).toBe(true);
    if (!built.ok || !result.ok) throw new Error("expected success");
    const floats = checkFloats(built.value.plan, profile);
    if (!floats.ok) throw new Error("expected success");
    expect(floats.value.length).toBeGreaterThan(0);
    expect(result.violations).toEqual(floats.value);
    expect(result.plan).toEqual(built.value.plan);
    expect(result.idleHooks).toEqual(built.value.idleHooks);
    expect(result.warnings).toEqual(built.value.warnings);

    const fixed = fixDesign(result.plan, profile);
    const direct = autoFix(built.value.plan, profile);
    expect(fixed.ok).toBe(direct.ok);
    if (fixed.ok && direct.ok) {
      expect(fixed.plan).toEqual(direct.value.plan);
      expect(fixed.flips).toEqual(direct.value.flips);
    } else if (!fixed.ok && !direct.ok) {
      expect(fixed.error).toEqual(direct.error);
    }
  });

  it("repeats the last result for the same input references", () => {
    const profile = defineProfile({ hookCount: 240 });
    const design = stripes(16, 16, 2);
    const weaves = defaultWeaves(2);
    const first = checkDesign({ design, weaves, profile, repeatAcross: false });
    expect(checkDesign({ design, weaves, profile, repeatAcross: false })).toBe(first);
    expect(checkDesign({ design, weaves, profile, repeatAcross: true })).not.toBe(first);
  });

  it("passes the engine's DESIGN_TOO_WIDE error on unchanged", () => {
    const design = stripes(PROFILE_120.hookCount + 1, 8, 2);
    const weaves = defaultWeaves(2);
    const result = checkDesign({ design, weaves, profile: PROFILE_120, repeatAcross: false });
    const direct = buildLiftPlan({ design, weaves, profile: PROFILE_120, repeatAcross: false });
    expect(result.ok).toBe(false);
    expect(direct.ok).toBe(false);
    if (result.ok || direct.ok) return;
    expect(result.error.code).toBe("DESIGN_TOO_WIDE");
    expect(result.error).toEqual(direct.error);
  });

  it("defaultWeaves(8) is accepted by the engine for an 8-region design", () => {
    const profile = defineProfile({ hookCount: 240, regionLimit: 8 });
    const design = stripes(96, 48, 8);
    expect(new Set(design.flat()).size).toBe(8);
    const weaves = defaultWeaves(8);
    expect(Object.keys(weaves)).toHaveLength(8);
    expect(weaves[0]).toEqual({ kind: "plain" });
    expect(buildLiftPlan({ design, weaves, profile, repeatAcross: false }).ok).toBe(true);
  });

  it("every weave choice is a weave the engine accepts", () => {
    const profile = defineProfile({ hookCount: 240 });
    const design = stripes(40, 40, 1);
    for (const choice of WEAVE_CHOICES) {
      expect(buildLiftPlan({ design, weaves: { 0: choice.weave }, profile }).ok, choice.id).toBe(true);
    }
  });
});
