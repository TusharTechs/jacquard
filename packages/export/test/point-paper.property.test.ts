// Feature: simulate-and-export, Property 9: Point-paper sheet
// For any design up to 40 by 40 with up to 8 regions and a palette, the SVG is well-formed, the
// fill colour of each cell (read back by sampling the merged rects) equals the palette colour of
// its region with pick 0 at the bottom, region numbers appear for each cell, and any title text
// with <, & or quotes is escaped.
// Validates: Requirements 5.1, 5.2, 5.3
//
// The cell grid is recovered from the run rectangles' geometry: the cell size is the rect height,
// the grid's left and top edges are the smallest x and y. A rect's pick is read from its y
// coordinate (pick 0 in the bottom row), and its ends from x and width; the data attributes are
// checked against the geometry, not trusted in place of it.
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { pointPaperSvg } from "../src/index.js";
import { pointPaperCaseArb, titleArb } from "./arbitraries.js";
import { leafElements, startTags, unescapeXml, wellFormedProblem } from "./xml.js";

const SEED = 5109;
const NUM_RUNS = 100;

describe("Feature: simulate-and-export, Property 9: Point-paper sheet", () => {
  it("draws every cell in its region colour, pick 0 at the bottom, numbered, with escaped text", () => {
    fc.assert(
      fc.property(pointPaperCaseArb, fc.option(titleArb, { nil: undefined }), ({ design, palette }, title) => {
        const result = pointPaperSvg(design, palette, title === undefined ? {} : { title });
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        const svg = result.value;
        expect(wellFormedProblem(svg)).toBeUndefined();
        const picks = design.length;
        const ends = design[0]!.length;

        // Read the cells back from the merged run rects.
        const runs = startTags(svg, "rect").filter((r) => r["class"] === "run");
        expect(runs.length).toBeGreaterThan(0);
        const cell = Number(runs[0]!["height"]);
        expect(cell).toBeGreaterThan(0);
        const left = Math.min(...runs.map((r) => Number(r["x"])));
        const top = Math.min(...runs.map((r) => Number(r["y"])));
        const seen: (string | undefined)[][] = design.map((row) => row.map(() => undefined));
        for (const run of runs) {
          const x = Number(run["x"]);
          const y = Number(run["y"]);
          const width = Number(run["width"]);
          expect(Number(run["height"])).toBe(cell);
          const firstEnd = (x - left) / cell;
          const length = width / cell;
          const rowFromTop = (y - top) / cell;
          expect(Number.isInteger(firstEnd) && Number.isInteger(length) && Number.isInteger(rowFromTop)).toBe(true);
          // 5.1 pick 0 at the bottom: the bottom row of the grid is pick 0.
          const pick = picks - 1 - rowFromTop;
          expect(pick >= 0 && pick < picks, `rect at y ${y}`).toBe(true);
          expect(firstEnd >= 0 && length >= 1 && firstEnd + length <= ends, `rect at x ${x}`).toBe(true);
          expect(run["data-pick"]).toBe(String(pick));
          expect(run["data-end"]).toBe(String(firstEnd));
          expect(run["data-length"]).toBe(String(length));
          for (let end = firstEnd; end < firstEnd + length; end += 1) {
            expect(seen[pick]![end], `cell pick ${pick}, end ${end} drawn twice`).toBeUndefined();
            seen[pick]![end] = run["fill"];
            const region = design[pick]![end]!;
            expect(run["data-region"]).toBe(String(region));
            expect(run["fill"]!.toLowerCase(), `pick ${pick}, end ${end}`).toBe(palette[region]!.toLowerCase());
          }
        }
        for (let pick = 0; pick < picks; pick += 1) {
          for (let end = 0; end < ends; end += 1) expect(seen[pick]![end], `cell pick ${pick}, end ${end} not drawn`).toBeDefined();
        }

        // 5.2 a region number in every cell (designs here are at most 40 by 40), inside that cell.
        const numbers = leafElements(svg, "text").filter((t) => t.attrs["class"] === "cell-region");
        expect(numbers).toHaveLength(picks * ends);
        const numbered = new Set<string>();
        for (const n of numbers) {
          const x = Number(n.attrs["x"]);
          const y = Number(n.attrs["y"]);
          const end = Math.floor((x - left) / cell);
          const pick = picks - 1 - Math.floor((y - top) / cell);
          expect(n.attrs["data-pick"]).toBe(String(pick));
          expect(n.attrs["data-end"]).toBe(String(end));
          expect(n.text).toBe(String(design[pick]![end]));
          numbered.add(`${pick}:${end}`);
        }
        expect(numbered.size).toBe(picks * ends);

        // 5.2 a legend entry for every region used, in its colour.
        const used = [...new Set(design.flat())].sort((a, b) => a - b);
        const swatches = startTags(svg, "rect").filter((r) => r["class"] === "legend-swatch");
        expect(swatches.map((s) => s["data-region"])).toEqual(used.map(String));
        swatches.forEach((s, index) => expect(s["fill"]!.toLowerCase()).toBe(palette[used[index]!]!.toLowerCase()));
        const legendText = leafElements(svg, "text")
          .filter((t) => t.attrs["class"] === "legend-label")
          .map((t) => unescapeXml(t.text));
        for (const region of used) expect(legendText.some((t) => t.startsWith(`Region ${region} `))).toBe(true);

        // 5.1 axis numbers every 8 cells.
        const endNumbers = leafElements(svg, "text").filter((t) => t.attrs["class"] === "end-number").map((t) => t.text);
        const pickNumbers = leafElements(svg, "text").filter((t) => t.attrs["class"] === "pick-number").map((t) => t.text);
        const every8 = (count: number): string[] =>
          Array.from({ length: Math.ceil(count / 8) }, (_, i) => String(i * 8));
        expect(endNumbers).toEqual(every8(ends));
        expect(pickNumbers).toEqual(every8(picks));

        // 5.3 the title is escaped: it reads back exactly, and no raw special character is left.
        if (title !== undefined) {
          const titleEl = leafElements(svg, "title");
          expect(titleEl).toHaveLength(1);
          expect(unescapeXml(titleEl[0]!.text)).toBe(title);
          expect(/[<>"']/.test(titleEl[0]!.text)).toBe(false);
          const heading = leafElements(svg, "text").filter((t) => t.attrs["class"] === "title");
          expect(heading.map((t) => unescapeXml(t.text))).toEqual([title]);
        }
      }),
      { seed: SEED, numRuns: NUM_RUNS, verbose: 1 },
    );
  });
});
