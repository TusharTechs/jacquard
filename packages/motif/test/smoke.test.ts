// Smoke examples for every exported function of @jacquard/motif (motif-input wave 1).
// The property tests for Requirements 1 and 4 to 8 are written in wave 2.
import { describe, expect, it } from "vitest";
import {
  STAND_IN_FAMILIES,
  applySymmetry,
  motifToDesign,
  parseMotif,
  rasterizeMotif,
  removeSpecks,
  standInMotif,
  validateMotifRequest,
} from "../src/index.js";
import type { MotifRequest } from "../src/index.js";

const SIMPLE = [
  '<?xml version="1.0"?>',
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 4">',
  "<title>Two blocks</title>",
  '<rect x="0" y="0" width="4" height="4" fill="#FFF"/>',
  '<g fill="#a00"><rect x="0" y="2" width="2" height="2"/></g>',
  '<path d="M2 0 H4 V2 H2 Z" fill="#0000ff"/>',
  "</svg>",
].join("");

const REQUEST: MotifRequest = {
  input: { kind: "text", prompt: "a lozenge border" },
  colourCount: 4,
  symmetry: "mirrorBoth",
  repeat: { ends: 24, picks: 24 },
};

describe("parseMotif", () => {
  it("parses the palette and shapes of a simple motif (4.5, 4.6)", () => {
    const result = parseMotif(SIMPLE, 3);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.viewBox).toEqual([0, 0, 4, 4]);
    expect(result.value.palette).toEqual(["#ffffff", "#aa0000", "#0000ff"]);
    expect(result.value.shapes.map((shape) => shape.paletteIndex)).toEqual([0, 1, 2]);
  });

  it("names the first forbidden construct (4.3)", () => {
    const cases: [string, string][] = [
      ['<svg viewBox="0 0 1 1"><script/></svg>', "element:script"],
      ['<svg viewBox="0 0 1 1" onload="x()"></svg>', "attribute:onload"],
      ['<svg viewBox="0 0 1 1"><rect style="fill:red"/></svg>', "attribute:style"],
      ['<!DOCTYPE svg><svg viewBox="0 0 1 1"></svg>', "doctype"],
      ['<svg viewBox="0 0 1 1"><rect fill="red"/></svg>', "fill:red"],
      ['<svg viewBox="0 0 1 1"><path d="M0 0 C1 1 1 1 0 1"/></svg>', "pathCommand:C"],
      ['<svg viewBox="0 0 1 1"><rect transform="rotate(45)"/></svg>', "transform"],
      ['<svg viewBox="0 0 0 1"></svg>', "viewBox"],
      ['<g viewBox="0 0 1 1"></g>', "root"],
      ['<svg viewBox="0 0 1 1">hello</svg>', "text"],
      ['<?php echo 1 ?><svg viewBox="0 0 1 1"></svg>', "processingInstruction"],
    ];
    for (const [svg, reason] of cases) {
      const result = parseMotif(svg, 8);
      expect(result.ok ? null : result.error, svg).toMatchObject({ code: "MOTIF_SVG_INVALID", reason });
    }
  });

  it("reports too many colours with count and limit (4.7)", () => {
    const result = parseMotif(SIMPLE, 2);
    expect(result.ok ? null : result.error).toMatchObject({ code: "MOTIF_TOO_MANY_COLOURS", count: 3, limit: 2 });
  });
});

describe("rasterizeMotif", () => {
  it("puts pick 0 at the bottom of the viewBox (5.3)", () => {
    const parsed = parseMotif(SIMPLE, 3);
    if (!parsed.ok) throw new Error("fixture must parse");
    // Red is the bottom-left quarter, blue the top-right quarter.
    expect(rasterizeMotif(parsed.value, { ends: 2, picks: 2 })).toEqual([
      [1, 0],
      [0, 2],
    ]);
  });
});

describe("applySymmetry", () => {
  it("mirrors ends and picks (7.1 to 7.3)", () => {
    const design = [
      [1, 2, 3],
      [4, 5, 6],
    ];
    expect(applySymmetry(design, "mirrorEnds")).toEqual([
      [1, 2, 1],
      [4, 5, 4],
    ]);
    expect(applySymmetry(design, "mirrorBoth")).toEqual([
      [1, 2, 1],
      [1, 2, 1],
    ]);
    expect(applySymmetry(design, "none")).toEqual(design);
  });
});

describe("removeSpecks", () => {
  it("merges a one-cell speck into its surrounding region (6.3)", () => {
    const design = [
      [0, 0, 0],
      [0, 1, 0],
      [0, 0, 0],
    ];
    expect(removeSpecks(design, 2)).toEqual([
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
    ]);
    expect(removeSpecks(design, 1)).toEqual(design);
  });
});

describe("validateMotifRequest", () => {
  it("accepts a valid request and names the offending field otherwise (1.1, 1.3)", () => {
    expect(validateMotifRequest({ ...REQUEST, extra: true })).toEqual({ ok: true, value: REQUEST });
    const bad = validateMotifRequest({ ...REQUEST, repeat: { ends: 7, picks: 24 } });
    expect(bad.ok ? null : bad.error).toMatchObject({ code: "REQUEST_INVALID", field: "repeat.ends" });
    const sketch = validateMotifRequest({ ...REQUEST, input: { kind: "sketch", mediaType: "image/png", data: "iVBO" } });
    expect(sketch.ok).toBe(true);
  });
});

describe("standInMotif and motifToDesign", () => {
  it("is deterministic and yields a symmetric design of the repeat size (7.6, 8.2, 8.3)", () => {
    const svg = standInMotif(REQUEST);
    expect(standInMotif(REQUEST)).toBe(svg);
    const parsed = parseMotif(svg, REQUEST.colourCount);
    expect(parsed.ok && parsed.value.palette.length).toBe(REQUEST.colourCount);
    const result = motifToDesign(svg, { ...REQUEST, minFeature: 4 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.design).toHaveLength(24);
    expect(result.value.design.every((cells) => cells.length === 24)).toBe(true);
    expect(applySymmetry(result.value.design, "mirrorBoth")).toEqual(result.value.design);
  });

  it("has at least five families, each producing a palette of exactly colourCount (8.4)", () => {
    expect(STAND_IN_FAMILIES.length).toBeGreaterThanOrEqual(5);
    const seen = new Set<string>();
    for (let index = 0; index < 60; index += 1) {
      for (const colourCount of [2, 5, 8]) {
        const svg = standInMotif({ ...REQUEST, colourCount, input: { kind: "text", prompt: `motif ${index}` } });
        const parsed = parseMotif(svg, colourCount);
        expect(parsed.ok && parsed.value.palette.length, svg).toBe(colourCount);
        const family = /Stand-in motif: (\w+)/.exec(svg)?.[1];
        if (family !== undefined) seen.add(family);
      }
    }
    expect([...seen].sort()).toEqual([...STAND_IN_FAMILIES].sort());
  });
});
