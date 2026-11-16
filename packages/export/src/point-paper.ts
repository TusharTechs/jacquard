// Point-paper sheet (Requirement 5). See design.md, "Point paper".
//
// Pick 0 is drawn at the bottom and end 0 at the left [convention]. A colour index labels a weave
// region, not a yarn. Region numbers are drawn in the cells (up to 64 by 64) so that colour is not
// the only signal (5.2).
import { err, ok, type Design } from "@jacquard/engine";
import { escapeXml, hexToRgb, isHexColour } from "./text.js";
import { exportError, type ExportResult } from "./types.js";

export interface PointPaperOptions {
  /** A heading drawn above the grid. */
  readonly title?: string;
}

/** Cell size, margins and line weights in SVG user units [decision]. */
const CELL = 10;
const HEAVY_EVERY = 8;
const MARGIN_LEFT = 40;
const MARGIN_RIGHT = 10;
const MARGIN_TOP = 20;
const TITLE_HEIGHT = 20;
const AXIS_HEIGHT = 30;
const LEGEND_LINE = 16;
const NUMBERS_UP_TO = 64;
const MIN_WIDTH = 240;

function designInvalid(detail: string): ExportResult<never> {
  return err(exportError("DESIGN_INVALID", `The design cannot be drawn on point paper: ${detail}.`, detail));
}

