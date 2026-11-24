// Synthetic narration (demo-video Requirement 9): the overrides, the speed, the transcript check,
// the captions timed to the voice and the Vertical_Cut. Properties 7 to 9. No speech model runs here.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { CAPTION_HOLD, cuesForTimedParts, normalise, splitSentences } from "../src/cues.ts";
import type { LineTiming } from "../src/cues.ts";
import { VERTICAL_LEAD, VERTICAL_LINES, VERTICAL_MAX, VERTICAL_PARTS, VERTICAL_TAIL, MERGE_GAP, verticalParts } from "../src/edit.ts";
import type { Span } from "../src/edit.ts";
import { DURATION, NARRATION_CREDIT, SCENES } from "../src/script.ts";
import { BASE_SPEED, MAX_SPEED, MIN_SPEED, RUSHED_WPM, checkLine, checkTranscript, chooseSpeed, heardWords, retryTakes, speechSentences } from "../src/tts.ts";
import { VOICE_TIMING } from "../src/voice-timing.ts";

const PARTS = SCENES.flatMap((scene) => scene.parts);

describe("pronunciation overrides", () => {
  it("marks JACQUARD, jacquard, Kiro, WIF and handlooms, and keeps every other word", () => {
    expect(speechSentences("So I built JACQUARD, for the designer. On a jacquard handloom, a WIF file. Handlooms still use them.", 5)).toEqual([
      "So I built [JACQUARD](/ʤəkˈɑɹd/), for the designer.",
      "On a [jacquard](/ʤəkˈɑɹd/) handloom, a [WIF](/wˈɪf/) file.",
      "[Handlooms](/hˈændlˌumz/) still use them.",
    ]);
    expect(speechSentences("I built it with Kiro, spec first.", 14)).toEqual(["I built it with [Kiro](/kˈɪəɹO/), spec first."]);
  });

  it("applies a line's own override only in that line", () => {
    expect(speechSentences("Then the tests surprised me.", 18)).toEqual(["Then the [tests](/tˈɛstsz/) surprised me."]);
    expect(speechSentences("ninety-six property-based tests.", 14)).toEqual(["ninety-six property-based tests."]);
  });

  it("speaks every line sentence by sentence, never word by word, with the script's words", () => {
    for (const [index, part] of PARTS.entries()) {
      const spoken = speechSentences(part.text, index + 1);
      expect(spoken).toHaveLength(splitSentences(part.text).length);
      const plain = spoken.join(" ").replace(/\[([^\]]+)\]\(\/[^/]+\/\)/g, "$1");
      expect(plain).toBe(normalise(part.text));
    }
  });
});

describe("Property 7: the speed stays in range and never slows a line only to fill time", () => {
  it("holds for any speech length, window and word count", () => {
    fc.assert(
      fc.property(fc.double({ min: 0.5, max: 20, noNaN: true }), fc.double({ min: 0.5, max: 20, noNaN: true }), fc.integer({ min: 1, max: 40 }), (speech, window, words) => {
        const speed = chooseSpeed(speech, window, words);
        expect(speed).toBeGreaterThanOrEqual(MIN_SPEED);
        expect(speed).toBeLessThanOrEqual(MAX_SPEED);
        const wpm = (words / speech) * 60;
        if (speech <= window && wpm <= RUSHED_WPM) expect(speed).toBe(BASE_SPEED);
        if (speech > window) expect(speed).toBeGreaterThanOrEqual(BASE_SPEED);
        // A rushed line is slowed, but never so far that it no longer fits.
        if (speech <= window && wpm > RUSHED_WPM) expect((BASE_SPEED * speech) / speed).toBeLessThanOrEqual(window + 0.02);
      }),
    );
  });

  it("tries new seeds at the same speed before other speeds, all in range", () => {
    const takes = retryTakes(18, 1);
    expect(takes.slice(0, 3).every((take) => take.speed === 1)).toBe(true);
    expect(new Set(takes.map((take) => `${take.speed}/${take.seed}`)).size).toBe(takes.length);
    for (const take of retryTakes(3, 0.9)) expect(take.speed).toBeGreaterThanOrEqual(MIN_SPEED);
  });
});

describe("transcript check", () => {
  it("accepts punctuation, case, hyphens, spacing and spoken numbers", () => {
    expect(checkTranscript("Auto-fix changes only the lift plan, never my regions.", "Autofix changes only the lift plan never my regions").match).toBe(true);
    expect(checkTranscript("nine specs, ninety-six property-based tests.", "9 specs, 96 property based tests.").match).toBe(true);
    expect(heardWords("The app's own sound.")).toEqual(["the", "apps", "own", "sound"]);
  });

  it("fails a misheard word and says which", () => {
    expect(checkTranscript("So I built JACQUARD, with Kiro.", "So I built Jaccard with Cairo.")).toEqual({ match: false, missing: ["jacquard", "kiro"], extra: ["jaccard", "cairo"], sameSound: [] });
  });

  it("accepts the listed spellings and homophone, for their script word only, and says so", () => {
    expect(checkTranscript("Steering kept every weaving fact labelled.", "Steering kept every weaving fact labeled.")).toMatchObject({ match: true, sameSound: ["labelled/labeled (spelling)"] });
    expect(checkTranscript("A float that runs too long.", "A float that runs two long.")).toMatchObject({ match: true, sameSound: ["too/two (homophone)"] });
    expect(checkTranscript("A two-pick counterexample.", "A too pick counterexample.").match).toBe(false);
  });

  it("falls back to each sentence on its own, and still fails a word said wrong", () => {
    const line = "Then the tests surprised me. A lattice test proved it.";
    expect(checkLine(line, "Then the test surprised me. A lattice test proved it.")).toMatchObject({ match: false, by: null });
    expect(checkLine(line, "Then the test surprised me. A lattice test proved it.", ["Then the tests surprised me.", "A lattice test proved it."])).toMatchObject({ match: true, by: "sentences" });
    expect(checkLine(line, "Then the test surprised me. A lattice test proved it.", ["Then the test surprised me.", "A lattice test proved it."]).match).toBe(false);
    expect(checkLine(line, line)).toMatchObject({ match: true, by: "line" });
  });
});

