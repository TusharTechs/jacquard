// Minimal PDF 1.4 writer and the card sheet PDF (4.1 to 4.8). See design.md, "PDF writer" and
// "Card sheet geometry".
//
// Uncompressed, vector only, Helvetica (a standard font, not embedded), A4 portrait, no creation
// date (4.6). The card format is a configurable loom profile and has not been tested on a working
// loom; every page says so (4.5).
import { err, ok, type LiftPlan, type LoomProfile } from "@jacquard/engine";
import { CARD_GEOMETRY, CARD_SHEET_NOTE, cardSheetLayout, type CardSheetOptions } from "./card-sheet.js";
import { formatNumber, pdfString, utf8Bytes, utf8Length } from "./text.js";
import type { ExportResult } from "./types.js";

/**
 * Collects PDF objects as strings, numbered from 1, and writes the file on `finish` with a
 * cross-reference table of UTF-8 byte offsets.
 */
export class PdfWriter {
  private readonly bodies: (string | undefined)[] = [];

  /** Reserves an object number to fill in later with `set`. */
  reserve(): number {
    this.bodies.push(undefined);
    return this.bodies.length;
  }

  /** Sets the body (the text between `n 0 obj` and `endobj`) of a reserved object. */
  set(objectNumber: number, body: string): void {
    this.bodies[objectNumber - 1] = body;
  }

  /** Adds an object and returns its number. */
  add(body: string): number {
    const objectNumber = this.reserve();
    this.set(objectNumber, body);
    return objectNumber;
  }

  /** Adds a stream object; `/Length` is the byte length of `content` (4.6). */
  addStream(content: string, dictionary = ""): number {
    const extra = dictionary === "" ? "" : ` ${dictionary}`;
    return this.add(`<< /Length ${utf8Length(content)}${extra} >>\nstream\n${content}\nendstream`);
  }

  /** Writes the document with `rootObject` as `/Root`. Unset objects are written as `null`. */
  finish(rootObject: number): Uint8Array {
    const chunks: string[] = ["%PDF-1.4\n%âãÏÓ\n"];
    let offset = utf8Length(chunks[0] as string);
    const offsets: number[] = [];
    this.bodies.forEach((body, index) => {
      const chunk = `${index + 1} 0 obj\n${body ?? "null"}\nendobj\n`;
      offsets.push(offset);
      chunks.push(chunk);
      offset += utf8Length(chunk);
    });
    const size = this.bodies.length + 1;
    let xref = `xref\n0 ${size}\n0000000000 65535 f \n`;
    for (const at of offsets) xref += `${String(at).padStart(10, "0")} 00000 n \n`;
    chunks.push(xref);
    chunks.push(`trailer\n<< /Size ${size} /Root ${rootObject} 0 R >>\nstartxref\n${offset}\n%%EOF\n`);
    return utf8Bytes(chunks.join(""));
  }
}

/** A4 portrait and page layout, in millimetres [decision]. */
export const PDF_PAGE = Object.freeze({
  width: 210,
  height: 297,
  margin: 10,
  cardGap: 4,
  titleHeight: 8,
  footerHeight: 14,
});

const PT_PER_MM = 72 / 25.4;
const pt = (mm: number): string => formatNumber(mm * PT_PER_MM);

/**
 * Scale and cards per page for a card of `cardWidth` by `cardHeight` mm (Decision log, "Cards per
 * page"). Cards are scaled down, never up, to fit the printable width and the card area; at least
 * one card fits on a page.
 */
export function pdfCardsPerPage(
  cardWidth: number,
  cardHeight: number,
  hasTitle: boolean,
): { readonly scale: number; readonly cardsPerPage: number } {
  const p = PDF_PAGE;
  const areaWidth = p.width - 2 * p.margin;
  const areaHeight = p.height - 2 * p.margin - p.footerHeight - (hasTitle ? p.titleHeight : 0);
  const scale = Math.min(1, areaWidth / cardWidth, areaHeight / cardHeight);
  const cardsPerPage = Math.max(1, Math.floor((areaHeight + p.cardGap) / (cardHeight * scale + p.cardGap)));
  return { scale, cardsPerPage };
}

/** A circle path of four Bézier arcs, centre and radius in points. */
function circlePath(cx: number, cy: number, r: number): string {
  const k = 0.5523 * r;
  const f = formatNumber;
  return [
    `${f(cx + r)} ${f(cy)} m`,
    `${f(cx + r)} ${f(cy + k)} ${f(cx + k)} ${f(cy + r)} ${f(cx)} ${f(cy + r)} c`,
    `${f(cx - k)} ${f(cy + r)} ${f(cx - r)} ${f(cy + k)} ${f(cx - r)} ${f(cy)} c`,
    `${f(cx - r)} ${f(cy - k)} ${f(cx - k)} ${f(cy - r)} ${f(cx)} ${f(cy - r)} c`,
    `${f(cx + k)} ${f(cy - r)} ${f(cx + r)} ${f(cy - k)} ${f(cx + r)} ${f(cy)} c`,
  ].join("\n");
}

