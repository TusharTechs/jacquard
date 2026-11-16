// Loom setup model (11.1). See .kiro/specs/motif-input/design.md, "Web app".
//
// Every loom value comes from the engine's built-in profiles. The defaults below are product
// defaults for a first design, not loom facts [decision].
import { PROFILE_120, PROFILE_240, PROFILE_400 } from "@jacquard/engine";
import type { LoomProfile } from "@jacquard/engine";
import type { MotifSetup, Symmetry } from "@jacquard/motif";

export type ProfileName = "120" | "240" | "400";

export const PROFILE_NAMES: readonly ProfileName[] = ["120", "240", "400"];

export const SYMMETRIES: readonly Symmetry[] = ["none", "mirrorEnds", "mirrorPicks", "mirrorBoth"];

/** Product limits from 1.1 and 11.1 [decision]. */
export const MIN_COLOURS = 2;
export const MIN_REPEAT = 8;
export const MAX_REPEAT_PICKS = 400;
export const MIN_FEATURE_RANGE = { min: 1, max: 16 } as const;

export interface SetupState {
  readonly profile: ProfileName;
  readonly colourCount: number;
  readonly repeat: { readonly ends: number; readonly picks: number };
  readonly minFeature: number;
  readonly symmetry: Symmetry;
  readonly repeatAcross: boolean;
}

export type SetupAction =
  | { readonly type: "setProfile"; readonly profile: ProfileName }
  | { readonly type: "setColourCount"; readonly colourCount: number }
  | { readonly type: "setRepeatEnds"; readonly ends: number }
  | { readonly type: "setRepeatPicks"; readonly picks: number }
  | { readonly type: "setMinFeature"; readonly minFeature: number }
  | { readonly type: "setSymmetry"; readonly symmetry: Symmetry }
  | { readonly type: "setRepeatAcross"; readonly repeatAcross: boolean }
  /** Puts back a whole earlier setup (Undo of a gallery open). */
  | { readonly type: "replace"; readonly setup: SetupState };

const PROFILES: Readonly<Record<ProfileName, LoomProfile>> = {
  "120": PROFILE_120,
  "240": PROFILE_240,
  "400": PROFILE_400,
};

/** The engine's built-in profile for a name. */
export function resolveProfile(name: ProfileName): LoomProfile {
  return PROFILES[name];
}

/** Rounds to an integer and clamps to [min, max]; a non-finite value keeps `fallback`. */
function clampInt(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return Math.min(Math.max(fallback, min), max);
  return Math.min(Math.max(Math.round(value), min), max);
}

/** The allowed range of each numeric field for a profile. */
export function setupLimits(name: ProfileName): {
  readonly colourCount: { readonly min: number; readonly max: number };
  readonly ends: { readonly min: number; readonly max: number };
  readonly picks: { readonly min: number; readonly max: number };
  readonly minFeature: { readonly min: number; readonly max: number };
} {
  const profile = resolveProfile(name);
  return {
    colourCount: { min: MIN_COLOURS, max: profile.regionLimit },
    ends: { min: MIN_REPEAT, max: profile.hookCount },
    picks: { min: MIN_REPEAT, max: MAX_REPEAT_PICKS },
    minFeature: MIN_FEATURE_RANGE,
  };
}

/** Clamps every numeric field into the ranges of the setup's profile. */
export function clampSetup(setup: SetupState): SetupState {
  const limits = setupLimits(setup.profile);
  return {
    ...setup,
    colourCount: clampInt(setup.colourCount, limits.colourCount.min, limits.colourCount.max, 3),
    repeat: {
      ends: clampInt(setup.repeat.ends, limits.ends.min, limits.ends.max, 48),
      picks: clampInt(setup.repeat.picks, limits.picks.min, limits.picks.max, 48),
    },
    minFeature: clampInt(setup.minFeature, limits.minFeature.min, limits.minFeature.max, 2),
  };
}

export const DEFAULT_SETUP: SetupState = clampSetup({
  profile: "240",
  colourCount: 3,
  repeat: { ends: 48, picks: 48 },
  minFeature: 2,
  symmetry: "mirrorEnds",
  repeatAcross: false,
});

export function setupReducer(state: SetupState, action: SetupAction): SetupState {
  switch (action.type) {
    case "setProfile":
      if (!PROFILE_NAMES.includes(action.profile)) return state;
      return clampSetup({ ...state, profile: action.profile });
    case "setColourCount":
      return clampSetup({ ...state, colourCount: Number.isFinite(action.colourCount) ? action.colourCount : state.colourCount });
    case "setRepeatEnds":
      return clampSetup({ ...state, repeat: { ...state.repeat, ends: Number.isFinite(action.ends) ? action.ends : state.repeat.ends } });
    case "setRepeatPicks":
      return clampSetup({ ...state, repeat: { ...state.repeat, picks: Number.isFinite(action.picks) ? action.picks : state.repeat.picks } });
    case "setMinFeature":
      return clampSetup({ ...state, minFeature: Number.isFinite(action.minFeature) ? action.minFeature : state.minFeature });
    case "setSymmetry":
      if (!SYMMETRIES.includes(action.symmetry)) return state;
      return { ...state, symmetry: action.symmetry };
    case "setRepeatAcross":
      return { ...state, repeatAcross: action.repeatAcross };
    case "replace": {
      const { setup } = action;
      if (!PROFILE_NAMES.includes(setup.profile) || !SYMMETRIES.includes(setup.symmetry)) return state;
      return clampSetup({ ...setup, repeat: { ...setup.repeat } });
    }
  }
}

/** The part of the setup that `motifToDesign` needs. */
export function motifSetupOf(setup: SetupState): MotifSetup {
  return {
    colourCount: setup.colourCount,
    symmetry: setup.symmetry,
    repeat: { ends: setup.repeat.ends, picks: setup.repeat.picks },
    minFeature: setup.minFeature,
  };
}
