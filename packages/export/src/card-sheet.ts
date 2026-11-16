// Card sheet geometry and SVG writer (Requirement 4). See design.md, "Card sheet geometry".
//
// The sheet is a schematic, not to scale: card dimensions and hole spacing are not in S1. The card
// format is a configurable loom profile and has not been tested on a working loom (4.5).
//
// Geometry, in millimetres with y growing downward: a card is a strip whose length runs left to
// right. Its card rows (from the engine's `cardRows`) are columns, row 0 nearest the numbered end on
// the left [to verify]; inside a row the slots run top to bottom, slot 0 at the top [sourced, S1:
// "The first needle is the one ... nearest the needle board at the top ... and the others are
// graded down until the eighth"].
import { buildCards, cardRows, err, ok, type LiftPlan, type LoomProfile } from "@jacquard/engine";
import { escapeXml, formatNumber } from "./text.js";
import { checkPlan, type ExportResult } from "./types.js";

/** The untested-format note every card page and sheet carries (4.5). */
export const CARD_SHEET_NOTE =
  "Schematic, not to scale. The card format is a configurable loom profile and has not been tested on a working loom.";

/** Schematic dimensions in millimetres (design.md, "Card sheet geometry") [decision]. */
export const CARD_GEOMETRY = Object.freeze({
  holePitch: 4,
  holeDiameter: 2.4,
  cardMargin: 6,
  labelBand: 8,
  laceDiameter: 1.6,
  numberFontSize: 3,
});

export interface CardHole {
  /** Card position: figuring hook h is position h, spare s is hookCount + s. */
  readonly position: number;
  /** Card row (from `cardRows`) and slot in that row. */
  readonly row: number;
  readonly slot: number;
  /** Hole centre relative to the card's top-left corner, in millimetres. */
  readonly x: number;
  readonly y: number;
  readonly punched: boolean;
}

export interface CardLayout {
  /** Exported number, pick + 1 (4.2). */
  readonly number: number;
  readonly pick: number;
  /** Drawn positions in `cardRows` order; `null` slots are not drawn. */
  readonly holes: readonly CardHole[];
  /** Centres of the lacing marks, two at each end of the card. */
  readonly laceMarks: readonly { readonly x: number; readonly y: number }[];
}

export interface CardSheetLayout {
  /** Card size in millimetres; every card of a set has the same size. */
  readonly cardWidth: number;
  readonly cardHeight: number;
  readonly holeRadius: number;
  readonly laceRadius: number;
  /** Centre of the card number in the label band, relative to the card's top-left corner. */
  readonly numberX: number;
  readonly numberY: number;
  readonly rowsPerCard: number;
  readonly slotsPerRow: number;
  /** The profile summary line (4.5). */
  readonly summary: string;
  /** One card per pick, in lacing order (4.1, 4.2). */
  readonly cards: readonly CardLayout[];
}

export interface CardSheetOptions {
  /** A heading drawn above the cards. */
  readonly title?: string;
}

/** Hook count, spare hooks, hooks per row and hole meaning, on one line (4.5). */
export function profileSummary(profile: LoomProfile): string {
  const spare = profile.spareHookCount === 1 ? "1 spare hook" : `${profile.spareHookCount} spare hooks`;
  const meaning = profile.holeMeans === "lift" ? "a punched hole lifts the hook" : "a punched hole keeps the hook down";
  return `Loom profile: ${profile.hookCount} hooks, ${spare}, ${profile.hooksPerCardRow} hooks per card row, ${meaning}.`;
}

/**
 * Lays out the card set (4.1 to 4.4). Runs the engine checks, then `buildCards` and `cardRows` for
 * each card; any engine error is returned unchanged (4.8). The inputs are not modified.
 */
export function cardSheetLayout(plan: LiftPlan, profile: LoomProfile): ExportResult<CardSheetLayout> {
  const checked = checkPlan(plan, profile);
  if (!checked.ok) return err(checked.error);
  const built = buildCards(plan, profile);
  if (!built.ok) return err(built.error);
  const g = CARD_GEOMETRY;
  const slotsPerRow = profile.hooksPerCardRow;
  const positionCount = plan.hookCount + profile.spareHookCount;
  const rowsPerCard = Math.ceil(positionCount / slotsPerRow);
  const cardWidth = g.labelBand + 2 * g.cardMargin + rowsPerCard * g.holePitch;
  const cardHeight = 2 * g.cardMargin + slotsPerRow * g.holePitch;
  const laceMarks = [
    { x: g.labelBand + g.cardMargin / 2, y: cardHeight / 4 },
    { x: g.labelBand + g.cardMargin / 2, y: (3 * cardHeight) / 4 },
    { x: cardWidth - g.cardMargin / 2, y: cardHeight / 4 },
    { x: cardWidth - g.cardMargin / 2, y: (3 * cardHeight) / 4 },
  ];
  const cards: CardLayout[] = built.value.cards.map((card) => {
    const rows = cardRows(card, profile);
    const holes: CardHole[] = [];
    rows.forEach((slots, row) => {
      slots.forEach((punched, slot) => {
        if (punched === null) return;
        holes.push({
          position: row * slotsPerRow + slot,
          row,
          slot,
          x: g.labelBand + g.cardMargin + row * g.holePitch + g.holePitch / 2,
          y: g.cardMargin + slot * g.holePitch + g.holePitch / 2,
          punched,
        });
      });
    });
    return { number: card.number, pick: card.index, holes, laceMarks };
  });
  return ok({
    cardWidth,
    cardHeight,
    holeRadius: g.holeDiameter / 2,
    laceRadius: g.laceDiameter / 2,
    numberX: g.labelBand / 2,
    numberY: cardHeight / 2,
    rowsPerCard,
    slotsPerRow,
    summary: profileSummary(profile),
    cards,
  });
}

