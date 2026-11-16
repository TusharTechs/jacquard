// Loom profiles (1.2 to 1.5). See design.md, "Components and Interfaces", Profiles.
//
// Every loom fact is a profile field with a default, never a constant in engine logic. Each default
// carries its label, in square brackets, in a comment on the same line. The labels mean:
//   sourced     stated in source S1, not yet checked on a working loom
//   convention  standard weaving practice
//   decision    our design choice
//   to verify   not yet confirmed on a real loom or in a source
//
// S1: "Jacquard Machines: Instruction Paper", Lowell Textile School, American School of
// Correspondence, 1909, Project Gutenberg ebook #50532. Quotes were relayed by the user.
//
// This profile format has not been tested on a working loom.

import type { EngineResult } from "./errors.js";
import { profileInvalid } from "./errors.js";
import { err, ok } from "./result.js";
import type { LoomProfile } from "./types.js";

export const PROFILE_120: LoomProfile = Object.freeze({
  hookCount: 120, // [decision] built-in size requested for version 1
  hooksPerCardRow: 8, // [to verify] assumed; S1 states rows of eight only for the 400-hook machine
  spareHookCount: 0, // [to verify] assumed; S1 says nearly all machines have 16 to 26 extra hooks
  spareHookPlacement: "afterFiguring", // [to verify] spare positions after the last figuring hook
  maxFloat: 8, // [decision] working default; the right value depends on thread density
  maxWarpFloat: 8, // [decision] defaults to maxFloat
  maxWeftFloat: 8, // [decision] defaults to maxFloat
  regionLimit: 4, // [decision] default 4, maximum 8
  holeMeans: "lift", // [convention] consistent with S1: needles tend "to pierce the card where it is blank"; the cylinder presses off "the hooks that are not to be lifted"
  cardFillOrder: "ascending", // [to verify] assumed to match PROFILE_400, whose line quotes S1 for slot 0 at the top; row 0 at the numbered end is also unconfirmed
  wovenFaceDown: false, // [decision] the face is the side facing up on the loom
});

export const PROFILE_240: LoomProfile = Object.freeze({
  hookCount: 240, // [decision] built-in size requested for version 1
  hooksPerCardRow: 8, // [to verify] assumed; S1 states rows of eight only for the 400-hook machine
  spareHookCount: 0, // [to verify] assumed; S1 says nearly all machines have 16 to 26 extra hooks
  spareHookPlacement: "afterFiguring", // [to verify] spare positions after the last figuring hook
  maxFloat: 8, // [decision] working default; the right value depends on thread density
  maxWarpFloat: 8, // [decision] defaults to maxFloat
  maxWeftFloat: 8, // [decision] defaults to maxFloat
  regionLimit: 4, // [decision] default 4, maximum 8
  holeMeans: "lift", // [convention] consistent with S1: needles tend "to pierce the card where it is blank"; the cylinder presses off "the hooks that are not to be lifted"
  cardFillOrder: "ascending", // [to verify] assumed to match PROFILE_400, whose line quotes S1 for slot 0 at the top; row 0 at the numbered end is also unconfirmed
  wovenFaceDown: false, // [decision] the face is the side facing up on the loom
});

export const PROFILE_400: LoomProfile = Object.freeze({
  hookCount: 400, // [sourced] S1: "There are four hundred hooks and four hundred needles in the machine which are in rows of eight hooks and eight needles."
  hooksPerCardRow: 8, // [sourced] S1: "There are four hundred hooks and four hundred needles in the machine which are in rows of eight hooks and eight needles."
  spareHookCount: 16, // [sourced] S1: "A needle board or plate for a 400-machine, has 416 holes, arranged in 52 rows with 8 holes in a row." and "Nearly all machines have a few extra hooks (from 16 to 26) ... chiefly used for extra work, such as selvedge, extra harnesses, etc."
  spareHookPlacement: "afterFiguring", // [to verify] spare positions after the last figuring hook
  maxFloat: 8, // [decision] working default; the right value depends on thread density
  maxWarpFloat: 8, // [decision] defaults to maxFloat
  maxWeftFloat: 8, // [decision] defaults to maxFloat
  regionLimit: 4, // [decision] default 4, maximum 8
  holeMeans: "lift", // [convention] consistent with S1: needles tend "to pierce the card where it is blank"; the cylinder presses off "the hooks that are not to be lifted"
  cardFillOrder: "ascending", // [sourced] S1: "The first needle is the one ... nearest the needle board at the top ... and the others are graded down until the eighth" (slot 0 at top); row 0 at the numbered end is [to verify]
  wovenFaceDown: false, // [decision] the face is the side facing up on the loom
});

/**
 * Defaults for a custom profile whose `hookCount` is not 120, 240 or 400. Those three sizes start
 * from their built-in profile instead (see `defineProfile`).
 */
