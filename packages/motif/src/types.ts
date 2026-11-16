// Public types of @jacquard/motif. See design.md, "Components and Interfaces", @jacquard/motif.
//
// Grid coordinates are `end` (across, from the left) and `pick` (in weaving order, pick 0 drawn at
// the bottom of point paper). `x` and `y` are used only for SVG geometry in viewBox coordinates.

/** Mirror symmetry enforced on the design grid (Requirement 7). */
export type Symmetry = "none" | "mirrorEnds" | "mirrorPicks" | "mirrorBoth";

/** Size of one design unit. The design grid has exactly this size (5.1). */
export interface Repeat {
  readonly ends: number;
  readonly picks: number;
}

/** A point in viewBox coordinates (SVG y grows downward). */
export type Point = readonly [x: number, y: number];

/** One drawn shape as polygons in viewBox coordinates, with its palette index (4.5). */
export interface MotifShape {
  readonly paletteIndex: number;
  readonly polygons: readonly (readonly Point[])[];
}

/** A parsed Motif_SVG document (4.5, 4.6). */
export interface Motif {
  readonly viewBox: readonly [minX: number, minY: number, width: number, height: number];
  /** Lower-case `#rrggbb`; entry 0 is the background (4.6). */
  readonly palette: readonly string[];
  /** Document order (4.5). */
  readonly shapes: readonly MotifShape[];
}

/** Typed failures of the motif functions. `message` is built only from the other fields. */
export type MotifError =
  | { code: "MOTIF_SVG_INVALID"; reason: string; message: string } // 4.3, 4.4, 4.8
  | { code: "MOTIF_TOO_MANY_COLOURS"; count: number; limit: number; message: string }; // 4.7

export type MotifResult<T> = { ok: true; value: T } | { ok: false; error: MotifError };

/** Setup for the motif pipeline (7.6). */
export interface MotifSetup {
  readonly colourCount: number;
  readonly symmetry: Symmetry;
  readonly repeat: Repeat;
  readonly minFeature: number;
}