/** Dark text on light colours and white text on dark ones (WCAG relative luminance). */
function textColourOn(colour: string): string {
  const [r, g, b] = hexToRgb(colour).map((value) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.18 ? "#1b1a17" : "#ffffff";
}

/**
 * Draws the design on point paper (5.1 to 5.3). `design[pick][end]` must be a non-empty
 * rectangular grid of non-negative integers, and `palette[region]` a `#rrggbb` colour for every
 * region used; otherwise `DESIGN_INVALID`. Each pick is drawn as runs of equal region, one
 * `<rect class="run">` per run with `data-pick`, `data-end` (first end), `data-length` and
 * `data-region`. Light lines between cells, heavy lines every 8 cells counted from end 0 and pick
 * 0, end and pick numbers (0-based, every 8 cells), region numbers in the cells when the design is
 * at most 64 by 64, and a legend. All text is escaped. Deterministic; the inputs are not modified.
 */
export function pointPaperSvg(
  design: Design,
  palette: readonly string[],
  options: PointPaperOptions = {},
): ExportResult<string> {
  if (!Array.isArray(design) || design.length === 0) return designInvalid("the design has no picks");
  const first: unknown = design[0];
  if (!Array.isArray(first) || first.length === 0) return designInvalid("the design has no ends");
  const ends = first.length;
  const picks = design.length;
  const used = new Set<number>();
  for (let pick = 0; pick < picks; pick += 1) {
    const row: unknown = design[pick];
    if (!Array.isArray(row) || row.length !== ends) {
      return designInvalid(`pick ${pick} does not have ${ends} ends`);
    }
    for (let end = 0; end < ends; end += 1) {
      const value: unknown = row[end];
      if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
        return designInvalid(`the cell at pick ${pick}, end ${end} is not a non-negative integer`);
      }
      used.add(value);
    }
  }
  if (!Array.isArray(palette)) return designInvalid("the palette is not a list");
  const regions = [...used].sort((a, b) => a - b);
  for (const region of regions) {
    if (!isHexColour(palette[region])) return designInvalid(`region ${region} has no #rrggbb palette colour`);
  }

  const hasTitle = options.title !== undefined;
  const gridLeft = MARGIN_LEFT;
  const gridTop = MARGIN_TOP + (hasTitle ? TITLE_HEIGHT : 0);
  const gridWidth = ends * CELL;
  const gridHeight = picks * CELL;
  const legendTop = gridTop + gridHeight + AXIS_HEIGHT;
  const width = Math.max(MIN_WIDTH, gridLeft + gridWidth + MARGIN_RIGHT);
  const height = legendTop + regions.length * LEGEND_LINE + MARGIN_TOP;
  const yOf = (pick: number): number => gridTop + (picks - 1 - pick) * CELL;

  const out: string[] = [];
  out.push('<?xml version="1.0" encoding="UTF-8"?>');
  out.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="Helvetica, Arial, sans-serif">`,
  );
  out.push(`<title>${escapeXml(options.title ?? "JACQUARD point paper")}</title>`);
  if (hasTitle) {
    out.push(`<text class="title" x="${gridLeft}" y="${MARGIN_TOP + 12}" font-size="14" fill="#000000">${escapeXml(options.title as string)}</text>`);
  }

  // Cells, merged into runs of equal region along each pick.
  out.push('<g class="cells">');
  for (let pick = 0; pick < picks; pick += 1) {
    const row = design[pick] as readonly number[];
    let start = 0;
    while (start < ends) {
      const region = row[start] as number;
      let stop = start + 1;
      while (stop < ends && row[stop] === region) stop += 1;
      out.push(
        `<rect class="run" data-pick="${pick}" data-end="${start}" data-length="${stop - start}" data-region="${region}" x="${gridLeft + start * CELL}" y="${yOf(pick)}" width="${(stop - start) * CELL}" height="${CELL}" fill="${(palette[region] as string).toLowerCase()}"/>`,
      );
      start = stop;
    }
  }
  out.push("</g>");

  // Grid lines: one path for the light weight, one for the heavy weight (every 8 and the border).
  const light: string[] = [];
  const heavy: string[] = [];
  for (let end = 0; end <= ends; end += 1) {
    const x = gridLeft + end * CELL;
    (end % HEAVY_EVERY === 0 || end === ends ? heavy : light).push(`M${x} ${gridTop}V${gridTop + gridHeight}`);
  }
  for (let pick = 0; pick <= picks; pick += 1) {
    const y = gridTop + (picks - pick) * CELL;
    (pick % HEAVY_EVERY === 0 || pick === picks ? heavy : light).push(`M${gridLeft} ${y}H${gridLeft + gridWidth}`);
  }
  if (light.length > 0) {
    out.push(`<path class="grid-light" d="${light.join("")}" fill="none" stroke="#9a948a" stroke-width="0.5"/>`);
  }
  out.push(`<path class="grid-heavy" d="${heavy.join("")}" fill="none" stroke="#1b1a17" stroke-width="1.5"/>`);

  // Region numbers in the cells.
  if (ends <= NUMBERS_UP_TO && picks <= NUMBERS_UP_TO) {
    out.push('<g class="region-numbers" font-size="5" text-anchor="middle" dominant-baseline="central">');
    for (let pick = 0; pick < picks; pick += 1) {
      const row = design[pick] as readonly number[];
      for (let end = 0; end < ends; end += 1) {
        const region = row[end] as number;
        out.push(
          `<text class="cell-region" data-pick="${pick}" data-end="${end}" x="${gridLeft + end * CELL + CELL / 2}" y="${yOf(pick) + CELL / 2}" fill="${textColourOn(palette[region] as string)}">${region}</text>`,
        );
      }
    }
    out.push("</g>");
  }

  // Axis numbers every 8 cells: ends along the bottom, picks along the left.
  out.push('<g class="axis" font-size="7" fill="#1b1a17">');
  for (let end = 0; end < ends; end += HEAVY_EVERY) {
    out.push(
      `<text class="end-number" x="${gridLeft + end * CELL + CELL / 2}" y="${gridTop + gridHeight + 12}" text-anchor="middle">${end}</text>`,
    );
  }
  for (let pick = 0; pick < picks; pick += HEAVY_EVERY) {
    out.push(
      `<text class="pick-number" x="${gridLeft - 6}" y="${yOf(pick) + CELL / 2}" text-anchor="end" dominant-baseline="central">${pick}</text>`,
    );
  }
  out.push(`<text class="axis-label" x="${gridLeft}" y="${gridTop + gridHeight + 24}">ends (end 0 at the left), picks (pick 0 at the bottom)</text>`);
  out.push("</g>");

  // Legend: one swatch, region number and colour per region used.
  out.push('<g class="legend" font-size="8" fill="#1b1a17">');
  regions.forEach((region, index) => {
    const y = legendTop + index * LEGEND_LINE;
    const colour = (palette[region] as string).toLowerCase();
    out.push(
      `<rect class="legend-swatch" data-region="${region}" x="${gridLeft}" y="${y}" width="${CELL}" height="${CELL}" fill="${colour}" stroke="#1b1a17" stroke-width="0.5"/>`,
    );
    out.push(`<text class="legend-label" x="${gridLeft + CELL + 6}" y="${y + CELL - 2}">Region ${region} (${escapeXml(colour)})</text>`);
  });
  out.push("</g>");
  out.push("</svg>");
  return ok(`${out.join("\n")}\n`);
}
