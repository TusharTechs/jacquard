// Example tests (simulate-and-export task 3.12): a 2-pick WIF against a hand-written expected file,
// a one-card PDF read as text, and card 1 of PROFILE_400 with 416 positions in 52 rows of 8.
// Requirements 3.1, 4.3, 4.6.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PROFILE_400, buildCards, cardRows, defineProfile, type LiftPlan } from "@jacquard/engine";
import { describe, expect, it } from "vitest";
import { cardSheetLayout, cardSheetPdf, cardSheetSvg, readWif, writeWif } from "../src/index.js";

const here = dirname(fileURLToPath(import.meta.url));

const NOTE =
  "Schematic, not to scale. The card format is a configurable loom profile and has not been tested on a working loom.";

describe("WIF example: 2 picks, 4 hooks (3.1)", () => {
  // Plain weave over four ends: pick 1 lifts ends 1 and 3, pick 2 lifts ends 2 and 4.
  const plan: LiftPlan = {
    pickCount: 2,
    hookCount: 4,
    designWidth: 4,
    repeatAcross: false,
    lifts: [
      [true, false, true, false],
      [false, true, false, true],
    ],
  };
  const profile = defineProfile({ hookCount: 4 });
  const yarns = { warp: ["#222222"], weft: ["#f3ead8", "#8C2F39"] };

  it("matches the hand-written file line by line", () => {
    const expected = readFileSync(join(here, "expected", "two-pick.wif"), "utf8").replace(/\r\n/g, "\n").split("\n");
    if (expected[expected.length - 1] === "") expected.pop();
    const written = writeWif(plan, profile, yarns, { title: "Two pick" });
    expect(written.ok).toBe(true);
    if (!written.ok) return;
    expect(written.value.endsWith("\r\n")).toBe(true);
    const actual = written.value.slice(0, -2).split("\r\n");
    for (const line of actual) expect(line).not.toMatch(/[\r\n]/);
    const length = Math.max(actual.length, expected.length);
    for (let i = 0; i < length; i += 1) expect(actual[i], `line ${i + 1}`).toBe(expected[i]);
  });

  it("reads the hand-written file back to the plan", () => {
    const text = readFileSync(join(here, "expected", "two-pick.wif"), "utf8");
    expect(readWif(text)).toEqual({ ok: true, value: plan });
  });
});

describe("PDF example: one card (4.6)", () => {
  const plan: LiftPlan = {
    pickCount: 1,
    hookCount: 4,
    designWidth: 4,
    repeatAcross: false,
    lifts: [[true, false, false, true]],
  };
  const profile = defineProfile({ hookCount: 4, hooksPerCardRow: 2, spareHookCount: 2 });

  it("is a one-page PDF 1.4 with the card, its holes, the note and the profile summary", () => {
    const result = cardSheetPdf(plan, profile, { title: "One (card)" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const text = Array.from(result.value, (byte) => String.fromCharCode(byte)).join("");
    expect(text.startsWith("%PDF-1.4\n%")).toBe(true);
    // The binary comment line has bytes of 128 or more, so tools treat the file as binary.
    const second = text.slice(9, text.indexOf("\n", 9));
    expect([...second.slice(1)].every((c) => c.charCodeAt(0) >= 128)).toBe(true);
    expect(text.endsWith("%%EOF\n")).toBe(true);
    expect(text).toContain("/Type /Catalog");
    expect(text).toContain("/Type /Pages /Kids [");
    expect(text).toContain("/Count 1");
    expect((text.match(/\/Type \/Page\b(?!s)/g) ?? []).length).toBe(1);
    expect(text).toContain("/MediaBox [0 0 595.276 841.89]");
    expect(text).toContain("/BaseFont /Helvetica");
    expect(text).not.toContain("/CreationDate");
    expect(text).not.toContain("/Filter");
    expect(text).toContain(`(${NOTE}) Tj`);
    expect(text).toContain("(Loom profile: 4 hooks, 2 spare hooks, 2 hooks per card row, a punched hole lifts the hook.) Tj");
    expect(text).toContain("(page 1 of 1) Tj");
    expect(text).toContain("(One \\(card\\)) Tj");
    expect(text).toContain("(1) Tj");
    // Six positions: hooks 0 and 3 lift, so two filled circles; four outlines plus four lace marks.
    expect((text.match(/ c\nf\n/g) ?? []).length).toBe(2);
    expect((text.match(/ c\nS\n/g) ?? []).length).toBe(4 + 4);
    // Cross-reference table: five objects (catalog, pages, font, contents, page) plus entry 0.
    const startxref = Number(/startxref\n(\d+)\n%%EOF\n$/.exec(text)![1]);
    expect(text.slice(startxref).startsWith("xref\n0 6\n0000000000 65535 f \n")).toBe(true);
    expect(text).toContain("trailer\n<< /Size 6 /Root 1 0 R >>");
  });
});

describe("PROFILE_400 card (4.3)", () => {
  const lifts = [Array.from({ length: 400 }, (_, hook) => hook % 3 === 0)];
  const plan: LiftPlan = { pickCount: 1, hookCount: 400, designWidth: 400, repeatAcross: false, lifts };

  it("card 1 has 416 positions in 52 rows of 8", () => {
    const cards = buildCards(plan, PROFILE_400);
    if (!cards.ok) throw new Error(cards.error.message);
    const card = cards.value.cards[0]!;
    expect(card.number).toBe(1);
    expect(card.punched).toHaveLength(416);
    const rows = cardRows(card, PROFILE_400);
    expect(rows).toHaveLength(52);
    for (const row of rows) {
      expect(row).toHaveLength(8);
      expect(row.every((slot) => slot !== null)).toBe(true);
    }
    const layout = cardSheetLayout(plan, PROFILE_400);
    expect(layout.ok).toBe(true);
    if (!layout.ok) return;
    expect(layout.value.rowsPerCard).toBe(52);
    expect(layout.value.slotsPerRow).toBe(8);
    const holes = layout.value.cards[0]!.holes;
    expect(holes).toHaveLength(416);
    expect(new Set(holes.map((hole) => hole.row)).size).toBe(52);
    for (let row = 0; row < 52; row += 1) expect(holes.filter((hole) => hole.row === row)).toHaveLength(8);
    // The 16 spare positions (400 to 415) are not punched with holeMeans "lift".
    expect(holes.slice(400).every((hole) => !hole.punched)).toBe(true);
    const svg = cardSheetSvg(plan, PROFILE_400);
    expect(svg.ok).toBe(true);
    if (!svg.ok) return;
    expect((svg.value.match(/<circle class="hole/g) ?? []).length).toBe(416);
    expect((svg.value.match(/<circle class="hole punched"/g) ?? []).length).toBe(134);
  });
});
