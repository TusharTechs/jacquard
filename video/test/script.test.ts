// Script_Data checks (demo-video 2.1 to 2.5, 7.1): four scenes in order, contiguous, under 2:50;
// each narration fits its voice window at 140 words a minute; captions come from the same text;
// the close says what product.md requires; no claim without a label.
import { describe, expect, it } from "vitest";
import { cuesFor, normalise } from "../src/cues.ts";
import { DURATION, SCENES, WORDS_PER_MINUTE, wordCount } from "../src/script.ts";

describe("Script_Data", () => {
  it("has the four scenes in order, contiguous, under 2:50", () => {
    expect(SCENES.map((scene) => scene.id)).toEqual(["problem", "solution", "kiro", "close"]);
    expect(SCENES[0]!.start).toBe(0);
    for (let index = 1; index < SCENES.length; index += 1) expect(SCENES[index]!.start).toBe(SCENES[index - 1]!.end);
    expect(DURATION).toBeLessThan(170);
  });
  it("fits each narration in its voice window at 140 words a minute", () => {
    for (const scene of SCENES) {
      const seconds = (wordCount(scene.narration) / WORDS_PER_MINUTE) * 60;
      expect(seconds, scene.id).toBeLessThanOrEqual(scene.voice.end - scene.voice.start + 0.05);
      expect(scene.voice.start).toBeGreaterThanOrEqual(scene.start);
      expect(scene.voice.end).toBeLessThanOrEqual(scene.end);
    }
  });
  it("makes captions from the narration itself", () => {
    for (const scene of SCENES) {
      const cues = cuesFor(scene.narration, scene.voice.start, scene.voice.end);
      expect(cues.map((cue) => cue.lines.join(" ")).join(" ")).toBe(normalise(scene.narration));
    }
  });
  it("labels every claim and keeps beats inside their scene", () => {
    for (const scene of SCENES) {
      for (const claim of scene.claims) expect(claim.label.length * claim.source.length).toBeGreaterThan(0);
      for (const beat of scene.beats) {
        expect(beat.at).toBeGreaterThanOrEqual(scene.start);
        expect(beat.until).toBeLessThanOrEqual(scene.end);
      }
    }
  });
  it("closes honestly (product.md framing rules)", () => {
    const close = SCENES[3]!.narration;
    expect(close).toContain("not yet tested on a working loom");
    expect(close).toContain("configurable profile");
    expect(close).toContain("builder, not AI");
    expect(close).toContain("Built with Kiro");
    expect(SCENES[0]!.narration.startsWith("Punch cards are dead as a computing medium.")).toBe(true);
  });
  it("never says the tool replaces anyone, or that it was tested on a loom", () => {
    const all = SCENES.map((scene) => scene.narration).join(" ");
    expect(all).not.toMatch(/replace|tested on a loom|loom-tested|loom-ready/i);
  });
});
