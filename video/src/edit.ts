// The edit of the live-site capture (demo-video design, "Remotion"): which part of
// public/capture/live.mp4 plays under each part of the Solution narration. Times in seconds; Main
// time on the left, capture time on the right (from beats.json of the run that made the footage).
// A segment with no `to` holds one frame. The app's own sound plays only where `audio` is true;
// those segments run at normal speed so the sound keeps its pitch.

export interface Segment {
  readonly at: number;
  readonly until: number;
  readonly from: number;
  readonly to?: number;
  readonly audio?: boolean;
}

export const SOLUTION_EDIT: readonly Segment[] = [
  // "So I built JACQUARD…" over the Opening line.
  { at: 21, until: 26.7, from: 0.2, to: 5.0 },
  // "This is the live site." Design, before typing.
  { at: 26.7, until: 31.6, from: 5.0 },
  // "I describe a peacock…" typing.
  { at: 31.6, until: 35.0, from: 5.0, to: 8.45 },
  // "…shows what it understood as chips I can change," then on to Generate.
  { at: 35.0, until: 39.4, from: 9.0 },
  { at: 39.4, until: 42.2, from: 9.0, to: 11.36 },
  // "and draws it on point paper. It is a builder, not AI."
  { at: 42.2, until: 48.1, from: 11.36, to: 16.8 },
  // "The check marks every float over the loom profile's limit."
  { at: 48.1, until: 52.9, from: 16.8, to: 20.7 },
  // "Auto-fix changes only the lift plan…"
  { at: 52.9, until: 59.2, from: 20.7, to: 25.0 },
  // The loom weaving, with the app's sound.
  { at: 59.2, until: 70.4, from: 25.0, to: 36.2, audio: true },
  // "The Cloth view shows the peacocks repeated across the width."
  { at: 70.4, until: 75.8, from: 40.4, to: 45.8, audio: true },
  // "Last, the cards…": the chain, Print, the WIF download.
  { at: 75.8, until: 86, from: 47.6, to: 59.6 },
];

/** Parts of the Main_Cut used by the Vertical_Cut, in order (demo-video Decision log). */
export const VERTICAL_PARTS: readonly { readonly from: number; readonly to: number }[] = [
  { from: 0, to: 6 },
  { from: 29.2, to: 45.2 },
  { from: 66.5, to: 75.2 },
  { from: 152, to: 160.6 },
];

export const VERTICAL_DURATION = VERTICAL_PARTS.reduce((sum, part) => sum + (part.to - part.from), 0);
