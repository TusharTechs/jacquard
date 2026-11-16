// Feature: motif-input, Property 4: Size limits
// For any input longer than 65,536 characters, or any otherwise valid Motif_SVG with more than
// 2,000 shapes, parseMotif returns MOTIF_SVG_INVALID with reason `tooLarge`.
// Validates: Requirements 4.4
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { parseMotif } from "../src/index.js";
import { motifDocArb, serializeMotif } from "./arbitraries.js";

const SEED = 4804;
const NUM_RUNS = 100;

const MAX_LENGTH = 65_536;
const MAX_SHAPES = 2_000;

const TOO_LARGE = { ok: false, error: expect.objectContaining({ code: "MOTIF_SVG_INVALID", reason: "tooLarge" }) };

/** Short shape tags, so that 2,001 or more of them stay under the length limit. */
const SHORT_SHAPES = ['<rect/>', '<path/>', '<circle/>', '<rect width="1"/>', '<ellipse/>', '<polygon/>'];

describe("Feature: motif-input, Property 4: Size limits", () => {
  it("rejects any input longer than 65,536 characters as tooLarge", () => {
    fc.assert(
      fc.property(
        fc.oneof(motifDocArb.map((doc) => serializeMotif(doc)), fc.string({ maxLength: 50 })),
        fc.integer({ min: 1, max: 5_000 }),
        fc.constantFrom(" ", "\n", "<!-- padding -->", "x", "<"),
        fc.boolean(),
        fc.integer({ min: 1, max: 8 }),
        (text, extra, pad, atStart, limit) => {
          const needed = MAX_LENGTH + extra - text.length;
          const padding = pad.repeat(Math.ceil(needed / pad.length));
          const svg = atStart ? padding + text : text + padding;
          expect(svg.length).toBeGreaterThan(MAX_LENGTH);
          expect(parseMotif(svg, limit)).toEqual(TOO_LARGE);
        },
      ),
      { seed: SEED, numRuns: NUM_RUNS, verbose: 1 },
    );
  });

  it("rejects otherwise valid Motif_SVG with more than 2,000 shapes as tooLarge", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: MAX_SHAPES + 1, max: MAX_SHAPES + 200 }),
        fc.array(fc.constantFrom(...SHORT_SHAPES.keys()), { minLength: 1, maxLength: 10 }),
        fc.oneof(fc.constant(0), fc.integer({ min: 5, max: 50 })),
        fc.integer({ min: 1, max: 8 }),
        (shapeCount, pattern, groupEvery, limit) => {
          const parts: string[] = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">'];
          let open = false;
          for (let i = 0; i < shapeCount; i += 1) {
            if (groupEvery > 0 && i % groupEvery === 0) {
              if (open) parts.push("</g>");
              parts.push('<g fill="#123">');
              open = true;
            }
            parts.push(SHORT_SHAPES[pattern[i % pattern.length]!]!);
          }
          if (open) parts.push("</g>");
          parts.push("</svg>");
          const svg = parts.join("");
          expect(svg.length).toBeLessThanOrEqual(MAX_LENGTH);
          expect(parseMotif(svg, limit)).toEqual(TOO_LARGE);
        },
      ),
      { seed: SEED, numRuns: NUM_RUNS, verbose: 1 },
    );
  });
});
