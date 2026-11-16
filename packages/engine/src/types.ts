// Data models for @jacquard/engine. See .kiro/specs/weave-engine/design.md, "Data Models".
// Orientation: ends index across from the left (0 to N-1), picks index in weaving order (0 to M-1).

/** design[pick][end]: a non-negative integer region index in every cell (1.1). */
export type Design = readonly (readonly number[])[];

/** One weave per region (1.6). Parameter rules are checked by validateWeave (1.7). */
export type Weave =
  | { readonly kind: "plain" }
  | {
      readonly kind: "twill";
      readonly up: number;
      readonly down: number;
      readonly direction: "S" | "Z";
    }
  | {
      readonly kind: "satin";
      readonly size: 5 | 8;
      readonly move: number;
      readonly facing: "warp" | "weft";
    };

/** Region index to weave. Integer keys, so iteration order is ascending and JSON round-trips (6.1). */
export type WeaveAssignment = Readonly<Record<number, Weave>>;

/** Loom profile (1.2). Every [sourced] and [to verify] loom fact is a field here, never a constant. */
export interface LoomProfile {
  readonly hookCount: number;
  readonly hooksPerCardRow: number;
  readonly spareHookCount: number;
  readonly spareHookPlacement: "afterFiguring";
  readonly maxFloat: number;
  readonly maxWarpFloat: number;
  readonly maxWeftFloat: number;
  readonly regionLimit: number;
  readonly holeMeans: "lift" | "noLift";
  readonly cardFillOrder: "ascending";
  readonly wovenFaceDown: boolean;
}

export interface BuildInput {
  readonly design: Design;
  readonly weaves: WeaveAssignment;
  readonly profile: LoomProfile;
  /** Default false (2.5, 2.6). */
  readonly repeatAcross?: boolean;
}

/** Lift plan (2.1). True means the figuring hook lifts and its warp end is raised. */
export interface LiftPlan {
  readonly pickCount: number;
  readonly hookCount: number;
  readonly designWidth: number;
  readonly repeatAcross: boolean;
  /** lifts[pick][hook] */
  readonly lifts: readonly (readonly boolean[])[];
}

export interface Warning {
  readonly code: "WEAVE_PERIOD_SEAM";
  readonly region: number;
  readonly period: number;
  readonly dimension: "picks" | "ends";
  readonly size: number;
}

export interface BuildOutput {
  readonly plan: LiftPlan;
  readonly idleHooks: number[];
  readonly warnings: Warning[];
}

/** One punch card for one pick (2.7). punched[position], with figuring hook h at position h. */
export interface Card {
  /** 0-based internal index. */
  readonly index: number;
  /** Exported card number, index + 1 (2.9). */
  readonly number: number;
  readonly punched: readonly boolean[];
}

export interface CardSet {
  readonly designWidth: number;
  readonly repeatAcross: boolean;
  readonly cards: readonly Card[];
}

export type Side = "face" | "back";
export type Direction = "warp" | "weft";

/** Float checker output (4.3, 4.4). An unbound line has no start cell, so it carries `line`. */
export type Violation =
  | {
      readonly kind: "float";
      readonly direction: Direction;
      readonly side: Side;
      readonly pick: number;
      readonly end: number;
      readonly length: number;
    }
  | {
      readonly kind: "unbound";
      readonly direction: Direction;
      readonly side: Side;
      /** The end for a warp line, the pick for a weft line. */
      readonly line: number;
      readonly length: number;
    };

/** A flipped lift-plan cell, in design coordinates (5.1). */
export interface Flip {
  readonly pick: number;
  readonly end: number;
}

export interface AutoFixOutput {
  readonly plan: LiftPlan;
  readonly flips: Flip[];
}
