// Synthetic narration (demo-video Requirement 9): the overrides, the speed, the transcript check,
// the captions timed to the voice. Properties 7 and 8 (Property 9, the Vertical_Cut, is in
// vertical.property.test.ts). No speech model runs here.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { CAPTION_HOLD, cuesForTimedParts, normalise, splitSentences } from "../src/cues.ts";
import { SCENES } from "../src/script.ts";
import { FILL_MAX, FILL_MIN, FILL_TARGET, MAX_SPEED, MIN_SPEED, checkLine, checkTranscript, chooseSpeed, fills, heardWords, retryTakes, speechSentences } from "../src/tts.ts";
import { VOICE_TIMING } from "../src/voice-timing.ts";
import { timingArbitrary } from "./timing.ts";

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

describe("Property 7: the speed stays in range and aims each line at 88 % of its window", () => {
  it("holds for any speech length, window and current speed", () => {
    fc.assert(
      fc.property(fc.double({ min: 0.5, max: 20, noNaN: true }), fc.double({ min: 0.5, max: 20, noNaN: true }), fc.double({ min: MIN_SPEED, max: MAX_SPEED, noNaN: true }), (speech, window, current) => {
        const speed = chooseSpeed(speech, window, current);
        expect(speed).toBeGreaterThanOrEqual(MIN_SPEED);
        expect(speed).toBeLessThanOrEqual(MAX_SPEED);
        // A take that fills 85 to 95 % keeps its speed (to the rounding of 0.001).
        if (fills(speech, window)) expect(Math.abs(speed - current)).toBeLessThanOrEqual(0.0005);
        else {
          // If speech time goes as 1 / speed, the next take fills 88 %, or is as close as the range allows.
          const predicted = (speech * current) / speed / window;
          if (speed > MIN_SPEED && speed < MAX_SPEED) expect(Math.abs(predicted - FILL_TARGET)).toBeLessThan(0.002);
          if (speed === MIN_SPEED) expect(predicted).toBeLessThanOrEqual(FILL_TARGET + 0.002);
          if (speed === MAX_SPEED) expect(predicted).toBeGreaterThanOrEqual(FILL_TARGET - 0.002);
        }
      }),
    );
  });

  it("calls 85 to 95 % filled, and nothing else", () => {
    expect([0.84, FILL_MIN, 0.9, FILL_MAX, 0.96].map((fill) => fills(fill * 10, 10))).toEqual([false, true, true, true, false]);
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
