// The auto-fix result kept by the app. Auto-fix flips lift-plan cells, never regions, so the
// fixed plan sits next to the design and records what it was made from. Any later change to the
// design, the weaves or the setup discards it (later phases export it).
import type { Design, EngineError, Flip, LiftPlan, LoomProfile, WeaveAssignment } from "@jacquard/engine";

export interface FixSource {
  readonly design: Design;
  readonly weaves: WeaveAssignment;
  readonly profile: LoomProfile;
  readonly repeatAcross: boolean;
}

export type AutofixFailed = Extract<EngineError, { readonly code: "AUTOFIX_FAILED" }>;

export type FixState =
  | { readonly status: "none" }
  | { readonly status: "fixed"; readonly plan: LiftPlan; readonly flips: readonly Flip[]; readonly remaining: number; readonly source: FixSource }
  | { readonly status: "failed"; readonly error: AutofixFailed; readonly source: FixSource }
  | { readonly status: "error"; readonly error: EngineError; readonly source: FixSource }
  | { readonly status: "discarded" };

export function sameSource(a: FixSource, b: FixSource): boolean {
  return a.design === b.design && a.weaves === b.weaves && a.profile === b.profile && a.repeatAcross === b.repeatAcross;
}
