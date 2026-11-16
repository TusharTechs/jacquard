// Loom setup model: defaults and clamping (11.1).
import { PROFILE_120, PROFILE_240, PROFILE_400 } from "@jacquard/engine";
import { describe, expect, it } from "vitest";
import { DEFAULT_SETUP, motifSetupOf, resolveProfile, setupReducer } from "../src/state/setup-state";
import type { SetupState } from "../src/state/setup-state";

describe("setup-state", () => {
  it("starts from the product defaults", () => {
    expect(DEFAULT_SETUP).toEqual({
      profile: "240",
      colourCount: 3,
      repeat: { ends: 48, picks: 48 },
      minFeature: 2,
      symmetry: "mirrorEnds",
      repeatAcross: false,
    });
  });

  it("resolves the engine's built-in profiles", () => {
    expect(resolveProfile("120")).toBe(PROFILE_120);
    expect(resolveProfile("240")).toBe(PROFILE_240);
    expect(resolveProfile("400")).toBe(PROFILE_400);
  });

  it("clamps the repeat width to the hook count when switching to a smaller profile", () => {
    let state: SetupState = setupReducer(DEFAULT_SETUP, { type: "setProfile", profile: "400" });
    state = setupReducer(state, { type: "setRepeatEnds", ends: 400 });
    expect(state.repeat.ends).toBe(400);
    state = setupReducer(state, { type: "setProfile", profile: "240" });
    expect(state.repeat.ends).toBe(240);
    state = setupReducer(state, { type: "setProfile", profile: "120" });
    expect(state.repeat.ends).toBe(120);
    expect(state.repeat.picks).toBe(48);
    // Switching back up does not grow the width again.
    state = setupReducer(state, { type: "setProfile", profile: "400" });
    expect(state.repeat.ends).toBe(120);
  });

  it("clamps the colour count to the profile's region limit when switching profiles", () => {
    const tooMany: SetupState = { ...DEFAULT_SETUP, profile: "400", colourCount: 8 };
    const state = setupReducer(tooMany, { type: "setProfile", profile: "120" });
    expect(state.colourCount).toBe(PROFILE_120.regionLimit);
  });

  it("clamps every field to its range and rounds to whole numbers", () => {
    let state = setupReducer(DEFAULT_SETUP, { type: "setColourCount", colourCount: 9 });
    expect(state.colourCount).toBe(PROFILE_240.regionLimit);
    state = setupReducer(state, { type: "setColourCount", colourCount: 1 });
    expect(state.colourCount).toBe(2);
    state = setupReducer(state, { type: "setRepeatEnds", ends: 3 });
    expect(state.repeat.ends).toBe(8);
    state = setupReducer(state, { type: "setRepeatPicks", picks: 999 });
    expect(state.repeat.picks).toBe(400);
    state = setupReducer(state, { type: "setRepeatPicks", picks: 31.6 });
    expect(state.repeat.picks).toBe(32);
    state = setupReducer(state, { type: "setMinFeature", minFeature: 0 });
    expect(state.minFeature).toBe(1);
    state = setupReducer(state, { type: "setMinFeature", minFeature: 17 });
    expect(state.minFeature).toBe(16);
    state = setupReducer(state, { type: "setMinFeature", minFeature: Number.NaN });
    expect(state.minFeature).toBe(16);
  });

  it("passes symmetry, repeat across and the motif setup through", () => {
    let state = setupReducer(DEFAULT_SETUP, { type: "setSymmetry", symmetry: "mirrorBoth" });
    state = setupReducer(state, { type: "setRepeatAcross", repeatAcross: true });
    expect(state.symmetry).toBe("mirrorBoth");
    expect(state.repeatAcross).toBe(true);
    expect(motifSetupOf(state)).toEqual({ colourCount: 3, symmetry: "mirrorBoth", repeat: { ends: 48, picks: 48 }, minFeature: 2 });
  });
});
