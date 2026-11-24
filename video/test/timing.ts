// A fast-check generator of voice timings for the 26 narration lines, shared by the caption and
// Vertical_Cut properties: each line inside its planned window, its sentences in order, and for
// line 07 the words "and draws" where the transcriber would put them.
import fc from "fast-check";
import { splitSentences } from "../src/cues.ts";
import type { LineTiming } from "../src/cues.ts";
import { SCENES } from "../src/script.ts";

export const PARTS = SCENES.flatMap((scene) => scene.parts);

export const timingArbitrary = fc
  .array(fc.tuple(fc.double({ min: 0, max: 0.3, noNaN: true }), fc.double({ min: 0.55, max: 0.95, noNaN: true }), fc.double({ min: 0.05, max: 0.3, noNaN: true }), fc.double({ min: 0.4, max: 0.85, noNaN: true })), {
    minLength: PARTS.length,
    maxLength: PARTS.length,
  })
  .map((shapes) =>
    PARTS.map((part, index): LineTiming => {
      const [lead, share, pause, draws] = shapes[index]!;
      const window = part.end - part.start;
      const start = part.start + lead * 0.3;
      const end = start + window * share * 0.95;
      const count = splitSentences(part.text).length;
      const step = (end - start) / count;
      const sentences = Array.from({ length: count }, (_, k) => ({ start: start + k * step + (k === 0 ? 0 : pause * step * 0.5), end: start + (k + 1) * step }));
      const at = start + (end - start) * draws;
      const words = index === 6 ? [{ word: "change,", start: at - 0.6, end: at - 0.3 }, { word: "and", start: at - 0.15, end: at }, { word: "draws", start: at, end: at + 0.3 }] : undefined;
      return words === undefined ? { start, end, sentences } : { start, end, sentences, words };
    }),
  );
