// Example tests for the motif builder (motif-builder 1.3, 1.5, 2.5, 2.8): the lotus example, the six
// descriptions checked on the live site, the rosette fallback and a mirrored elephant.
import { describe, expect, it } from "vitest";
import { buildMotif, describeMotif, motifToDesign, parseMotif, rasterizeMotif } from "../src/index.js";
import { componentsOf, isSymmetric } from "./grid.js";

const REPEAT = { ends: 48, picks: 48 } as const;

function quarterTurn(grid: readonly (readonly number[])[]): number[][] {
  const size = grid.length;
  return grid.map((row, pick) => row.map((_, end) => grid[end]![size - 1 - pick]!));
}

describe("the lotus example (2.8)", () => {
  const text = "a lotus with four petals on a plain ground";
  const description = describeMotif(text, { colourCount: 3 });
  const svg = buildMotif(description.plan);

  it("reads the subject, the count, the ground and the colours", () => {
    expect(description.plan).toMatchObject({ subject: "lotus", count: 4, layout: "single", symmetry: "mirrorBoth" });
    expect(description.plan.colours).toHaveLength(3);
    expect(description.plan.colours[0]!.name).toBe("cream");
    expect(description.understood).toEqual(["lotus", "four petals", "plain ground"]);
    expect(description.unused).toEqual([]);
    expect(description.fellBack).toBe(false);
  });

  it("draws a raster with four-way and quarter-turn symmetry", () => {
    const parsed = parseMotif(svg, 3);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const raster = rasterizeMotif(parsed.value, REPEAT);
    expect(isSymmetric(raster, "mirrorBoth")).toBe(true);
    expect(quarterTurn(raster)).toEqual(raster);
  });

  it("gives a four-way symmetric design with exactly four petal regions", () => {
    const result = motifToDesign(svg, { colourCount: 3, symmetry: description.plan.symmetry, repeat: REPEAT, minFeature: 2 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const { design, palette } = result.value;
    expect(isSymmetric(design, "mirrorBoth")).toBe(true);
    const petal = palette.indexOf(description.plan.colours[1]!.hex);
    expect(petal).toBeGreaterThan(0);
    const petals = componentsOf(design).filter((component) => component.region === petal);
    expect(petals).toHaveLength(4);
  });
});

describe("the six descriptions checked on the live site", () => {
  const cases: readonly { text: string; plan: Record<string, unknown>; understood: readonly string[] }[] = [
    { text: "a lotus with four petals on a plain ground", plan: { subject: "lotus", count: 4, symmetry: "mirrorBoth", layout: "single" }, understood: ["lotus", "four petals", "plain ground"] },
    { text: "a peacock", plan: { subject: "peacock", count: null, symmetry: "mirrorEnds", layout: "single" }, understood: ["peacock"] },
    { text: "an eight-point star", plan: { subject: "star", count: 8, symmetry: "mirrorBoth" }, understood: ["eight point", "star"] },
    { text: "a paisley border", plan: { subject: "paisley", layout: "border", symmetry: "none" }, understood: ["paisley", "border"] },
    { text: "small diamond all-over", plan: { subject: "diamond", size: "small", layout: "allOver", symmetry: "mirrorBoth" }, understood: ["small", "diamond", "all over"] },
    { text: "an elephant", plan: { subject: "elephant", symmetry: "none", layout: "single" }, understood: ["elephant"] },
  ];
  for (const { text, plan, understood } of cases) {
    it(`"${text}"`, () => {
      const description = describeMotif(text, { colourCount: 3 });
      expect(description.plan).toMatchObject(plan);
      expect(description.understood).toEqual(understood);
      expect(description.fellBack).toBe(false);
      const svg = buildMotif(description.plan);
      expect(svg).toContain(`<title>Motif builder: ${description.plan.subject}</title>`);
      expect(parseMotif(svg, description.plan.colours.length).ok).toBe(true);
    });
  }
});

describe("reading words", () => {
  it("falls back to a rosette and says which words it understood (1.3)", () => {
    const description = describeMotif("a blue thing", { colourCount: 3 });
    expect(description.fellBack).toBe(true);
    expect(description.plan.subject).toBe("rosette");
    expect(description.understood).toEqual(["blue"]);
    expect(description.unused).toEqual(["thing"]);
  });

  it("uses named colours, with the ground first (1.6)", () => {
    const description = describeMotif("a gold and red lotus on an indigo ground", { colourCount: 2 });
    expect(description.plan.colours.map((colour) => colour.name)).toEqual(["indigo", "gold", "red"]);
  });

  it("drops colours beyond four with a note (1.6)", () => {
    const description = describeMotif("a star in red, gold, green, blue and pink", { colourCount: 3 });
    expect(description.plan.colours).toHaveLength(4);
    expect(description.notes.join(" ")).toContain("pink");
  });

  it("clamps a count with a note", () => {
    const description = describeMotif("a lotus with 30 petals", { colourCount: 3 });
    expect(description.plan.count).toBe(12);
    expect(description.notes).toHaveLength(1);
  });

  it("mirrors an odd star left to right only, and a pair of peacocks (1.5)", () => {
    expect(describeMotif("a five-point star", { colourCount: 3 }).plan.symmetry).toBe("mirrorEnds");
    expect(describeMotif("two peacocks", { colourCount: 3 }).plan.symmetry).toBe("mirrorEnds");
    const fourWay = describeMotif("a four-way peacock", { colourCount: 3 });
    expect(fourWay.plan.symmetry).toBe("mirrorEnds");
    expect(fourWay.notes).toHaveLength(1);
  });

  it("reads a figure before a border word and keeps one subject (1.1)", () => {
    const description = describeMotif("border of lotus and peacock", { colourCount: 3 });
    expect(description.plan).toMatchObject({ subject: "lotus", layout: "border" });
    expect(description.unused).toContain("peacock");
  });

  it("does not read object keys as words", () => {
    const description = describeMotif("constructor toString __proto__", { colourCount: 3 });
    expect(description.fellBack).toBe(true);
    expect(description.plan.size).toBe("medium");
  });
});

describe("a mirrored elephant (2.5)", () => {
  it("is drawn in the left half only, so the mirror makes a facing pair", () => {
    const description = describeMotif("a mirrored elephant", { colourCount: 3 });
    expect(description.plan.symmetry).toBe("mirrorEnds");
    const parsed = parseMotif(buildMotif(description.plan), 3);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const raster = rasterizeMotif(parsed.value, REPEAT);
    for (const row of raster) for (let end = 24; end < 48; end += 1) expect(row[end]).toBe(0);
    expect(raster.some((row) => row.slice(0, 24).some((cell) => cell !== 0))).toBe(true);
  });
});