const n = (value: number): string => formatNumber(value);

/** Sheet margin, gap between cards and text line height for the SVG, in millimetres [decision]. */
const SVG_MARGIN = 10;
const SVG_CARD_GAP = 4;
const SVG_LINE = 5;
const SVG_MIN_WIDTH = 190;

/**
 * The card set as one SVG document (4.1 to 4.5, 4.7): a heading with the optional title, the
 * untested-format note and the profile summary, then every card stacked in one column in lacing
 * order. Each card is `<g class="card" data-number="n">` with its number as text; punched holes are
 * `<circle class="hole punched">` (filled) and unpunched holes `<circle class="hole">` (outline).
 * Engine errors are returned unchanged (4.8). Byte-identical for identical inputs.
 */
export function cardSheetSvg(
  plan: LiftPlan,
  profile: LoomProfile,
  options: CardSheetOptions = {},
): ExportResult<string> {
  const laid = cardSheetLayout(plan, profile);
  if (!laid.ok) return err(laid.error);
  const layout = laid.value;
  const headLines = [
    ...(options.title === undefined ? [] : [{ cls: "title", text: options.title, size: 4 }]),
    { cls: "note", text: CARD_SHEET_NOTE, size: 2.8 },
    { cls: "profile", text: layout.summary, size: 2.8 },
  ];
  const headHeight = headLines.length * SVG_LINE;
  const width = Math.max(SVG_MIN_WIDTH, layout.cardWidth) + 2 * SVG_MARGIN;
  const cardsTop = SVG_MARGIN + headHeight + SVG_CARD_GAP;
  const count = layout.cards.length;
  const height = cardsTop + count * layout.cardHeight + (count - 1) * SVG_CARD_GAP + SVG_MARGIN;

  const out: string[] = [];
  out.push('<?xml version="1.0" encoding="UTF-8"?>');
  out.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${n(width)}mm" height="${n(height)}mm" viewBox="0 0 ${n(width)} ${n(height)}" font-family="Helvetica, Arial, sans-serif">`,
  );
  out.push(`<title>${escapeXml(options.title ?? "JACQUARD card set")}</title>`);
  headLines.forEach((line, index) => {
    out.push(
      `<text class="${line.cls}" x="${n(SVG_MARGIN)}" y="${n(SVG_MARGIN + (index + 1) * SVG_LINE - 1)}" font-size="${n(line.size)}" fill="#000000">${escapeXml(line.text)}</text>`,
    );
  });
  layout.cards.forEach((card, index) => {
    const top = cardsTop + index * (layout.cardHeight + SVG_CARD_GAP);
    out.push(`<g class="card" data-number="${card.number}" data-pick="${card.pick}" transform="translate(${n(SVG_MARGIN)} ${n(top)})">`);
    out.push(
      `<rect class="card-outline" x="0" y="0" width="${n(layout.cardWidth)}" height="${n(layout.cardHeight)}" fill="none" stroke="#000000" stroke-width="0.3"/>`,
    );
    out.push(
      `<line class="label-band" x1="${n(CARD_GEOMETRY.labelBand)}" y1="0" x2="${n(CARD_GEOMETRY.labelBand)}" y2="${n(layout.cardHeight)}" stroke="#000000" stroke-width="0.2"/>`,
    );
    out.push(
      `<text class="card-number" x="${n(layout.numberX)}" y="${n(layout.numberY)}" font-size="${n(CARD_GEOMETRY.numberFontSize)}" text-anchor="middle" dominant-baseline="middle" fill="#000000">${card.number}</text>`,
    );
    for (const mark of card.laceMarks) {
      out.push(
        `<circle class="lace" cx="${n(mark.x)}" cy="${n(mark.y)}" r="${n(layout.laceRadius)}" fill="none" stroke="#000000" stroke-width="0.2" stroke-dasharray="0.4 0.3"/>`,
      );
    }
    for (const hole of card.holes) {
      const look = hole.punched
        ? 'class="hole punched" fill="#000000"'
        : 'class="hole" fill="none" stroke="#000000" stroke-width="0.2"';
      out.push(
        `<circle ${look} data-position="${hole.position}" cx="${n(hole.x)}" cy="${n(hole.y)}" r="${n(layout.holeRadius)}"/>`,
      );
    }
    out.push("</g>");
  });
  out.push("</svg>");
  return ok(`${out.join("\n")}\n`);
}
