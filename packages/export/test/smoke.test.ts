// Smoke examples, one per exported function (simulate-and-export tasks 2.1 to 2.4).
// The property tests are task group 3.
import { PROFILE_400, buildLiftPlan, buildCards, defineProfile, type LiftPlan } from "@jacquard/engine";
import { describe, expect, it } from "vitest";
import {
  CARD_SHEET_NOTE,
  PdfWriter,
  cardSheetLayout,
  cardSheetPdf,
  cardSheetSvg,
  clothModel,
  escapeXml,
  formatNumber,
  pdfCardsPerPage,
  pdfString,
  pointPaperSvg,
  profileSummary,
  readWif,
  writeWif,
} from "../src/index.js";

const profile = defineProfile({ hookCount: 8, hooksPerCardRow: 4, spareHookCount: 2 });
const design = [
  [0, 0, 1, 1],
  [0, 1, 1, 0],
  [1, 1, 0, 0],
  [1, 0, 0, 1],
];
function samplePlan(repeatAcross = true): LiftPlan {
  const built = buildLiftPlan({
    design,
    weaves: { 0: { kind: "plain" }, 1: { kind: "twill", up: 2, down: 2, direction: "Z" } },
    profile,
    repeatAcross,
  });
  if (!built.ok) throw new Error(built.error.message);
  return built.value.plan;
}
const yarns = { warp: ["#222222"], weft: ["#f3ead8", "#8c2f39"] };
const latin1 = (bytes: Uint8Array): string => String.fromCharCode(...bytes);

describe("text helpers", () => {
  it("escapes XML and PDF text and formats numbers without locale", () => {
    expect(escapeXml(`a<b & "c" 'd'>`)).toBe("a&lt;b &amp; &quot;c&quot; &apos;d&apos;&gt;");
    expect(pdfString("a(b)\\c é")).toBe("(a\\(b\\)\\\\c ?)");
    expect(formatNumber(1.23456)).toBe("1.235");
    expect(formatNumber(2.5)).toBe("2.5");
    expect(formatNumber(-0.0001)).toBe("0");
    expect(formatNumber(10)).toBe("10");
  });
});

describe("clothModel", () => {
  it("shows the warp where a hook lifts on the face and the weft on the back", () => {
    const plan = samplePlan();
    const face = clothModel(plan, profile, yarns, "face");
    const back = clothModel(plan, profile, yarns, "back");
    expect(face.ok && back.ok).toBe(true);
    if (!face.ok || !back.ok) return;
    expect(face.value).toHaveLength(plan.pickCount);
    expect(face.value[0]).toHaveLength(plan.hookCount);
    const lifted = plan.lifts[0]![0]!;
    expect(face.value[0]![0]!.top).toBe(lifted ? "warp" : "weft");
    expect(back.value[0]![0]!.top).toBe(lifted ? "weft" : "warp");
    expect(face.value[1]!.find((cell) => cell.top === "weft")?.colour).toBe("#8c2f39");
  });

  it("rejects a bad yarn colour", () => {
    const result = clothModel(samplePlan(), profile, { warp: ["red"], weft: ["#ffffff"] }, "face");
    expect(result.ok ? undefined : result.error.code).toBe("YARN_INVALID");
  });
});

describe("writeWif and readWif", () => {
  it("round-trips a plan and uses CRLF line endings", () => {
    const plan = samplePlan(false);
    const wif = writeWif(plan, profile, yarns, { title: "Diamond [test]" });
    expect(wif.ok).toBe(true);
    if (!wif.ok) return;
    expect(wif.value.startsWith("[WIF]\r\nVersion=1.1\r\n")).toBe(true);
    expect(wif.value).toContain("Title=Diamond (test)\r\n");
    expect(wif.value).toContain("[JACQUARD]\r\nDesignWidth=4\r\nRepeatAcross=false\r\n");
    expect(wif.value.replace(/\r\n/g, "")).not.toContain("\n");
    const read = readWif(wif.value);
    expect(read).toEqual({ ok: true, value: plan });
  });

  it("reads a file without the private section and rejects one without a liftplan", () => {
    const plan = samplePlan(true);
    const wif = writeWif(plan, profile, yarns);
    if (!wif.ok) throw new Error("write failed");
    const plain = wif.value.slice(0, wif.value.indexOf("[JACQUARD]"));
    const read = readWif(plain);
    expect(read.ok && read.value.designWidth).toBe(plan.hookCount);
    const broken = plain.slice(0, plain.indexOf("[LIFTPLAN]"));
    const result = readWif(broken);
    expect(result.ok ? undefined : result.error.code).toBe("WIF_INVALID");
  });
});