const FALLBACK_DEFAULTS: Omit<LoomProfile, "hookCount"> = Object.freeze({
  hooksPerCardRow: 8, // [to verify] same assumed default as the 120 and 240 profiles
  spareHookCount: 0, // [to verify] 0 as for the 120 and 240 profiles; only PROFILE_400 has spare hooks that S1 states
  spareHookPlacement: "afterFiguring", // [to verify] spare positions after the last figuring hook
  maxFloat: 8, // [decision] working default; the right value depends on thread density
  maxWarpFloat: 8, // [decision] defaults to maxFloat
  maxWeftFloat: 8, // [decision] defaults to maxFloat
  regionLimit: 4, // [decision] default 4, maximum 8
  holeMeans: "lift", // [convention] consistent with S1: needles tend "to pierce the card where it is blank"; the cylinder presses off "the hooks that are not to be lifted"
  cardFillOrder: "ascending", // [to verify] assumed to match PROFILE_400, whose line quotes S1 for slot 0 at the top; row 0 at the numbered end is also unconfirmed
  wovenFaceDown: false, // [decision] the face is the side facing up on the loom
});

const BUILT_IN_PROFILES: Readonly<Record<number, LoomProfile>> = {
  120: PROFILE_120,
  240: PROFILE_240,
  400: PROFILE_400,
};

/** The fields of a custom profile. Only `hookCount` is required. */
export type ProfileFields = Pick<LoomProfile, "hookCount"> &
  Partial<Omit<LoomProfile, "hookCount">>;

/**
 * Builds a profile from the given fields (1.4). Every field that is given is kept exactly as given,
 * even when it is invalid, so that `validateProfile` can reject it. Every omitted field takes its
 * default, and an explicit `undefined` counts as omitted.
 *
 * When `hookCount` is 120, 240 or 400, the defaults are that built-in profile's, so a custom
 * 400-hook profile gets the sourced 16 spare hooks unless the caller overrides them. Any other
 * `hookCount` gets `FALLBACK_DEFAULTS`. `maxWarpFloat` and `maxWeftFloat` default to the resolved
 * `maxFloat`, not to the base profile's own limits.
 */
export function defineProfile(fields: ProfileFields): LoomProfile {
  const base = BUILT_IN_PROFILES[fields.hookCount] ?? FALLBACK_DEFAULTS;
  const maxFloat = fields.maxFloat ?? base.maxFloat;
  return {
    hookCount: fields.hookCount,
    hooksPerCardRow: fields.hooksPerCardRow ?? base.hooksPerCardRow,
    spareHookCount: fields.spareHookCount ?? base.spareHookCount,
    spareHookPlacement: fields.spareHookPlacement ?? base.spareHookPlacement,
    maxFloat,
    maxWarpFloat: fields.maxWarpFloat ?? maxFloat,
    maxWeftFloat: fields.maxWeftFloat ?? maxFloat,
    regionLimit: fields.regionLimit ?? base.regionLimit,
    holeMeans: fields.holeMeans ?? base.holeMeans,
    cardFillOrder: fields.cardFillOrder ?? base.cardFillOrder,
    wovenFaceDown: fields.wovenFaceDown ?? base.wovenFaceDown,
  };
}

function isPositiveInteger(value: unknown): boolean {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function isNonNegativeInteger(value: unknown): boolean {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

/**
 * Checks a profile (1.5), field by field in the order of the 1.2 table, and returns the first
 * failure as PROFILE_INVALID. Unknown extra fields are ignored. On success it returns the same
 * object it was given.
 */
export function validateProfile(profile: unknown): EngineResult<LoomProfile> {
  if (typeof profile !== "object" || profile === null || Array.isArray(profile)) {
    return err(profileInvalid("profile", profile));
  }
  const fields = profile as Readonly<Record<string, unknown>>;

  const checks: readonly (readonly [string, (value: unknown) => boolean])[] = [
    ["hookCount", isPositiveInteger],
    ["hooksPerCardRow", isPositiveInteger],
    ["spareHookCount", isNonNegativeInteger],
    ["spareHookPlacement", (value) => value === "afterFiguring"], // the only placement in version 1
    ["maxFloat", isPositiveInteger],
    ["maxWarpFloat", isPositiveInteger],
    ["maxWeftFloat", isPositiveInteger],
    [
      "regionLimit",
      (value) => typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 8,
    ],
    ["holeMeans", (value) => value === "lift" || value === "noLift"],
    ["cardFillOrder", (value) => value === "ascending"], // the only fill order in version 1
    ["wovenFaceDown", (value) => typeof value === "boolean"],
  ];

  for (const [field, isValid] of checks) {
    const value = fields[field];
    if (!isValid(value)) return err(profileInvalid(field, value));
  }
  return ok(profile as LoomProfile);
}
