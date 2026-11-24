// The Vertical_Cut's plan (demo-video 9.9, Tushar's final review): which voice lines, which crop
// of which picture under each, and where the captions go. Pure, so it is tested on its own; the
// component is src/vertical-cut.tsx. Times: "main" is seconds in the Main_Cut, "at" is seconds in
// the Vertical_Cut, "capture" is seconds in public/capture/live.mp4.
import { cuesForTimedParts } from "./cues.ts";
import type { Cue, LineTiming } from "./cues.ts";
import { DURATION, SCENES } from "./script.ts";
import { VOICE_TIMING } from "./voice-timing.ts";

export const WIDTH = 1080;
export const HEIGHT = 1920;
export const MAX_SECONDS = 44.9;
/** Narration lines in the Vertical_Cut, in order: the problem, the peacock, the weave, the close. */
export const LINES: readonly number[] = [1, 3, 4, 6, 7, 11, 12, 26];
/** Seconds kept before a line's speech and after it (the pause between two lines is their sum). */
export const LEAD = 0.1;
export const TAIL = 0.15;
/** Captions: at least 56 px, lines of at most 26 characters, in the lower third. */
export const CAPTION_SIZE = 58;
export const CAPTION_LINE = 26;
export const CAPTION_BOTTOM = 390;
/** Where the picture goes: the full width, under the wordmark, above the captions. */
export const ZONE = { x: 0, y: 230, w: WIDTH, h: 1080 } as const;

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** A crop of a 1920x1080 picture, scaled to `width` (default the full width) and placed `top` px into the zone. */
export interface Crop {
  readonly crop: Rect;
  readonly top: number;
  readonly width?: number;
}

/** A stretch of the capture: from `capture` seconds, playing until `until` (then holding), or holding when `until` is absent. */
export interface CaptureRun {
  readonly from: number;
  readonly until?: number;
}

export type Look =
  | { readonly kind: "main"; readonly crops: readonly Crop[] }
  | { readonly kind: "capture"; readonly crops: readonly Crop[]; readonly runs: readonly { readonly main: number; readonly run: CaptureRun }[]; readonly sound?: boolean }
  | { readonly kind: "end" };

export interface Shot {
  readonly line: number;
  /** Main_Cut seconds this shot covers (its sound and captions come from there). */
  readonly from: number;
  readonly to: number;
  /** Vertical_Cut seconds where it starts. */
  readonly at: number;
  readonly look: Look;
}

const paper: Crop = { crop: { x: 120, y: 70, w: 760, h: 760 }, top: 0 };
const describe: Crop = { crop: { x: 140, y: 620, w: 400, h: 400 }, top: 0 };
const pointPaper: Crop = { crop: { x: 560, y: 64, w: 870, h: 780 }, top: 56 };
const loom: Crop = { crop: { x: 330, y: 205, w: 780, h: 600 }, top: 124 };
const cloth: Crop = { crop: { x: 200, y: 250, w: 1180, h: 560 }, top: 284 };

/**
 * The shots for the chosen lines, given where each line is spoken. Line 07 cuts from the chips to
 * the drawn peacock just before "and draws it on point paper"; line 06 holds the empty Describe
 * box for "This is the live site." and types with the second sentence. The last line holds the end
 * card for whatever is left of MAX_SECONDS.
 */
