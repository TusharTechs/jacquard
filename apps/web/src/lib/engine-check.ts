// Engine calls for the float check (10.1, 10.3, 10.6). No weaving logic here: the lift plan, the
// violations and every fix come from @jacquard/engine, and engine errors are passed on unchanged.
import { autoFix, buildLiftPlan, checkFloats } from "@jacquard/engine";
import type { Design, EngineError, Flip, LiftPlan, LoomProfile, Violation, Warning, WeaveAssignment } from "@jacquard/engine";

export interface CheckInput {
  readonly design: Design;
  readonly weaves: WeaveAssignment;
  readonly profile: LoomProfile;
  readonly repeatAcross: boolean;
}

export type CheckResult =
  | {
      readonly ok: true;
      readonly plan: LiftPlan;
      readonly idleHooks: readonly number[];
      readonly warnings: readonly Warning[];
      readonly violations: readonly Violation[];
    }
  | { readonly ok: false; readonly error: EngineError };

export type FixResult =
  | { readonly ok: true; readonly plan: LiftPlan; readonly flips: readonly Flip[] }
  | { readonly ok: false; readonly error: EngineError };

let lastInput: CheckInput | undefined;
let lastResult: CheckResult | undefined;

/** buildLiftPlan then checkFloats. Repeats the last result when every input is the same reference. */
export function checkDesign(input: CheckInput): CheckResult {
  if (
    lastInput !== undefined &&
    lastResult !== undefined &&
    lastInput.design === input.design &&
    lastInput.weaves === input.weaves &&
    lastInput.profile === input.profile &&
    lastInput.repeatAcross === input.repeatAcross
  ) {
    return lastResult;
  }
  const result = runCheck(input);
  lastInput = { ...input };
  lastResult = result;
  return result;
}

function runCheck(input: CheckInput): CheckResult {
  const built = buildLiftPlan({
    design: input.design,
    weaves: input.weaves,
    profile: input.profile,
    repeatAcross: input.repeatAcross,
  });
  if (!built.ok) return { ok: false, error: built.error };
  const floats = checkFloats(built.value.plan, input.profile);
  if (!floats.ok) return { ok: false, error: floats.error };
  return {
    ok: true,
    plan: built.value.plan,
    idleHooks: built.value.idleHooks,
    warnings: built.value.warnings,
    violations: floats.value,
  };
}

/** The engine's autoFix on a plan, result passed on unchanged (AUTOFIX_FAILED included). */
export function fixDesign(plan: LiftPlan, profile: LoomProfile): FixResult {
  const fixed = autoFix(plan, profile);
  if (!fixed.ok) return { ok: false, error: fixed.error };
  return { ok: true, plan: fixed.value.plan, flips: fixed.value.flips };
}
