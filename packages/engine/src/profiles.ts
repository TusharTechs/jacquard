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

/** The fields of a custom profile. Only `hookCount` is required. */
export type ProfileFields = Pick<LoomProfile, "hookCount"> &
  Partial<Omit<LoomProfile, "hookCount">>;

/**
 * Builds a profile from the given fields (1.4). Every field that is given is kept exactly as given,
 * even when it is invalid, so that `validateProfile` can reject it. Every omitted field takes its
 * default from 1.2. An explicit `undefined` counts as omitted. `maxWarpFloat` and `maxWeftFloat`
 * default to the resolved `maxFloat`.
 */
export function defineProfile(fields: ProfileFields): LoomProfile {
  const maxFloat = fields.maxFloat ?? 8; // [decision] working default
  return {
    hookCount: fields.hookCount,
    hooksPerCardRow: fields.hooksPerCardRow ?? 8, // [to verify] same default as the 120 and 240 profiles
    spareHookCount: fields.spareHookCount ?? 0, // [to verify] 0 as for the 120 and 240 profiles; only PROFILE_400 has spare hooks that S1 states
    spareHookPlacement: fields.spareHookPlacement ?? "afterFiguring", // [to verify] spare positions after the last figuring hook
    maxFloat,
    maxWarpFloat: fields.maxWarpFloat ?? maxFloat, // [decision] defaults to maxFloat
    maxWeftFloat: fields.maxWeftFloat ?? maxFloat, // [decision] defaults to maxFloat
    regionLimit: fields.regionLimit ?? 4, // [decision] default 4, maximum 8
    holeMeans: fields.holeMeans ?? "lift", // [convention] consistent with S1
    cardFillOrder: fields.cardFillOrder ?? "ascending", // [to verify] see PROFILE_400 for what S1 states
    wovenFaceDown: fields.wovenFaceDown ?? false, // [decision]
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
