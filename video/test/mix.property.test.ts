// Feature: demo-video, Property 3: Music stays 18 dB under the voice
// For any set of narration windows inside 0 to 170 s and any time t inside a window, musicGainDb(t)
// is at most VOICE_LUFS − 18 − SCORE_REF_LUFS; at every t the gain is finite and at most GAP_DB.
// Validates: Requirements 5.3
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { GAP_DB, SCORE_REF_LUFS, VOICE_LUFS, musicGainDb } from "../src/mix.ts";

const SEED = 7103;
const NUM_RUNS = 100;

const windowsArb = fc.array(
  fc.tuple(fc.double({ min: 0, max: 169, noNaN: true }), fc.double({ min: 0.1, max: 60, noNaN: true })).map(([start, length]) => ({ start, end: Math.min(170, start + length) })),
  { minLength: 1, maxLength: 12 },
);

describe("Feature: demo-video, Property 3: Music stays 18 dB under the voice", () => {
  it("ducks the score under every narration window", () => {
    fc.assert(
      fc.property(windowsArb, fc.nat({ max: 11 }), fc.double({ min: 0, max: 1, noNaN: true }), fc.double({ min: 0, max: 170, noNaN: true }), (windows, pick, fraction, anyT) => {
        const window = windows[pick % windows.length]!;
        const t = window.start + (window.end - window.start) * fraction;
        expect(musicGainDb(t, windows)).toBeLessThanOrEqual(VOICE_LUFS - 18 - SCORE_REF_LUFS);
        const gain = musicGainDb(anyT, windows);
        expect(Number.isFinite(gain)).toBe(true);
        expect(gain).toBeLessThanOrEqual(GAP_DB);
      }),
      { seed: SEED, numRuns: NUM_RUNS, verbose: 1 },
    );
  });
});