export function verticalShots(timing: readonly LineTiming[], duration: number = DURATION): Shot[] {
  const line = (number: number) => timing[number - 1]!;
  const spans = LINES.map((number) => ({ number, from: Math.max(0, line(number).start - LEAD), to: Math.min(duration, line(number).end + TAIL) }));
  const used = spans.slice(0, -1).reduce((sum, span) => sum + (span.to - span.from), 0);
  const last = spans[spans.length - 1]!;
  last.to = Math.min(duration, Math.max(last.to, last.from + (MAX_SECONDS - used)));
  // Time still left (the Main_Cut ends soon after the last line): the end card comes up earlier,
  // in the silence after the line before, never over its speech.
  const before = timing[LINES[LINES.length - 1]! - 2];
  const spare = MAX_SECONDS - used - (last.to - last.from);
  if (spare > 0 && before !== undefined) last.from = Math.max(before.end + TAIL, last.from - spare);

  const shots: Shot[] = [];
  let at = 0;
  const push = (number: number, from: number, to: number, look: Look) => {
    shots.push({ line: number, from, to, at, look });
    at += to - from;
  };
  for (const span of spans) {
    const timed = line(span.number);
    switch (span.number) {
      case 1:
        push(1, span.from, span.to, { kind: "main", crops: [{ crop: { x: 420, y: 20, w: 1080, h: 1060 }, top: 0 }] });
        break;
      case 3:
        push(3, span.from, span.to, { kind: "main", crops: [paper] });
        break;
      case 4:
        push(4, span.from, span.to, {
          kind: "main",
          crops: [
            { crop: { x: 120, y: 170, w: 760, h: 360 }, top: 0 },
            { crop: { x: 980, y: 240, w: 820, h: 400 }, top: 530 },
          ],
        });
        break;
      case 6: {
        const second = timed.sentences[1]?.start ?? span.from;
        push(6, span.from, span.to, { kind: "capture", crops: [describe], runs: [{ main: span.from, run: { from: 5.0 } }, { main: second, run: { from: 5.0, until: 8.45 } }] });
        break;
      }
      case 7: {
        const cut = cutBefore(timed, "draws", span.from + (span.to - span.from) * 0.7);
        push(7, span.from, cut, { kind: "capture", crops: [describe], runs: [{ main: span.from, run: { from: 9.6 } }] });
        push(7, cut, span.to, { kind: "capture", crops: [pointPaper], runs: [{ main: cut, run: { from: 13.2 } }] });
        break;
      }
      case 11:
        // From 27.2 s of the capture: before that the 3D loom is still loading (a blank canvas).
        push(11, span.from, span.to, { kind: "capture", crops: [loom], runs: [{ main: span.from, run: { from: 27.2, until: 27.2 + (span.to - span.from) } }], sound: true });
        break;
      case 12:
        push(12, span.from, span.to, { kind: "capture", crops: [cloth], runs: [{ main: span.from, run: { from: 41.0, until: 41.0 + (span.to - span.from) } }] });
        break;
      default:
        push(span.number, span.from, span.to, { kind: "end" });
    }
  }
  return shots;
}

/**
 * Main_Cut time to cut to the next picture before `word` is said: 0.12 s before the start of the
 * word heard before it ("and" before "draws"), or `fallback` when the words are not known.
 */
export function cutBefore(timing: LineTiming, word: string, fallback: number): number {
  const words = timing.words ?? [];
  const index = words.findIndex((item) => item.word.toLowerCase().replace(/[^a-z]/g, "") === word);
  if (index === -1) return fallback;
  const before = words[Math.max(0, index - 1)]!;
  return Math.max(timing.start, (index > 0 ? before.start : words[index]!.start) - 0.12);
}

export const duration = (shots: readonly Shot[]): number => shots.reduce((sum, shot) => sum + (shot.to - shot.from), 0);

/** Captions for the Vertical_Cut: the Main_Cut's timed cues, split for the phone, moved to each shot. */
export function verticalCues(shots: readonly Shot[], timing: readonly LineTiming[]): Cue[] {
  const cues = cuesForTimedParts(SCENES, timing, { maxLine: CAPTION_LINE });
  return shots.flatMap((shot) =>
    cues
      .filter((cue) => cue.end > shot.from && cue.start < shot.to)
      .map((cue) => ({ start: Math.max(cue.start, shot.from) - shot.from + shot.at, end: Math.min(cue.end, shot.to) - shot.from + shot.at, lines: cue.lines })),
  );
}

/** Voice windows in Vertical_Cut time (the score is ducked under them). */
export function verticalWindows(shots: readonly Shot[], timing: readonly LineTiming[]): { start: number; end: number }[] {
  return shots.flatMap((shot) => {
    const line = timing[shot.line - 1]!;
    const start = Math.max(line.start, shot.from);
    const end = Math.min(line.end, shot.to);
    return end > start ? [{ start: start - shot.from + shot.at, end: end - shot.from + shot.at }] : [];
  });
}

const PLANNED: readonly LineTiming[] = SCENES.flatMap((scene) => scene.parts.map((part) => ({ start: part.start, end: part.end, sentences: [{ start: part.start, end: part.end }] })));
/** The voice timing when there is one for every line, else the planned windows. */
export const TIMING: readonly LineTiming[] = VOICE_TIMING.length === PLANNED.length ? VOICE_TIMING : PLANNED;
export const SHOTS: readonly Shot[] = verticalShots(TIMING);
export const VERTICAL_SECONDS = duration(SHOTS);
export const VERTICAL_CUES: readonly Cue[] = verticalCues(SHOTS, TIMING);
export const VERTICAL_WINDOWS = verticalWindows(SHOTS, TIMING);
