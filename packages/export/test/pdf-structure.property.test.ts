// Feature: simulate-and-export, Property 8: PDF structure
// For any valid plan and profile, the PDF bytes start with %PDF-1.4, end with %%EOF followed by an
// optional newline, every xref offset points at the start of `n 0 obj` for its object number,
// startxref points at xref, every stream's /Length equals its byte length, the page count equals
// ceil(pickCount / cardsPerPage), each page carries the untested-format sentence, and the text
// contains no /CreationDate.
// Validates: Requirements 4.6, 4.5, 4.1
//
// The file is parsed here from the bytes, without the writer's helpers. Each byte is read as one
// character (Latin-1), so string indices are byte offsets. cardsPerPage is read from the first
// page (the number of card outlines on it) and checked to be the same on every full page.
import * as fc from "fast-check";
import { buildCards } from "@jacquard/engine";
import { describe, expect, it } from "vitest";
import { cardSheetPdf } from "../src/index.js";
import { planCaseArb, titleArb } from "./arbitraries.js";

const SEED = 5108;
const NUM_RUNS = 100;
// About 10 ms per run alone; the root `pnpm test` runs every package at once and can be several
// times slower, so the timeout allows 300 ms per run instead of vitest's 5 s default.
const TIMEOUT_MS = NUM_RUNS * 300;

const NOTE =
  "Schematic, not to scale. The card format is a configurable loom profile and has not been tested on a working loom.";

/** A4 in points. */
const A4_WIDTH = (210 / 25.4) * 72;
const A4_HEIGHT = (297 / 25.4) * 72;

const latin1 = (bytes: Uint8Array): string => {
  let out = "";
  for (let i = 0; i < bytes.length; i += 4096) out += String.fromCharCode(...bytes.subarray(i, i + 4096));
  return out;
};

interface ParsedPdf {
  readonly text: string;
  readonly objects: Map<number, string>;
  readonly root: number;
  readonly size: number;
}

/** Checks the file structure and returns the objects by number. Throws on the first problem. */
function parsePdf(bytes: Uint8Array): ParsedPdf {
  const text = latin1(bytes);
  expect(text.startsWith("%PDF-1.4\n")).toBe(true);
  expect(/%%EOF\n?$/.test(text)).toBe(true);
  // startxref points at the xref keyword.
  const tail = /startxref\n(\d+)\n%%EOF\n?$/.exec(text);
  expect(tail).not.toBeNull();
  const xrefAt = Number(tail![1]);
  expect(text.slice(xrefAt, xrefAt + 5)).toBe("xref\n");
  // The xref table: one subsection from 0, entries of exactly 20 bytes.
  const head = /^xref\n0 (\d+)\n/.exec(text.slice(xrefAt));
  expect(head).not.toBeNull();
  const size = Number(head![1]);
  let at = xrefAt + head![0].length;
  const offsets: number[] = [];
  for (let k = 0; k < size; k += 1) {
    const entry = text.slice(at, at + 20);
    expect(entry, `xref entry ${k}`).toMatch(/^\d{10} \d{5} [nf](?: \r| \n|\r\n)$/);
    if (k === 0) expect(entry.slice(11, 18)).toBe("65535 f");
    else {
      expect(entry[17], `xref entry ${k}`).toBe("n");
      offsets.push(Number(entry.slice(0, 10)));
    }
    at += 20;
  }
  const trailer = /^trailer\n<<([^>]*)>>\nstartxref\n/.exec(text.slice(at));
  expect(trailer, "trailer right after the xref table").not.toBeNull();
  expect(trailer![1]).toContain(`/Size ${size}`);
  const root = Number(/\/Root (\d+) 0 R/.exec(trailer![1]!)![1]);
  // Every xref offset points at `k 0 obj` at the start of a line, and every object is listed.
  const objects = new Map<number, string>();
  offsets.forEach((offset, index) => {
    const k = index + 1;
    expect(text.slice(offset).startsWith(`${k} 0 obj\n`), `object ${k} at ${offset}`).toBe(true);
    expect(text[offset - 1]).toBe("\n");
    const end = text.indexOf("\nendobj", offset);
    expect(end).toBeGreaterThan(offset);
    objects.set(k, text.slice(offset + `${k} 0 obj\n`.length, end));
  });
  const found = [...text.matchAll(/(?:^|\n)(\d+) 0 obj\n/g)].map((m) => ({
    k: Number(m[1]),
    offset: (m.index ?? 0) + (m[0].startsWith("\n") ? 1 : 0),
  }));
  expect(found.map((f) => f.k)).toEqual(offsets.map((_, index) => index + 1));
  expect(found.map((f) => f.offset)).toEqual(offsets);
  return { text, objects, root, size };
}

/** The stream content of an object, after checking `/Length` against the bytes. */
function streamOf(body: string): string {
  const m = /^<<([^]*?)>>\nstream\n/.exec(body);
  expect(m, "a stream object").not.toBeNull();
  const length = Number(/\/Length (\d+)/.exec(m![1]!)![1]);
  const start = m![0].length;
  const end = body.indexOf("\nendstream", start);
  expect(end - start, "stream /Length").toBe(length);
  return body.slice(start, end);
}

function unescapePdf(text: string): string {
  return text.replace(/\\(.)/g, "$1");
}

interface PageContent {
  readonly rects: { x: number; y: number; w: number; h: number }[];
  readonly labels: number[];
  readonly texts: { size: number; y: number; text: string }[];
  readonly filled: number;
}

