// The edit of the live-site capture (demo-video design, "Remotion"): which part of
// public/capture/live.mp4 plays under each part of the Solution narration. Times in seconds; Main
// time on the left, capture time on the right (from beats.json of the run that made the footage).
// A segment with no `to` holds one frame. The app's own sound plays only where `audio` is true;
// those segments run at normal speed so the sound keeps its pitch.
import { DURATION, SCENES } from "./script.ts";
import { VOICE_TIMING } from "./voice-timing.ts";

export interface Segment {
  readonly at: number;
  readonly until: number;
  readonly from: number;
  readonly to?: number;
  readonly audio?: boolean;
}

export const SOLUTION_EDIT: readonly Segment[] = [
  // "So I built JACQUARD…" over the Opening line.
  { at: 27.4, until: 32.5, from: 0.2, to: 5.0 },
  // "This is the live site." Design, before typing.
  { at: 32.5, until: 36.4, from: 5.0 },
  // "I describe a peacock…" typing.
  { at: 36.4, until: 39.9, from: 5.0, to: 8.45 },
  // "The motif builder reads my words, shows what it understood as chips", then on to Generate.
  { at: 39.9, until: 44.0, from: 9.0 },
  { at: 44.0, until: 46.4, from: 9.0, to: 11.36 },
  // "…and draws it on point paper. It is a builder, not AI."
  { at: 46.4, until: 52.0, from: 11.36, to: 16.8 },
  // "The check marks every float over the loom profile's limit."
  { at: 52.0, until: 56.3, from: 16.8, to: 20.7 },
  // "Auto-fix changes only the lift plan…"
  { at: 56.3, until: 62.0, from: 20.7, to: 25.0 },
  // The loom weaving, with the app's sound.
  { at: 62.0, until: 72.0, from: 25.0, to: 35.0, audio: true },
  // "The Cloth view shows the peacocks repeated across the width."
  { at: 72.0, until: 76.4, from: 40.4, to: 44.8, audio: true },
  // "Last, the cards…": the chain, Print, the WIF download.
  { at: 76.4, until: 86, from: 47.6, to: 59.6 },
];

/** Narration lines in the Vertical_Cut (demo-video 9.9): the problem, the peacock, the weave, the close. */
export const VERTICAL_LINES: readonly number[] = [1, 3, 4, 6, 7, 11, 12, 26];
export const VERTICAL_MAX = 45;
/** Seconds kept before a line's speech and after it; lines closer than MERGE_GAP stay one part. */
export const VERTICAL_LEAD = 0.25;
export const VERTICAL_TAIL = 0.4;
export const MERGE_GAP = 0.8;

export interface Span {
  readonly from: number;
  readonly to: number;
}

/**
 * Parts of the Main_Cut used by the Vertical_Cut, in order: each chosen line's speech (from the
 * voice timing, or its planned window) with a short lead and tail, lines close together kept as
 * one part, and the last part held longer (to the end of the Main_Cut, then earlier onto the end card
 * but not into the line before) so the end card (live URL, narration
 * credit) stays on screen, as long as the cut stays within VERTICAL_MAX.
 */
export function verticalParts(lines: readonly Span[], duration: number, chosen: readonly number[] = VERTICAL_LINES): Span[] {
  const parts: { from: number; to: number }[] = [];
  for (const number of chosen) {
    const line = lines[number - 1];
    if (line === undefined) continue;
    const from = Math.max(0, line.from - VERTICAL_LEAD);
    const to = Math.min(duration, line.to + VERTICAL_TAIL);
    const last = parts[parts.length - 1];
    if (last !== undefined && from - last.to < MERGE_GAP) last.to = to;
    else parts.push({ from, to });
  }
  const end = parts[parts.length - 1];
  if (end !== undefined) {
    const spare = (): number => VERTICAL_MAX - parts.reduce((sum, part) => sum + (part.to - part.from), 0);
    end.to = Math.min(duration, end.to + Math.max(0, spare()));
    // Then earlier, onto the end card before the last line, but not into the line before it.
    const lastLine = chosen[chosen.length - 1]!;
    const before = chosen.includes(lastLine - 1) ? undefined : lines[lastLine - 2];
    const previous = parts[parts.length - 2];
    const floor = Math.max(before === undefined ? end.from : before.to + 0.1, previous === undefined ? 0 : previous.to);
    end.from = Math.min(end.from, Math.max(floor, end.from - Math.max(0, spare())));
  }
  return parts.map((part) => ({ from: Math.round(part.from * 1000) / 1000, to: Math.round(part.to * 1000) / 1000 }));
}

const PLANNED: readonly Span[] = SCENES.flatMap((scene) => scene.parts.map((part) => ({ from: part.start, to: part.end })));
const TIMED: readonly Span[] = VOICE_TIMING.length === PLANNED.length ? VOICE_TIMING.map((line) => ({ from: line.start, to: line.end })) : PLANNED;

/** Parts of the Main_Cut used by the Vertical_Cut, in order. */
export const VERTICAL_PARTS: readonly Span[] = verticalParts(TIMED, DURATION);
export const VERTICAL_DURATION = VERTICAL_PARTS.reduce((sum, part) => sum + (part.to - part.from), 0);
