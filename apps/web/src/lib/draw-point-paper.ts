// Draws the point paper on a canvas (9.1, 10.2, 10.4). Display only: region numbers become
// colours, the engine's violations and errors become outlines and markers, and the engine's
// auto-fix flips become small diamonds. Pick 0 is the
// bottom row and end 0 the left column. Positions are rounded to device pixels so lines stay sharp.
import type { Design } from "@jacquard/engine";
import type { MarkKind } from "./violation-marks";
import { cellKey } from "./violation-marks";

export const PAPER_COLOURS = {
  lightLine: "rgba(27, 26, 23, 0.16)",
  heavyLine: "rgba(27, 26, 23, 0.6)",
  violation: "#d6006f",
  halo: "#ffffff",
  error: "#1b1a17",
  cursor: "#1d5c63",
  hover: "rgba(27, 26, 23, 0.7)",
  flip: "#1b1a17",
} as const;

/** Every 8 cells a heavier line (design-language.md). */
export const HEAVY_EVERY = 8;
/** Below this cell size the light lines are left out so the colours stay readable [decision]. */
export const LIGHT_LINES_FROM = 6;
/** Largest canvas side in device pixels; the pixel ratio is lowered past it [decision]. */
export const MAX_CANVAS_SIDE = 8192;
/** Region numbers are drawn only from this cell size, so the digits stay legible [decision]. */
export const NUMBERS_FROM = 12;

export interface PaperView {
  readonly design: Design;
  readonly colours: readonly string[];
  readonly cellSize: number;
  readonly pixelRatio: number;
  readonly marks: ReadonlyMap<string, MarkKind>;
  readonly errorCell: { readonly end: number; readonly pick: number } | null;
  /** Cells auto-fix flipped in the lift plan, keyed like `marks`. */
  readonly flips?: ReadonlySet<string>;
  readonly regionNumbers?: boolean;
  readonly cursor: { readonly end: number; readonly pick: number } | null;
  readonly hover: { readonly end: number; readonly pick: number } | null;
}

