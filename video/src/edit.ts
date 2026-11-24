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
