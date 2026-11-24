// Script_Data checks (demo-video 2.1 to 2.5, 7.1, and Tushar's first review): four scenes in order,
// contiguous, under 2:50; every narration part fits its window at 140 words a minute; parts are in
// order inside their scene; captions come from the same text; the close says what product.md
// requires and does not repeat "builder, not AI"; no figure from a weaver's own page.
import { describe, expect, it } from "vitest";
import { cuesForParts, normalise } from "../src/cues.ts";
import { DURATION, SCENES, secondsFor, wordCount } from "../src/script.ts";

describe("Script_Data", () => {
  it("has the four scenes in order, contiguous, under 2:50", () => {
    expect(SCENES.map((scene) => scene.id)).toEqual(["problem", "solution", "kiro", "close"]);
    expect(SCENES[0]!.start).toBe(0);
    for (let index = 1; index < SCENES.length; index += 1) expect(SCENES[index]!.start).toBe(SCENES[index - 1]!.end);
    expect(DURATION).toBeLessThan(170);
  });
  it("fits each part in its window at 140 words a minute, in order inside its scene", () => {
    for (const scene of SCENES) {
      let last = scene.start;
      for (const part of scene.parts) {
        expect(secondsFor(part.text), part.text).toBeLessThanOrEqual(part.end - part.start + 0.001);
        expect(part.start, part.text).toBeGreaterThanOrEqual(last);
        last = part.end;
      }
      expect(last).toBeLessThanOrEqual(scene.end);
    }
  });
  it("keeps the Kiro narration near 135 words", () => {
    expect(wordCount(SCENES[2]!.narration)).toBeLessThanOrEqual(140);
  });
  it("makes captions from the narration itself", () => {
    const cues = cuesForParts(SCENES);
    expect(cues.map((cue) => cue.lines.join(" ")).join(" ")).toBe(normalise(SCENES.map((scene) => scene.narration).join(" ")));
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
  it("opens and closes as product.md asks, without repeating the builder line", () => {
    expect(SCENES[0]!.narration.startsWith("Punch cards are dead as a computing medium.")).toBe(true);
    expect(SCENES[0]!.narration.endsWith("JACQUARD catches it on point paper, before a single card is punched.")).toBe(true);
    const close = SCENES[3]!.narration;
    expect(close).toContain("not yet tested on a working loom");
    expect(close).toContain("configurable profile");
    expect(close).toContain("open source");
    expect(close).toContain("Built with Kiro");
    expect(close).not.toContain("builder, not AI");
    expect(SCENES[1]!.narration).toContain("builder, not AI");
  });
  it("never says the tool replaces anyone, that it was tested on a loom, or the 42,000-card figure", () => {
    const all = SCENES.map((scene) => `${scene.narration} ${scene.beats.map((beat) => beat.note).join(" ")} ${scene.claims.map((claim) => claim.text).join(" ")}`).join(" ");
    expect(all).not.toMatch(/replace|tested on a loom|loom-tested|loom-ready|42[,.]?000/i);
  });
});
