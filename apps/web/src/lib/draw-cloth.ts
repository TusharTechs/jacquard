// Draws the Cloth_Model from @jacquard/export on a canvas (2.1). Display only: which thread is on
// top and its colour come from `clothModel`; this file turns each cell into a thread segment.
// A warp cell is a vertical segment (shaded at its left and right edges), a weft cell a
// horizontal one (shaded at its top and bottom edges), so a float reads as one long run.
// Pick 0 is the bottom row and end 0 the left column, as on the point paper. Both sides keep end 0
// at the left [decision].
import type { ClothCell } from "@jacquard/export";

/** Zoom range in CSS pixels per cell (2.2). */
export const MIN_ZOOM = 1;
export const MAX_ZOOM = 16;
/** Starting zoom [decision]. */
export const DEFAULT_ZOOM = 4;
/** Largest canvas backing side in device pixels; the pixel ratio is lowered past it [decision]. */
export const MAX_CLOTH_SIDE = 8192;
/** Edge shading appears from this zoom, the centre highlight from the next one [decision]. */
export const SHADE_FROM = 3;
export const HIGHLIGHT_FROM = 6;

export const CLOTH_SHADES = {
  edge: "rgba(0, 0, 0, 0.28)",
  highlight: "rgba(255, 255, 255, 0.16)",
} as const;

export interface ClothSize {
  /** Drawn size in CSS pixels. */
  readonly cssWidth: number;
  readonly cssHeight: number;
  /** Backing size in device pixels, at most MAX_CLOTH_SIDE per side. */
  readonly width: number;
  readonly height: number;
  /** Device pixels per CSS pixel actually used. */
  readonly scale: number;
}

export function clampZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return DEFAULT_ZOOM;
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(zoom)));
}

/** Canvas size for `hookCount` by `pickCount` cells, with the backing capped at MAX_CLOTH_SIDE. */
export function clothCanvasSize(hookCount: number, pickCount: number, zoom: number, pixelRatio: number): ClothSize {
  const cell = clampZoom(zoom);
  const cssWidth = Math.max(0, hookCount) * cell;
  const cssHeight = Math.max(0, pickCount) * cell;
  const ratio = Number.isFinite(pixelRatio) && pixelRatio > 0 ? pixelRatio : 1;
  const longest = Math.max(cssWidth, cssHeight, 1);
  const scale = Math.min(ratio, MAX_CLOTH_SIDE / longest);
  return {
    cssWidth,
    cssHeight,
    width: Math.max(1, Math.min(MAX_CLOTH_SIDE, Math.floor(cssWidth * scale))),
    height: Math.max(1, Math.min(MAX_CLOTH_SIDE, Math.floor(cssHeight * scale))),
    scale,
  };
}

/** The 2D context calls drawCloth uses, so tests can record them. */
export type ClothContext = Pick<CanvasRenderingContext2D, "fillRect" | "fillStyle">;

/**
 * Draws picks `fromPick` (inclusive) to `toPick` (exclusive) of `cells` at `cell` CSS pixels per
 * cell. The context must already be scaled to CSS pixels.
 */
export function drawClothRows(
  context: ClothContext,
  cells: readonly (readonly ClothCell[])[],
  cell: number,
  fromPick: number,
  toPick: number,
): void {
  const pickCount = cells.length;
  const edge = Math.max(1, Math.round(cell / 5));
  const highlight = Math.max(1, Math.round(cell / 6));
  const shade = cell >= SHADE_FROM;
  const lit = cell >= HIGHLIGHT_FROM;
  for (let pick = Math.max(0, fromPick); pick < Math.min(pickCount, toPick); pick += 1) {
    const row = cells[pick]!;
    const y = (pickCount - 1 - pick) * cell;
    let start = 0;
    while (start < row.length) {
      const first = row[start]!;
      let end = start + 1;
      while (end < row.length && row[end]!.top === first.top && row[end]!.colour === first.colour) end += 1;
      const x = start * cell;
      const width = (end - start) * cell;
      context.fillStyle = first.colour;
      context.fillRect(x, y, width, cell);
      if (shade) {
        context.fillStyle = CLOTH_SHADES.edge;
        if (first.top === "weft") {
          // One weft thread across the whole run: shade its top and bottom edges.
          context.fillRect(x, y, width, edge);
          context.fillRect(x, y + cell - edge, width, edge);
        } else {
          // Each warp end is its own thread: shade the left and right edge of every cell.
          for (let hook = start; hook < end; hook += 1) {
            context.fillRect(hook * cell, y, edge, cell);
            context.fillRect((hook + 1) * cell - edge, y, edge, cell);
          }
        }
        if (lit) {
          context.fillStyle = CLOTH_SHADES.highlight;
          if (first.top === "weft") {
            context.fillRect(x, y + Math.floor((cell - highlight) / 2), width, highlight);
          } else {
            for (let hook = start; hook < end; hook += 1) {
              context.fillRect(hook * cell + Math.floor((cell - highlight) / 2), y, highlight, cell);
            }
          }
        }
      }
      start = end;
    }
  }
}
