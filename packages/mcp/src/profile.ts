// Profile resolution (7.3, 8.6, 9.3, 9.4). Runs after argument checking, so a string is one of the
// three built-in names and a custom object has a hookCount and correctly typed fields.
import type { EngineError, LoomProfile, ProfileFields } from "@jacquard/engine";
import type { EngineApi } from "./engine-api.js";

export type ProfileResolution =
  | { readonly ok: true; readonly profile: LoomProfile }
  | { readonly ok: false; readonly error: EngineError };

const BUILT_IN_INDEX: Readonly<Record<string, 0 | 1 | 2>> = { "120": 0, "240": 1, "400": 2 };

/**
 * A built-in name returns the engine's frozen profile unmodified. An object goes through
 * `defineProfile` then `validateProfile`; a failure is the engine's PROFILE_INVALID, and the tool
 * operation must not run.
 */
export function resolveProfile(argument: unknown, engine: EngineApi): ProfileResolution {
  if (typeof argument === "string") {
    const index = BUILT_IN_INDEX[argument];
    if (index !== undefined) return { ok: true, profile: engine.profiles[index] };
  }
  const defined = engine.defineProfile(argument as ProfileFields);
  const validated = engine.validateProfile(defined);
  if (!validated.ok) return { ok: false, error: validated.error };
  return { ok: true, profile: validated.value };
}