/** Black or white text, whichever reads better on a `#rrggbb` colour. */
function textOn(colour: string): string {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(colour);
  if (match === null) return "#1b1a17";
  const [r, g, b] = [match[1], match[2], match[3]].map((part) => {
    const c = parseInt(part ?? "0", 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.18 ? "#1b1a17" : "#ffffff";
}

/** The pixel ratio actually used, capped so the canvas stays under MAX_CANVAS_SIDE. */
export function effectiveRatio(ends: number, picks: number, cellSize: number, pixelRatio: number): number {
  const side = Math.max(ends, picks, 1) * cellSize;
  return Math.max(0.5, Math.min(pixelRatio, MAX_CANVAS_SIDE / side));
}

export function drawPointPaper(canvas: HTMLCanvasElement, view: PaperView): void {
  const picks = view.design.length;
  const ends = view.design[0]?.length ?? 0;
  const ratio = effectiveRatio(ends, picks, view.cellSize, view.pixelRatio);
  const cs = view.cellSize;
  const px = (cells: number): number => Math.round(cells * cs * ratio);
  const width = px(ends);
  const height = px(picks);
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  canvas.style.width = `${ends * cs}px`;
  canvas.style.height = `${picks * cs}px`;
  const ctx = canvas.getContext("2d");
  if (ctx === null) return;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, width, height);

  const colourOf = (region: number): string => view.colours[region] ?? "#888888";
  /** Row on screen for a pick: pick 0 is the bottom row. */
  const rowOf = (pick: number): number => picks - 1 - pick;
  const rect = (end: number, pick: number): [number, number, number, number] => {
    const x = px(end);
    const y = px(rowOf(pick));
    return [x, y, px(end + 1) - x, px(rowOf(pick) + 1) - y];
  };

  // Cells, one fillRect per run of equal regions in a pick.
  for (let pick = 0; pick < picks; pick += 1) {
    const row = view.design[pick] ?? [];
    let start = 0;
    while (start < ends) {
      const region = row[start] ?? 0;
      let stop = start + 1;
      while (stop < ends && (row[stop] ?? 0) === region) stop += 1;
      ctx.fillStyle = colourOf(region);
      const y = px(rowOf(pick));
      ctx.fillRect(px(start), y, px(stop) - px(start), px(rowOf(pick) + 1) - y);
      start = stop;
    }
  }

  // Grid lines: light between cells, heavy every 8 counted from end 0 and from pick 0.
  const line = Math.max(1, Math.round(ratio));
  const drawLines = (heavy: boolean): void => {
    ctx.fillStyle = heavy ? PAPER_COLOURS.heavyLine : PAPER_COLOURS.lightLine;
    for (let end = 0; end <= ends; end += 1) {
      if ((end % HEAVY_EVERY === 0) !== heavy) continue;
      const x = Math.min(px(end), width - line);
      ctx.fillRect(x, 0, line, height);
    }
    for (let pick = 0; pick <= picks; pick += 1) {
      if ((pick % HEAVY_EVERY === 0) !== heavy) continue;
      // The line under pick `pick` sits at the bottom edge of its row.
      const y = Math.min(px(picks - pick), height - line);
      ctx.fillRect(0, y, width, line);
    }
  };
  if (cs >= LIGHT_LINES_FROM) drawLines(false);
  drawLines(true);

  // Region numbers, when asked for and the cells are large enough.
  if (view.regionNumbers === true && cs >= NUMBERS_FROM) {
    ctx.font = `${Math.round(cs * 0.55 * ratio)}px ui-monospace, Menlo, monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let pick = 0; pick < picks; pick += 1) {
      const row = view.design[pick] ?? [];
      for (let end = 0; end < ends; end += 1) {
        const region = row[end] ?? 0;
        const [x, y, w, h] = rect(end, pick);
        ctx.fillStyle = textOn(colourOf(region));
        ctx.fillText(String(region), x + w / 2, y + h / 2);
      }
    }
  }

  // Violations: a halo and a strong outline on every cell of the float, and a triangle in the top
  // right corner of its first cell, so colour is never the only signal.
  const stroke = Math.max(1, Math.round(Math.min(2, cs / 4) * ratio));
  for (const [key, kind] of view.marks) {
    const [pickText, endText] = key.split(",");
    const pick = Number(pickText);
    const end = Number(endText);
    if (!(pick >= 0 && pick < picks && end >= 0 && end < ends)) continue;
    const [x, y, w, h] = rect(end, pick);
    ctx.lineWidth = stroke;
    ctx.strokeStyle = PAPER_COLOURS.violation;
    ctx.strokeRect(x + stroke / 2, y + stroke / 2, w - stroke, h - stroke);
    if (w > stroke * 4) {
      ctx.lineWidth = Math.max(1, stroke / 2);
      ctx.strokeStyle = PAPER_COLOURS.halo;
      ctx.strokeRect(x + stroke * 1.25, y + stroke * 1.25, w - stroke * 2.5, h - stroke * 2.5);
    }
    if (kind === "start") {
      const size = Math.max(3 * ratio, w * 0.5);
      ctx.beginPath();
      ctx.moveTo(x + w - size, y);
      ctx.lineTo(x + w, y);
      ctx.lineTo(x + w, y + size);
      ctx.closePath();
      ctx.fillStyle = PAPER_COLOURS.violation;
      ctx.fill();
      ctx.lineWidth = Math.max(1, ratio / 2);
      ctx.strokeStyle = PAPER_COLOURS.halo;
      ctx.stroke();
    }
  }

  // Auto-fix flips: a small filled diamond with a white edge in the cell centre, a shape of its own.
  for (const key of view.flips ?? []) {
    const [pickText, endText] = key.split(",");
    const pick = Number(pickText);
    const end = Number(endText);
    if (!(pick >= 0 && pick < picks && end >= 0 && end < ends)) continue;
    const [x, y, w, h] = rect(end, pick);
    const cx = x + w / 2;
    const cy = y + h / 2;
    const r = Math.max(2 * ratio, w * 0.28);
    ctx.beginPath();
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx + r, cy);
    ctx.lineTo(cx, cy + r);
    ctx.lineTo(cx - r, cy);
    ctx.closePath();
    ctx.fillStyle = PAPER_COLOURS.flip;
    ctx.fill();
    ctx.lineWidth = Math.max(1, ratio);
    ctx.strokeStyle = PAPER_COLOURS.halo;
    ctx.stroke();
  }

  // An engine error that names a cell: a dashed outline and a cross, a different shape.
  const bad = view.errorCell;
  if (bad !== null && bad.pick >= 0 && bad.pick < picks && bad.end >= 0 && bad.end < ends) {
    const [x, y, w, h] = rect(bad.end, bad.pick);
    ctx.save();
    ctx.setLineDash([Math.max(2, w / 4), Math.max(2, w / 6)]);
    ctx.lineWidth = stroke;
    ctx.strokeStyle = PAPER_COLOURS.error;
    ctx.strokeRect(x + stroke / 2, y + stroke / 2, w - stroke, h - stroke);
    ctx.restore();
    const inset = w * 0.25;
    for (const [colour, widthFactor] of [
      [PAPER_COLOURS.halo, 3],
      [PAPER_COLOURS.error, 1.5],
    ] as const) {
      ctx.beginPath();
      ctx.moveTo(x + inset, y + inset);
      ctx.lineTo(x + w - inset, y + h - inset);
      ctx.moveTo(x + w - inset, y + inset);
      ctx.lineTo(x + inset, y + h - inset);
      ctx.lineWidth = Math.max(1, widthFactor * ratio);
      ctx.strokeStyle = colour;
      ctx.stroke();
    }
  }

  // Hover: a thin dark outline. Cursor: a 2px focus ring with a white inner edge.
  const hover = view.hover;
  if (hover !== null && hover.pick >= 0 && hover.pick < picks && hover.end >= 0 && hover.end < ends) {
    const [x, y, w, h] = rect(hover.end, hover.pick);
    ctx.lineWidth = Math.max(1, Math.round(ratio));
    ctx.strokeStyle = PAPER_COLOURS.hover;
    ctx.strokeRect(x + 0.5 * ctx.lineWidth, y + 0.5 * ctx.lineWidth, w - ctx.lineWidth, h - ctx.lineWidth);
  }
  const cursor = view.cursor;
  if (cursor !== null && cursor.pick >= 0 && cursor.pick < picks && cursor.end >= 0 && cursor.end < ends) {
    const [x, y, w, h] = rect(cursor.end, cursor.pick);
    const ring = Math.max(2, Math.round(2 * ratio));
    ctx.lineWidth = ring;
    ctx.strokeStyle = PAPER_COLOURS.cursor;
    // Drawn inside the cell so the ring is whole on the edge cells too.
    ctx.strokeRect(x + ring / 2, y + ring / 2, w - ring, h - ring);
    const inner = Math.max(1, Math.round(ratio));
    if (w > ring * 2 + inner * 2) {
      ctx.lineWidth = inner;
      ctx.strokeStyle = PAPER_COLOURS.halo;
      ctx.strokeRect(x + ring + inner / 2, y + ring + inner / 2, w - 2 * ring - inner, h - 2 * ring - inner);
    }
  }
}