/** A voice timing for every part: each line inside its planned window, sentences in order. */
const timingArbitrary = fc
  .array(fc.tuple(fc.double({ min: 0, max: 0.3, noNaN: true }), fc.double({ min: 0.55, max: 0.95, noNaN: true }), fc.double({ min: 0.05, max: 0.3, noNaN: true })), {
    minLength: PARTS.length,
    maxLength: PARTS.length,
  })
  .map((shapes) =>
    PARTS.map((part, index): LineTiming => {
      const [lead, share, pause] = shapes[index]!;
      const window = part.end - part.start;
      const start = part.start + lead * 0.3;
      const end = start + window * share * 0.95;
      const count = splitSentences(part.text).length;
      const step = (end - start) / count;
      const sentences = Array.from({ length: count }, (_, k) => ({ start: start + k * step + (k === 0 ? 0 : pause * step * 0.5), end: start + (k + 1) * step }));
      return { start, end, sentences };
    }),
  );

describe("Property 8: captions follow the voice and keep the narration", () => {
  it("holds for any voice timing of the 26 lines", () => {
    fc.assert(
      fc.property(timingArbitrary, (timing) => {
        const cues = cuesForTimedParts(SCENES, timing);
        expect(cues.map((cue) => cue.lines.join(" ")).join(" ")).toBe(normalise(PARTS.map((part) => part.text).join(" ")));
        for (let index = 1; index < cues.length; index += 1) expect(cues[index]!.start).toBeGreaterThanOrEqual(cues[index - 1]!.end - 1e-9);
        for (const cue of cues) expect(cue.end).toBeGreaterThan(cue.start);
        // Each line's first cue starts where its speech does, and its last ends at most CAPTION_HOLD after.
        let at = 0;
        timing.forEach((line, index) => {
          const count = cuesForTimedParts([{ parts: [PARTS[index]!] }], [line]).length;
          const mine = cues.slice(at, at + count);
          at += count;
          expect(mine[0]!.start).toBeCloseTo(line.start, 9);
          expect(mine[mine.length - 1]!.end).toBeLessThanOrEqual(line.end + CAPTION_HOLD + 1e-9);
        });
      }),
      { numRuns: 50 },
    );
  });

  it("keeps the planned windows until there is a voice timing for every line", () => {
    expect(cuesForTimedParts(SCENES, [])).toEqual(cuesForTimedParts(SCENES, VOICE_TIMING.slice(0, 3)));
  });
});

describe("Property 9: the Vertical_Cut holds the chosen lines in 45 s", () => {
  it("holds for any voice timing whose chosen lines fit", () => {
    fc.assert(
      fc.property(timingArbitrary, (timing) => {
        const lines: Span[] = timing.map((line) => ({ from: line.start, to: line.end }));
        const parts = verticalParts(lines, DURATION);
        for (let index = 1; index < parts.length; index += 1) expect(parts[index]!.from).toBeGreaterThanOrEqual(parts[index - 1]!.to);
        for (const number of VERTICAL_LINES) {
          const line = lines[number - 1]!;
          expect(parts.some((part) => part.from <= line.from && part.to >= line.to)).toBe(true);
        }
        // The least the cut could be: each chosen line with its lead and tail, merged as close lines are.
        const least = VERTICAL_LINES.reduce((sum, number) => sum + Math.min(lines[number - 1]!.to - lines[number - 1]!.from + VERTICAL_LEAD + VERTICAL_TAIL, Infinity), 0);
        const total = parts.reduce((sum, part) => sum + (part.to - part.from), 0);
        if (least <= VERTICAL_MAX - MERGE_GAP * VERTICAL_LINES.length) expect(total).toBeLessThanOrEqual(VERTICAL_MAX + 1e-6);
      }),
      { numRuns: 100 },
    );
  });

  it("is 45 s or less with the real voice timing, ending on the end card", () => {
    const total = VERTICAL_PARTS.reduce((sum, part) => sum + (part.to - part.from), 0);
    expect(total).toBeLessThanOrEqual(VERTICAL_MAX);
    expect(VERTICAL_PARTS[VERTICAL_PARTS.length - 1]!.to).toBe(DURATION);
    expect(NARRATION_CREDIT).toBe("Narration: synthetic voice (Kokoro-82M)");
  });
});
