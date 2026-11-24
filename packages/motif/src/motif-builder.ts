// Motif_Plan to Motif_SVG (motif-builder Requirement 2). See motif-builder design.md,
// "src/motif-builder.ts and src/builder-shapes.ts".
//
// Output is Motif_SVG in a `0 0 100 100` viewBox: a full-size ground rect first, then polygons
// only. Numbers are rounded to 2 decimals about the centre line (so a mirrored point is written as
// the exact mirror) and written with `String`, so the text does not depend on locale (2.1). Pure:
// the same plan gives the same text (2.3).
import { figureLayers, patternLayers } from "./builder-shapes.js";
import type { Layer, Pt, Role } from "./builder-shapes.js";
import { FIGURE_SUBJECTS } from "./describe.js";
import type { BuilderSize, BuilderSubject, MotifPlan } from "./describe.js";
import type { Symmetry } from "./types.js";

interface Slot {
  readonly cx: number;
  readonly cy: number;
  readonly r: number;
}

/** Slot radii by layout and size (design, layout table) [decision]. */
const SINGLE_R: Readonly<Record<BuilderSize, number>> = { large: 46, medium: 38, small: 26 };
const ALL_OVER_R: Readonly<Record<BuilderSize, number>> = { large: 24, medium: 20, small: 14 };
const BORDER_SLOTS: Readonly<Record<BuilderSize, { readonly count: number; readonly r: number }>> = {
  large: { count: 2, r: 23 },
  medium: { count: 3, r: 16 },
  small: { count: 3, r: 14 },
};
/** A clipped slot in a layout of several is dropped below this radius, so no figure is a crumb. */
const MIN_CLIPPED_R = 14;
/** Border layout: edge lines this far outside the row of figures, and this thick. */
const EDGE_GAP = 3;
const EDGE_WIDTH = 5;

/** True when a figure is mirror-symmetric left to right about its own centre. */
function endsSymmetric(subject: BuilderSubject): boolean {
  return subject !== "paisley" && subject !== "elephant" && subject !== "peacock";
}

function mirrorsEnds(symmetry: Symmetry): boolean {
  return symmetry === "mirrorEnds" || symmetry === "mirrorBoth";
}

function slotsFor(plan: MotifPlan): Slot[] {
  switch (plan.layout) {
    case "single":
      return [{ cx: 50, cy: 50, r: SINGLE_R[plan.size] }];
    case "allOver": {
      const r = ALL_OVER_R[plan.size];
      return [
        { cx: 25, cy: 25, r },
        { cx: 75, cy: 25, r },
        { cx: 25, cy: 75, r },
        { cx: 75, cy: 75, r },
      ];
    }
    case "border": {
      const { count, r } = BORDER_SLOTS[plan.size];
      return Array.from({ length: count }, (_, index) => ({ cx: ((index + 0.5) * 100) / count, cy: 50, r }));
    }
  }
}

/**
 * Keeps a figure that a mirror of the ends would cut inside the Kept_Part (2.5): the slot box is
 * clipped to x ≤ 50 and the figure goes in the largest square of the clipped box, facing the
 * centre. (The Describer never mirrors the picks of a figure that is not symmetric top to bottom.)
 */
function keptSlots(slots: readonly Slot[], plan: MotifPlan): Slot[] {
  if (!mirrorsEnds(plan.symmetry) || endsSymmetric(plan.subject)) return [...slots];
  const kept: Slot[] = [];
  for (const slot of slots) {
    const x0 = slot.cx - slot.r;
    const x1 = Math.min(slot.cx + slot.r, 50);
    const width = x1 - x0;
    if (width <= 0) continue;
    const r = Math.min(width, 2 * slot.r) / 2;
    if (r < slot.r && r < MIN_CLIPPED_R && slots.length > 1) continue;
    kept.push({ cx: (x0 + x1) / 2, cy: slot.cy, r });
  }
  return kept;
}

/** The plan colour index for a role (design: role 3 → 1, role 2 → 0 unless a layer says otherwise). */
function colourIndex(layer: Layer, colourCount: number): number {
  if (layer.role < colourCount) return layer.role;
  const chain: readonly Role[] = layer.fallback === undefined ? [] : typeof layer.fallback === "number" ? [layer.fallback] : layer.fallback;
  for (const role of chain) if (role < colourCount) return role;
  return layer.role === 3 && colourCount > 1 ? 1 : 0;
}

/** Rounds to 2 decimals about 50, so mirrored values are written as exact mirrors. */
function num(value: number): string {
  const offset = value - 50;
  const rounded = (offset < 0 ? -1 : 1) * Math.round(Math.abs(offset) * 100);
  const result = Math.round(5000 + rounded) / 100;
  return String(result === 0 ? 0 : result);
}

function polygonElement(points: readonly Pt[], fill: string): string {
  return `<polygon points="${points.map(([x, y]) => `${num(x)},${num(y)}`).join(" ")}" fill="${fill}"/>`;
}

/** Motif_SVG for a plan (Requirement 2). */
export function buildMotif(plan: MotifPlan): string {
  const colours = plan.colours.map((colour) => colour.hex);
  const k = colours.length;
  const ground = colours[0] as string;
  const elements: string[] = [`<rect x="0" y="0" width="100" height="100" fill="${ground}"/>`];
  const emit = (layer: Layer, place: (point: Pt) => Pt): void => {
    const fill = colours[colourIndex(layer, k)] as string;
    for (const polygon of layer.polygons) {
      if (polygon.length >= 3) elements.push(polygonElement(polygon.map(place), fill));
    }
  };

  if (FIGURE_SUBJECTS.has(plan.subject)) {
    if (plan.layout === "border") {
      const reach = BORDER_SLOTS[plan.size].r + EDGE_GAP;
      const lines: Pt[][] = [
        [[0, 50 - reach - EDGE_WIDTH], [100, 50 - reach - EDGE_WIDTH], [100, 50 - reach], [0, 50 - reach]],
        [[0, 50 + reach], [100, 50 + reach], [100, 50 + reach + EDGE_WIDTH], [0, 50 + reach + EDGE_WIDTH]],
      ];
      emit({ role: 1, polygons: lines }, (point) => point);
    }
    const layers = figureLayers(plan.subject, plan.count);
    for (const slot of keptSlots(slotsFor(plan), plan)) {
      const place = ([u, v]: Pt): Pt => [slot.cx + slot.r * u, slot.cy + slot.r * v];
      for (const layer of layers) emit(layer, place);
    }
  } else {
    for (const layer of patternLayers(plan.subject, plan.count)) emit(layer, (point) => point);
  }

  return [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">',
    `<title>Motif builder: ${plan.subject}</title>`,
    ...elements,
    "</svg>",
  ].join("");
}
