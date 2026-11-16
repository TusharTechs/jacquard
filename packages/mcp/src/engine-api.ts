// The injection seam (design, EngineApi). This is the only module that imports engine values; the
// rest of the server receives the engine through an EngineApi object, so tests can spy on it or
// replace one function.
import {
  PROFILE_120,
  PROFILE_240,
  PROFILE_400,
  autoFix,
  buildCards,
  buildLiftPlan,
  cardRows,
  checkFloats,
  decodeCards,
  defineProfile,
  validateProfile,
} from "@jacquard/engine";
import type { LoomProfile } from "@jacquard/engine";

export interface EngineApi {
  /** The built-in profiles in the order 120, 240, 400. */
  readonly profiles: readonly [LoomProfile, LoomProfile, LoomProfile];
  readonly defineProfile: typeof defineProfile;
  readonly validateProfile: typeof validateProfile;
  readonly buildLiftPlan: typeof buildLiftPlan;
  readonly checkFloats: typeof checkFloats;
  readonly autoFix: typeof autoFix;
  readonly buildCards: typeof buildCards;
  readonly cardRows: typeof cardRows;
  readonly decodeCards: typeof decodeCards;
}

export const realEngine: EngineApi = Object.freeze({
  profiles: [PROFILE_120, PROFILE_240, PROFILE_400] as const,
  defineProfile,
  validateProfile,
  buildLiftPlan,
  checkFloats,
  autoFix,
  buildCards,
  cardRows,
  decodeCards,
});
