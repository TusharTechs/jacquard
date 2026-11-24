// The Vertical_Cut's plan (demo-video 9.9, Tushar's final review). Property 9 and examples.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { LineTiming } from "../src/cues.ts";
import { NARRATION_CREDIT } from "../src/script.ts";
import { CAPTION_SIZE, LEAD, LINES, MAX_SECONDS, SHOTS, TAIL, TIMING, VERTICAL_CUES, VERTICAL_SECONDS, ZONE, cutBefore, duration, verticalCues, verticalShots } from "../src/vertical.ts";
import type { Shot } from "../src/vertical.ts";
import { VOICE_TIMING } from "../src/voice-timing.ts";
import { timingArbitrary } from "./timing.ts";

/** Vertical_Cut time of Main_Cut time `t` in a line's shots, or null if it is cut out. */
function verticalTime(shots: readonly Shot[], line: number, t: number): number | null {
  const shot = shots.find((item) => item.line === line && t >= item.from && t < item.to);
  return shot === undefined ? null : t - shot.from + shot.at;
}

function check(timing: readonly LineTiming[]) {
  const shots = verticalShots(timing);
  // Shots follow each other with no gap, in Main_Cut order.
  for (let index = 1; index < shots.length; index += 1) {
    expect(shots[index]!.at).toBeCloseTo(shots[index - 1]!.at + shots[index - 1]!.to - shots[index - 1]!.from, 9);
    expect(shots[index]!.from).toBeGreaterThanOrEqual(shots[index - 1]!.to - 1e-9);
  }
  const cues = verticalCues(shots, timing);
  for (const number of LINES) {
    const line = timing[number - 1]!;
    // The whole line is in the cut, and a caption is up at every moment of its speech.
    for (const sentence of line.sentences) {
      for (let k = 0; k <= 20; k += 1) {
        const t = sentence.start + ((sentence.end - sentence.start) * k) / 20 - (k === 20 ? 1e-6 : 0);
        const at = verticalTime(shots, number, t);
        expect(at, `line ${number} at ${t}`).not.toBeNull();
        expect(cues.some((cue) => at! >= cue.start - 1e-9 && at! < cue.end + 1e-9), `caption for line ${number} at ${t}`).toBe(true);
      }
    }
  }
  return shots;
}

describe("Property 9: the Vertical_Cut holds the chosen lines, captioned, in 45 s", () => {
  it("holds for any voice timing", () => {
    fc.assert(
      fc.property(timingArbitrary, (timing) => {
        const shots = check(timing);
        const least = LINES.reduce((sum, number) => sum + (timing[number - 1]!.end - timing[number - 1]!.start) + LEAD + TAIL, 0);
        if (least <= MAX_SECONDS) expect(duration(shots)).toBeLessThanOrEqual(MAX_SECONDS + 1e-6);
        // The peacock appears before "and draws it on point paper".
        const draws = timing[6]!.words!.find((word) => word.word === "draws")!;
        const cut = shots.filter((shot) => shot.line === 7)[1]!.from;
        expect(cut).toBeLessThan(draws.start);
      }),
      { numRuns: 60 },
    );
  });
});

describe("the Vertical_Cut as rendered", () => {
  it("is 45 s or less with the real voice, every line captioned, ending on the vertical end card", () => {
    expect(VOICE_TIMING.length).toBe(26);
    check(TIMING);
    expect(VERTICAL_SECONDS).toBeLessThanOrEqual(45);
    expect(SHOTS[SHOTS.length - 1]!.look.kind).toBe("end");
    expect(NARRATION_CREDIT).toBe("Narration: synthetic voice (Kokoro-82M)");
  });

  it("cuts to the drawn peacock before the transcriber hears 'and draws'", () => {
    const words = TIMING[6]!.words!;
    const and = words[words.findIndex((word) => word.word.replace(/[^a-z]/gi, "").toLowerCase() === "draws") - 1]!;
    const cut = cutBefore(TIMING[6]!, "draws", 0);
    expect(cut).toBeLessThan(and.start);
    expect(SHOTS.filter((shot) => shot.line === 7)[1]!.from).toBe(cut);
  });

  it("fills the width with every crop, and puts large captions in the lower third", () => {
    for (const shot of SHOTS) {
      if (shot.look.kind === "end") continue;
      for (const crop of shot.look.crops) {
        expect(crop.width ?? 1080).toBe(1080);
        const height = (crop.crop.h * 1080) / crop.crop.w;
        expect(crop.top + height).toBeLessThanOrEqual(ZONE.h + 0.5);
      }
    }
    expect(CAPTION_SIZE).toBeGreaterThanOrEqual(56);
    for (const cue of VERTICAL_CUES) expect(cue.lines.every((line) => line.length <= 26 || !line.includes(" "))).toBe(true);
  });
});