function readPage(content: string): PageContent {
  const rects = [...content.matchAll(/(?:^|\n)(-?[\d.]+) (-?[\d.]+) (-?[\d.]+) (-?[\d.]+) re S(?=\n|$)/g)].map((m) => ({
    x: Number(m[1]),
    y: Number(m[2]),
    w: Number(m[3]),
    h: Number(m[4]),
  }));
  const texts = [...content.matchAll(/BT \/F1 ([\d.]+) Tf (-?[\d.]+) (-?[\d.]+) Td \(((?:\\.|[^\\)])*)\) Tj ET/g)].map((m) => ({
    size: Number(m[1]),
    y: Number(m[3]),
    text: unescapePdf(m[4]!),
  }));
  const labels = texts.filter((t) => /^\d+$/.test(t.text)).map((t) => Number(t.text));
  // A filled circle is four Bézier segments followed by the fill operator.
  const filled = [...content.matchAll(/ c\nf(?=\n|$)/g)].length;
  return { rects, labels, texts, filled };
}

describe("Feature: simulate-and-export, Property 8: PDF structure", () => {
  it("writes a PDF 1.4 with a correct xref, stream lengths, pages and footers", () => {
    fc.assert(
      fc.property(planCaseArb, fc.option(titleArb.map((t) => `T ${t}`), { nil: undefined }), ({ plan, profile }, title) => {
        const result = cardSheetPdf(plan, profile, title === undefined ? {} : { title });
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        const pdf = parsePdf(result.value);
        // 4.6 no creation date, no compression.
        expect(pdf.text).not.toContain("/CreationDate");
        expect(pdf.text).not.toContain("/Filter");
        // Every stream's /Length is its byte length.
        for (const body of pdf.objects.values()) if (/>>\nstream\n/.test(body)) streamOf(body);
        // Catalog, page tree, pages.
        const catalog = pdf.objects.get(pdf.root)!;
        expect(catalog).toContain("/Type /Catalog");
        const pagesNumber = Number(/\/Pages (\d+) 0 R/.exec(catalog)![1]);
        const pagesBody = pdf.objects.get(pagesNumber)!;
        expect(pagesBody).toContain("/Type /Pages");
        const kids = [.../\/Kids \[([^\]]*)\]/.exec(pagesBody)![1]!.matchAll(/(\d+) 0 R/g)].map((m) => Number(m[1]));
        const count = Number(/\/Count (\d+)/.exec(pagesBody)![1]);
        expect(kids).toHaveLength(count);
        const allPages = [...pdf.objects.values()].filter((body) => /\/Type \/Page\b(?!s)/.test(body));
        expect(allPages).toHaveLength(count);

        const engine = buildCards(plan, profile);
        if (!engine.ok) throw new Error(engine.error.message);
        const totalPunched = engine.value.cards.reduce((sum, card) => sum + card.punched.filter(Boolean).length, 0);
        const pages = kids.map((kid, index) => {
          const body = pdf.objects.get(kid)!;
          expect(body).toContain("/Type /Page");
          expect(body).toContain(`/Parent ${pagesNumber} 0 R`);
          const box = /\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/.exec(body)!;
          expect(Math.abs(Number(box[1]) - A4_WIDTH)).toBeLessThan(0.01);
          expect(Math.abs(Number(box[2]) - A4_HEIGHT)).toBeLessThan(0.01);
          const fontNumber = Number(/\/F1 (\d+) 0 R/.exec(body)![1]);
          expect(pdf.objects.get(fontNumber)).toBe("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
          const contentsNumber = Number(/\/Contents (\d+) 0 R/.exec(body)![1]);
          const page = readPage(streamOf(pdf.objects.get(contentsNumber)!));
          // 4.5 each page carries the note, the profile summary and its page number.
          const lines = page.texts.map((t) => t.text);
          expect(lines).toContain(NOTE);
          expect(lines.some((t) => t.includes(`${profile.hookCount} hooks`) && t.includes(`${profile.hooksPerCardRow} hooks per card row`))).toBe(true);
          expect(lines).toContain(`page ${index + 1} of ${count}`);
          return page;
        });

        // 4.1 one card per pick across the pages, in order; cardsPerPage from the first page.
        const cardsPerPage = pages[0]!.rects.length;
        expect(cardsPerPage).toBeGreaterThanOrEqual(1);
        expect(count).toBe(Math.ceil(plan.pickCount / cardsPerPage));
        const labels: number[] = [];
        pages.forEach((page, index) => {
          expect(page.labels).toHaveLength(page.rects.length);
          if (index < pages.length - 1) expect(page.rects).toHaveLength(cardsPerPage);
          else expect(page.rects.length).toBeLessThanOrEqual(cardsPerPage);
          labels.push(...page.labels);
          // Cards fit on the page, top to bottom without overlap, above the footer text.
          const note = page.texts.find((t) => t.text === NOTE)!;
          const footerTop = Math.max(...page.texts.filter((t) => t.y <= note.y).map((t) => t.y + t.size));
          page.rects.forEach((rect, k) => {
            expect(rect.x).toBeGreaterThanOrEqual(0);
            expect(rect.x + rect.w).toBeLessThanOrEqual(A4_WIDTH);
            expect(rect.y + rect.h).toBeLessThanOrEqual(A4_HEIGHT);
            expect(rect.y, `card outline ${k} on page ${index + 1} reaches the footer`).toBeGreaterThanOrEqual(footerTop);
            if (k > 0) expect(rect.y + rect.h).toBeLessThanOrEqual(page.rects[k - 1]!.y);
          });
        });
        expect(labels).toEqual(Array.from({ length: plan.pickCount }, (_, i) => i + 1));
        // 4.4 punched holes are filled circles.
        expect(pages.reduce((sum, page) => sum + page.filled, 0)).toBe(totalPunched);
      }),
      { seed: SEED, numRuns: NUM_RUNS, verbose: 1 },
    );
  }, TIMEOUT_MS);
});
