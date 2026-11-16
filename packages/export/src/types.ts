// Public types of @jacquard/export, and the shared input check. See
// .kiro/specs/simulate-and-export/design.md, "Architecture" and "Error Handling".
//
// Orientation follows the engine: ends (hooks) index across from the left, picks index in weaving
// order. `x` and `y` are used only for drawing geometry.
import {
  err,
  ok,
  validatePlan,
  validateProfile,
  type EngineError,
  type LiftPlan,
  type LoomProfile,
  type Result,
} from "@jacquard/engine";

/** Yarn colours, `#rrggbb` hex (glossary). Warp repeats over ends, weft repeats over picks (1.3). */
export interface YarnColours {
  readonly warp: readonly string[];
  readonly weft: readonly string[];
}

/** One end-pick crossing of the Cloth_Model, for the chosen side (glossary, 1.2, 1.3). */
export interface ClothCell {
  readonly top: "warp" | "weft";
  readonly colour: string;
}

/** Codes of the errors that @jacquard/export adds to the engine's. */
export type ExportErrorCode = "YARN_INVALID" | "WIF_INVALID" | "DESIGN_INVALID";

/**
 * Typed failure of an export function. Either one of this package's own errors, or the engine's
 * error passed through unchanged (4.8). `message` is built only from the other fields.
 */
export type ExportError =
  | { readonly code: ExportErrorCode; readonly message: string; readonly detail?: string }
  | EngineError;

/** The result type of every public function of @jacquard/export. */
export type ExportResult<T> = Result<T, ExportError>;

/** Builds one of this package's own errors. */
export function exportError(code: ExportErrorCode, message: string, detail?: string): ExportError {
  return detail === undefined ? { code, message } : { code, message, detail };
}

/**
 * The engine checks every export runs first (4.8): `validateProfile`, then `validatePlan`. The
 * first engine error is returned unchanged. The profile check comes first because `validatePlan`
 * reads only `hookCount`, and a profile with, say, `hooksPerCardRow: 0` must not reach the card
 * layout. The inputs are not modified.
 */
export function checkPlan(plan: LiftPlan, profile: LoomProfile): Result<LiftPlan, EngineError> {
  const profileResult = validateProfile(profile);
  if (!profileResult.ok) return err(profileResult.error);
  const planResult = validatePlan(plan, profile);
  if (!planResult.ok) return err(planResult.error);
  return ok(plan);
}