/** One line of Helvetica text at (x, y) mm from the page's top-left, baseline at y. */
function textLine(xMm: number, yMm: number, sizePt: number, text: string): string {
  return `BT /F1 ${formatNumber(sizePt)} Tf ${pt(xMm)} ${pt(PDF_PAGE.height - yMm)} Td ${pdfString(text)} Tj ET`;
}

/**
 * The card set as a PDF 1.4 document (4.1 to 4.8): A4 pages filled with as many cards as fit, in
 * lacing order, each page with the optional title at the top and a footer carrying the
 * untested-format note, the profile summary and "page k of n". Punched holes are filled circles,
 * unpunched holes outlines. Engine errors are returned unchanged (4.8). Byte-identical for
 * identical inputs (4.7).
 */
export function cardSheetPdf(
  plan: LiftPlan,
  profile: LoomProfile,
  options: CardSheetOptions = {},
): ExportResult<Uint8Array> {
  const laid = cardSheetLayout(plan, profile);
  if (!laid.ok) return err(laid.error);
  const layout = laid.value;
  const p = PDF_PAGE;
  const hasTitle = options.title !== undefined;
  const { scale, cardsPerPage } = pdfCardsPerPage(layout.cardWidth, layout.cardHeight, hasTitle);
  const pageCount = Math.ceil(layout.cards.length / cardsPerPage);

  const writer = new PdfWriter();
  const catalog = writer.reserve();
  const pages = writer.reserve();
  const font = writer.add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  writer.set(catalog, `<< /Type /Catalog /Pages ${pages} 0 R >>`);

  const kids: number[] = [];
  const cardsTop = p.margin + (hasTitle ? p.titleHeight : 0);
  for (let page = 0; page < pageCount; page += 1) {
    const ops: string[] = ["0 g 0 G"];
    if (hasTitle) ops.push(textLine(p.margin, p.margin + 5, 12, options.title as string));
    const first = page * cardsPerPage;
    const onPage = layout.cards.slice(first, first + cardsPerPage);
    onPage.forEach((card, index) => {
      const left = p.margin;
      const top = cardsTop + index * (layout.cardHeight * scale + p.cardGap);
      const xPt = (x: number): number => (left + x * scale) * PT_PER_MM;
      const yPt = (y: number): number => (p.height - (top + y * scale)) * PT_PER_MM;
      ops.push("0.6 w");
      ops.push(
        `${pt(left)} ${pt(p.height - top - layout.cardHeight * scale)} ${pt(layout.cardWidth * scale)} ${pt(layout.cardHeight * scale)} re S`,
      );
      ops.push("0.4 w");
      ops.push(
        `${formatNumber(xPt(CARD_GEOMETRY.labelBand))} ${formatNumber(yPt(0))} m ${formatNumber(xPt(CARD_GEOMETRY.labelBand))} ${formatNumber(yPt(layout.cardHeight))} l S`,
      );
      const sizePt = CARD_GEOMETRY.numberFontSize * scale * PT_PER_MM;
      const label = String(card.number);
      // Helvetica digits are 0.556 em wide; centre the number in the label band.
      const labelWidthMm = (label.length * 0.556 * CARD_GEOMETRY.numberFontSize * scale);
      ops.push(
        textLine(
          left + layout.numberX * scale - labelWidthMm / 2,
          top + layout.numberY * scale + (CARD_GEOMETRY.numberFontSize * scale) / 3,
          sizePt,
          label,
        ),
      );
      const holeR = layout.holeRadius * scale * PT_PER_MM;
      const laceR = layout.laceRadius * scale * PT_PER_MM;
      ops.push("[1 1] 0 d");
      for (const mark of card.laceMarks) ops.push(`${circlePath(xPt(mark.x), yPt(mark.y), laceR)}\nS`);
      ops.push("[] 0 d");
      for (const hole of card.holes) {
        ops.push(`${circlePath(xPt(hole.x), yPt(hole.y), holeR)}\n${hole.punched ? "f" : "S"}`);
      }
    });
    const footerTop = p.height - p.margin - p.footerHeight;
    ops.push(textLine(p.margin, footerTop + 4, 8, CARD_SHEET_NOTE));
    ops.push(textLine(p.margin, footerTop + 8.5, 8, layout.summary));
    ops.push(textLine(p.margin, footerTop + 13, 8, `page ${page + 1} of ${pageCount}`));
    const contents = writer.addStream(ops.join("\n"));
    kids.push(
      writer.add(
        `<< /Type /Page /Parent ${pages} 0 R /MediaBox [0 0 ${pt(p.width)} ${pt(p.height)}] /Resources << /Font << /F1 ${font} 0 R >> >> /Contents ${contents} 0 R >>`,
      ),
    );
  }
  writer.set(pages, `<< /Type /Pages /Kids [${kids.map((kid) => `${kid} 0 R`).join(" ")}] /Count ${pageCount} >>`);
  return ok(writer.finish(catalog));
}
