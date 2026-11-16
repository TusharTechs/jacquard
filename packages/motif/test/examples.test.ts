// Example tests for @jacquard/motif (motif-input task 3.13): a hand-drawn motif with known cells,
// each forbidden construct by name, a sketch request, the size boundaries and a 400-end repeat.
// Requirements: 4.3, 4.4, 5.2, 5.3, 1.1, 1.3
import { PROFILE_400, buildLiftPlan } from "@jacquard/engine";
import { describe, expect, it } from "vitest";
import { motifToDesign, parseMotif, rasterizeMotif, standInMotif, validateMotifRequest } from "../src/index.js";
import type { MotifRequest } from "../src/index.js";
import { toBase64 } from "./arbitraries.js";

function svgOf(body: string, rootAttributes = ""): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 4"${rootAttributes}><rect x="0" y="0" width="4" height="4" fill="#ffffff"/>${body}</svg>`;
}

describe("hand-drawn motif with known cells (5.2, 5.3)", () => {
  // A white background with a red square in the top-left quadrant of the drawing.
  const svg = svgOf('<rect x="0" y="0" width="2" height="2" fill="#aa0000"/>');

  it("puts the top of the drawing at the high picks: pick 0 is the bottom row", () => {
    const parsed = parseMotif(svg, 2);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.palette).toEqual(["#ffffff", "#aa0000"]);
    // design[pick][end]
    expect(rasterizeMotif(parsed.value, { ends: 4, picks: 4 })).toEqual([
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [1, 1, 0, 0],
      [1, 1, 0, 0],
    ]);
    expect(rasterizeMotif(parsed.value, { ends: 2, picks: 2 })).toEqual([
      [0, 0],
      [1, 0],
    ]);
  });

  it("lets a later shape win and fills a path by the non-zero rule", () => {
    // A blue path covering the right half, then a green triangle over the bottom-right cell's centre.
    const later = svgOf('<path d="M2 0 H4 V4 H2 Z" fill="#0000ff"/><polygon points="3,3 4,3 4,4" fill="#00ff00"/>');
    const parsed = parseMotif(later, 3);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    // The centre (3.5, 3.5) of end 3, pick 0 lies on the triangle's hypotenuse, which counts as inside (5.4).
    expect(rasterizeMotif(parsed.value, { ends: 4, picks: 4 })).toEqual([
      [0, 0, 1, 2],
      [0, 0, 1, 1],
      [0, 0, 1, 1],
      [0, 0, 1, 1],
    ]);
  });
});

describe("each forbidden construct by name (4.3)", () => {
  const cases: [string, string, string][] = [
    ["script element", svgOf("<script>alert(1)</script>"), "element:script"],
    ["foreignObject element", svgOf("<foreignObject><div/></foreignObject>"), "element:foreignObject"],
    ["image element", svgOf('<image width="1" height="1"/>'), "element:image"],
    ["use element", svgOf("<use/>"), "element:use"],
    ["style element", svgOf("<style>rect { fill: red }</style>"), "element:style"],
    ["text element", svgOf("<text>hi</text>"), "element:text"],
    ["onload attribute", svgOf("", ' onload="alert(1)"'), "attribute:onload"],
    ["href attribute", svgOf('<rect href="#a" width="1" height="1"/>'), "attribute:href"],
    ["xlink:href attribute", svgOf('<g xlink:href="#a"></g>'), "attribute:xlink:href"],
    ["style attribute", svgOf('<rect style="fill:red" width="1" height="1"/>'), "attribute:style"],
    ["DOCTYPE declaration", `<!DOCTYPE svg>${svgOf("")}`, "doctype"],
    ["ENTITY declaration", `<?xml version="1.0"?><!ENTITY x "y">${svgOf("")}`, "entity"],
    ["non-XML processing instruction", `<?xml-stylesheet href="a.css"?>${svgOf("")}`, "processingInstruction"],
    ['fill="red"', svgOf('<rect width="1" height="1" fill="red"/>'), "fill:red"],
    ['fill="url(#g)"', svgOf('<rect width="1" height="1" fill="url(#g)"/>'), "fill:url(#g)"],
    ["path with a C command", svgOf('<path d="M0 0 C1 1 2 2 3 0 Z"/>'), "pathCommand:C"],
  ];
  for (const [name, svg, reason] of cases) {
    it(`rejects a ${name} with reason ${reason}`, () => {
      const result = parseMotif(svg, 8);
      expect(result).toEqual({ ok: false, error: expect.objectContaining({ code: "MOTIF_SVG_INVALID", reason }) });
    });
  }

  it("accepts the same base document with none of them", () => {
    expect(parseMotif(svgOf('<rect width="1" height="1" fill="#abc"/>'), 8).ok).toBe(true);
  });
});

