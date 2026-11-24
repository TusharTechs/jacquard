// Feature: demo-video, Property 1: Caption cues keep the narration
// For any narration (random words, punctuation, 1 to 400 words) and any window long enough for at
// least 0.25 s per cue, the cues' texts joined with spaces equal the narration with whitespace
// collapsed; every cue has at most two lines of at most 42 characters (a single longer word alone on
// its line excepted); cues are in order, contiguous, start at the window start and end at its end.
// Validates: Requirements 2.6
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { MAX_LINE, MAX_LINES, cuesFor, normalise } from "../src/cues.ts";

const SEED = 7101;
const NUM_RUNS = 100;

const wordArb = fc.oneof(
  fc.constantFrom("loom", "card", "pick,", "float.", "Kiro", "point", "paper;", "end?", "warp!", "a", "the", "JACQUARD"),
  fc.string({ minLength: 1, maxLength: 12, unit: fc.constantFrom(..."abcdefghijklmnopqrstuvwxyz.,!?'") }),
  fc.string({ minLength: 43, maxLength: 60, unit: fc.constantFrom(..."abcdefghij") }),
);
const narrationArb = fc
  .tuple(fc.array(wordArb, { minLength: 1, maxLength: 400 }), fc.constantFrom(" ", "  ", "\n", " \t "))
  .map(([words, gap]) => words.join(gap));

describe("Feature: demo-video, Property 1: Caption cues keep the narration", () => {
  it("joins back to the narration, with short lines, contiguous over the window", () => {
    fc.assert(
      fc.property(narrationArb, fc.double({ min: 0, max: 200, noNaN: true }), fc.double({ min: 0.25, max: 2, noNaN: true }), (text, start, perCue) => {
        const probe = cuesFor(text, 0, 1).length;
        const end = start + probe * perCue;
        const cues = cuesFor(text, start, end);
        expect(cues.map((cue) => cue.lines.join(" ")).join(" ")).toBe(normalise(text));
        for (const cue of cues) {
          expect(cue.lines.length).toBeGreaterThan(0);
          expect(cue.lines.length).toBeLessThanOrEqual(MAX_LINES);
          for (const line of cue.lines) if (line.includes(" ")) expect(line.length).toBeLessThanOrEqual(MAX_LINE);
          expect(cue.end).toBeGreaterThan(cue.start);
        }
        expect(cues[0]!.start).toBe(start);
        expect(cues[cues.length - 1]!.end).toBe(end);
        for (let index = 1; index < cues.length; index += 1) expect(cues[index]!.start).toBe(cues[index - 1]!.end);
      }),
      { seed: SEED, numRuns: NUM_RUNS, verbose: 1 },
    );
  });
});
