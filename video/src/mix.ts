// Music level under the narration (demo-video 5.3). The score stem is normalised to
// SCORE_REF_LUFS when it is rendered; musicGainDb is the gain applied to it in the mix. Under
// narration the score sits at least 18 dB below the voice; in gaps it may come up.

export const VOICE_LUFS = -16;
export const SCORE_REF_LUFS = -16;
/** Under narration: 18 dB below the voice, plus a 2 dB margin [decision]. */
export const UNDER_VOICE_DB = VOICE_LUFS - 18 - SCORE_REF_LUFS - 2;
/** Between narration windows [decision]. */
export const GAP_DB = -10;
/** Ramp length in seconds on each side of a narration window. */
export const RAMP = 0.4;

export interface Window {
  readonly start: number;
  readonly end: number;
}

/** Gain in dB for the score at time t (seconds). */
export function musicGainDb(t: number, windows: readonly Window[]): number {
  let gain = GAP_DB;
  for (const window of windows) {
    if (t >= window.start && t <= window.end) return UNDER_VOICE_DB;
    // Ramps reach full ducking at the window edge, so the voice never starts over loud music.
    const distance = t < window.start ? window.start - t : t - window.end;
    if (distance < RAMP) {
      const ducked = UNDER_VOICE_DB + ((GAP_DB - UNDER_VOICE_DB) * distance) / RAMP;
      gain = Math.min(gain, ducked);
    }
  }
  return gain;
}

export function dbToGain(db: number): number {
  return Math.pow(10, db / 20);
}