describe("size boundaries (4.4)", () => {
  it("accepts exactly 2,000 shapes and rejects 2,001", () => {
    const shapes = (n: number): string => `<svg viewBox="0 0 1 1">${'<rect width="1"/>'.repeat(n)}</svg>`;
    expect(parseMotif(shapes(2000), 2).ok).toBe(true);
    expect(parseMotif(shapes(2001), 2)).toEqual({ ok: false, error: expect.objectContaining({ reason: "tooLarge" }) });
  });

  it("accepts exactly 65,536 characters and rejects 65,537", () => {
    const base = svgOf("");
    const exact = base + " ".repeat(65_536 - base.length);
    expect(exact.length).toBe(65_536);
    expect(parseMotif(exact, 2).ok).toBe(true);
    expect(parseMotif(`${exact} `, 2)).toEqual({ ok: false, error: expect.objectContaining({ reason: "tooLarge" }) });
  });
});

describe("requests (1.1, 1.3)", () => {
  it("accepts a sketch request and the stand-in serves it", () => {
    const request = {
      input: { kind: "sketch", mediaType: "image/png", data: toBase64([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) },
      colourCount: 3,
      symmetry: "mirrorEnds",
      repeat: { ends: 24, picks: 16 },
    };
    const validated = validateMotifRequest(request);
    expect(validated).toEqual({ ok: true, value: request });
    if (!validated.ok) return;
    const svg = standInMotif(validated.value);
    const parsed = parseMotif(svg, 3);
    expect(parsed.ok && parsed.value.palette.length).toBe(3);
  });

  it("accepts a 500-character prompt and a 1,500,000-byte sketch at the limits", () => {
    const base = { colourCount: 2, symmetry: "none", repeat: { ends: 8, picks: 8 } };
    expect(validateMotifRequest({ ...base, input: { kind: "text", prompt: "🦚".repeat(500) } }).ok).toBe(true);
    expect(validateMotifRequest({ ...base, input: { kind: "sketch", mediaType: "image/jpeg", data: "QUFB".repeat(500_000) } }).ok).toBe(true);
    expect(validateMotifRequest({ ...base, input: { kind: "sketch", mediaType: "image/jpeg", data: `${"QUFB".repeat(500_000)}QQ==` } })).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "REQUEST_INVALID", field: "input.data" }),
    });
  });
});

describe("a 400-end repeat", () => {
  it("rasterizes a left-half rect at 400 by 400 cells", () => {
    const svg = '<svg viewBox="0 0 400 400"><rect width="400" height="400" fill="#f2e8d5"/><rect width="200" height="400" fill="#1e3a5f"/></svg>';
    const parsed = parseMotif(svg, 2);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const design = rasterizeMotif(parsed.value, { ends: 400, picks: 400 });
    expect(design).toHaveLength(400);
    for (const row of design) {
      expect(row).toHaveLength(400);
      expect(row.slice(0, 200).every((v) => v === 1)).toBe(true);
      expect(row.slice(200).every((v) => v === 0)).toBe(true);
    }
  });

  it("runs a 400-end stand-in motif through the pipeline into the 400-hook profile", () => {
    const request: MotifRequest = { input: { kind: "text", prompt: "peacock border" }, colourCount: 4, symmetry: "mirrorBoth", repeat: { ends: 400, picks: 64 } };
    const result = motifToDesign(standInMotif(request), { colourCount: 4, symmetry: "mirrorBoth", repeat: request.repeat, minFeature: 4 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.design).toHaveLength(64);
    expect(result.value.design[0]).toHaveLength(400);
    const weaves = {
      0: { kind: "plain" },
      1: { kind: "twill", up: 1, down: 3, direction: "Z" },
      2: { kind: "satin", size: 5, move: 2, facing: "weft" },
      3: { kind: "twill", up: 3, down: 1, direction: "S" },
    } as const;
    const plan = buildLiftPlan({ design: result.value.design, weaves, profile: { ...PROFILE_400, regionLimit: 8 }, repeatAcross: true });
    expect(plan.ok, plan.ok ? "" : JSON.stringify(plan.error)).toBe(true);
  });
});