describe("card sheets", () => {
  it("lays out one card per pick with every position", () => {
    const plan = samplePlan();
    const layout = cardSheetLayout(plan, profile);
    expect(layout.ok).toBe(true);
    if (!layout.ok) return;
    expect(layout.value.cards.map((card) => card.number)).toEqual([1, 2, 3, 4]);
    expect(layout.value.cards[0]!.holes).toHaveLength(10);
    const cards = buildCards(plan, profile);
    if (!cards.ok) throw new Error("cards failed");
    expect(layout.value.cards[0]!.holes.filter((hole) => hole.punched).length).toBe(
      cards.value.cards[0]!.punched.filter(Boolean).length,
    );
  });

  it("writes an SVG with one card group per pick and the untested-format note", () => {
    const plan = samplePlan();
    const svg = cardSheetSvg(plan, profile, { title: "A & B" });
    expect(svg.ok).toBe(true);
    if (!svg.ok) return;
    expect(svg.value).toContain(CARD_SHEET_NOTE);
    expect(svg.value).toContain(escapeXml(profileSummary(profile)));
    expect(svg.value).toContain("A &amp; B");
    expect(svg.value.match(/<g class="card" data-number="/g)).toHaveLength(4);
    const punched = (svg.value.match(/class="hole punched"/g) ?? []).length;
    const empty = (svg.value.match(/class="hole"/g) ?? []).length;
    expect(punched + empty).toBe(40);
  });

  it("passes engine errors through unchanged", () => {
    const plan = samplePlan();
    const bad = { ...plan, pickCount: 99 };
    const svg = cardSheetSvg(bad, profile);
    expect(svg.ok ? undefined : svg.error.code).toBe("PLAN_INVALID");
  });

  it("writes a PDF 1.4 with a correct cross-reference table", () => {
    const plan = samplePlan();
    const pdf = cardSheetPdf(plan, profile);
    expect(pdf.ok).toBe(true);
    if (!pdf.ok) return;
    const text = latin1(pdf.value);
    expect(text.startsWith("%PDF-1.4\n")).toBe(true);
    expect(text.endsWith("%%EOF\n")).toBe(true);
    expect(text).not.toContain("/CreationDate");
    expect(text).toContain(pdfString(CARD_SHEET_NOTE));
    const startxref = Number(/startxref\n(\d+)\n%%EOF/.exec(text)![1]);
    expect(text.slice(startxref, startxref + 4)).toBe("xref");
    const entries = text.slice(startxref).split("\n").slice(3).filter((line) => / 00000 n $/.test(line));
    entries.forEach((entry, index) => {
      const offset = Number(entry.slice(0, 10));
      expect(text.slice(offset).startsWith(`${index + 1} 0 obj`)).toBe(true);
    });
    const layout = cardSheetLayout(plan, profile);
    if (!layout.ok) throw new Error("layout failed");
    const { cardsPerPage } = pdfCardsPerPage(layout.value.cardWidth, layout.value.cardHeight, false);
    const pages = (text.match(/\/Type \/Page /g) ?? []).length;
    expect(pages).toBe(Math.ceil(4 / cardsPerPage));
  });

  it("fits a 400-hook card on A4 and keeps 416 positions", () => {
    const lifts = [Array.from({ length: 400 }, (_, hook) => hook % 2 === 0)];
    const plan: LiftPlan = { pickCount: 1, hookCount: 400, designWidth: 400, repeatAcross: false, lifts };
    const layout = cardSheetLayout(plan, PROFILE_400);
    expect(layout.ok && layout.value.cards[0]!.holes.length).toBe(416);
    expect(layout.ok && layout.value.rowsPerCard).toBe(52);
    const pdf = cardSheetPdf(plan, PROFILE_400);
    expect(pdf.ok).toBe(true);
  });

  it("PdfWriter computes stream lengths in bytes", () => {
    const writer = new PdfWriter();
    const stream = writer.addStream("é");
    const root = writer.add(`<< /Type /Catalog /S ${stream} 0 R >>`);
    const text = latin1(writer.finish(root));
    expect(text).toContain("/Length 2 >>");
  });
});

describe("pointPaperSvg", () => {
  it("draws runs with pick 0 at the bottom and escapes the title", () => {
    const svg = pointPaperSvg(design, ["#f3ead8", "#8c2f39"], { title: `<"x" & 'y'>` });
    expect(svg.ok).toBe(true);
    if (!svg.ok) return;
    expect(svg.value).toContain("&lt;&quot;x&quot; &amp; &apos;y&apos;&gt;");
    expect(svg.value).toContain('data-pick="0" data-end="0" data-length="2" data-region="0"');
    const y = (pick: number): number =>
      Number(new RegExp(`data-pick="${pick}" data-end="0"[^>]* y="(\\d+)"`).exec(svg.value)![1]);
    expect(y(0)).toBeGreaterThan(y(3));
    expect(svg.value).toContain("Region 1 (#8c2f39)");
  });

  it("rejects a region with no palette colour", () => {
    const result = pointPaperSvg(design, ["#f3ead8"]);
    expect(result.ok ? undefined : result.error.code).toBe("DESIGN_INVALID");
    const ragged = pointPaperSvg([[0, 0], [0]], ["#f3ead8"]);
    expect(ragged.ok ? undefined : ragged.error.code).toBe("DESIGN_INVALID");
  });
});
