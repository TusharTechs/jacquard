// Voice assembly (demo-video Requirement 8), the pure part: one recorded line per narration part,
// numbered 01 to the last in order through the video. Each line's silence is trimmed, the line is
// fitted to its part's window (at most 5 % faster, pitch kept, or it fails), normalised, and placed
// so its speech starts at the part's start. The ffmpeg steps (decode, time-stretch, loudness) are
// passed in by scripts/voice.ts, so this module has no Node imports and is tested with tones.
import { SCENES, WORDS_PER_MINUTE, secondsFor, wordCount } from "./script.ts";
import type { Scene, SceneId } from "./script.ts";

/** Sample rate of every decoded line and of public/audio/voice.wav. */
export const VOICE_RATE = 48000;
/** A line may be sped up by at most this factor, pitch kept (Requirement 8.4). */
export const MAX_STRETCH = 1.05;
/** Seconds of the recording kept before and after the speech, so no word edge is cut. */
export const PAD_SECONDS = 0.15;
/** Analysis frame for silence trimming, seconds. */
export const FRAME_SECONDS = 0.01;

export interface VoiceLine {
  /** 1 to the number of parts, in order through the whole video. */
  readonly number: number;
  /** "01", "02", … */
  readonly name: string;
  /** "01.wav", … in video/voice/lines. */
  readonly file: string;
  readonly sceneId: SceneId;
  readonly text: string;
  readonly start: number;
  readonly end: number;
  /** end − start, seconds: the longest the speech may last. */
  readonly window: number;
}

export function lineName(number: number): string {
  return String(number).padStart(2, "0");
}

export function voiceLines(scenes: readonly Scene[] = SCENES): VoiceLine[] {
  const lines: VoiceLine[] = [];
  for (const scene of scenes) {
    for (const part of scene.parts) {
      const number = lines.length + 1;
      const name = lineName(number);
      lines.push({ number, name, file: `${name}.wav`, sceneId: scene.id, text: part.text, start: part.start, end: part.end, window: part.end - part.start });
    }
  }
  return lines;
}

/** Which expected files are missing from a folder listing, and which .wav files are not expected. */
export function checkLineFiles(files: readonly string[], lines: readonly VoiceLine[]): { readonly missing: string[]; readonly unexpected: string[] } {
  const present = new Set(files.filter((file) => file.toLowerCase().endsWith(".wav")));
  const expected = new Set(lines.map((line) => line.file));
  return {
    missing: lines.filter((line) => !present.has(line.file)).map((line) => line.name),
    unexpected: [...present].filter((file) => !expected.has(file)).sort(),
  };
}

function frameDb(samples: Float32Array, from: number, to: number): number {
  let sum = 0;
  for (let index = from; index < to; index += 1) sum += samples[index]! * samples[index]!;
  const rms = Math.sqrt(sum / Math.max(1, to - from));
  return rms > 0 ? 20 * Math.log10(rms) : -200;
}

/**
 * Sample range [start, end) of the speech in a mono recording, or null if it is all silence.
 * A frame is speech when its RMS is above the threshold: the noise floor + 10 dB (the floor is the
 * 10th percentile frame), but never more than the loudest frame − 30 dB, so a recording with little
 * or no silence is not cut into; and never less than the loudest frame − 50 dB. The bounds are
 * whole frames, so the first and last speech frames are kept entire; PAD_SECONDS more is kept
 * around them when the line is cut.
 */
export function trimBounds(samples: Float32Array, rate: number = VOICE_RATE): { readonly start: number; readonly end: number } | null {
  const frame = Math.max(1, Math.round(FRAME_SECONDS * rate));
  const count = Math.ceil(samples.length / frame);
  if (count === 0) return null;
  const levels: number[] = [];
  for (let index = 0; index < count; index += 1) levels.push(frameDb(samples, index * frame, Math.min(samples.length, (index + 1) * frame)));
  const loudest = Math.max(...levels);
  if (loudest <= -120) return null;
  const sorted = [...levels].sort((a, b) => a - b);
  const floor = sorted[Math.floor(sorted.length * 0.1)]!;
  const threshold = Math.max(Math.min(floor + 10, loudest - 30), loudest - 50);
  const first = levels.findIndex((level) => level > threshold);
  if (first === -1) return null;
  let last = first;
  for (let index = levels.length - 1; index >= first; index -= 1) {
    if (levels[index]! > threshold) {
      last = index;
      break;
    }
  }
  return { start: first * frame, end: Math.min(samples.length, (last + 1) * frame) };
}

export type Fit =
  | { readonly kind: "fits"; readonly tempo: 1 }
  | { readonly kind: "stretch"; readonly tempo: number }
  | { readonly kind: "overrun"; readonly tempo: number };

/** How a line with `speech` seconds of speech fits a `window` (Requirement 8.4, Property 4). */
export function planFit(speech: number, window: number): Fit {
  if (speech <= window + 1e-9) return { kind: "fits", tempo: 1 };
  const tempo = speech / window;
  if (tempo <= MAX_STRETCH + 1e-9) return { kind: "stretch", tempo };
  return { kind: "overrun", tempo };
}

export interface Overrun {
  readonly line: VoiceLine;
  readonly speech: number;
}

/** The failure message: every line that does not fit even at 5 % faster. */
export function overrunReport(overruns: readonly Overrun[]): string {
  const rows = overruns.map(
    ({ line, speech }) =>
      `  ${line.name}: ${speech.toFixed(2)} s of speech, window ${line.window.toFixed(2)} s (fits up to ${(line.window * MAX_STRETCH).toFixed(2)} s): "${line.text}"`,
  );
  return [`${overruns.length} line${overruns.length === 1 ? "" : "s"} too long for ${overruns.length === 1 ? "its window" : "their windows"}, even ${Math.round((MAX_STRETCH - 1) * 100)} % faster. Re-record ${overruns.length === 1 ? "it" : "them"} a little quicker:`, ...rows].join("\n");
}

export interface Processors {
  /** Speed up by `tempo` (> 1) without changing pitch; returns the new samples. */
  readonly stretch: (samples: Float32Array, tempo: number) => Float32Array;
  /** Bring the line to the voice loudness target; returns the new samples. */
  readonly normalise: (samples: Float32Array) => Float32Array;
}

export interface Placed {
  readonly line: VoiceLine;
  readonly speech: number;
  readonly tempo: number;
  /** Seconds from the start of the video where the speech starts (the part's start). */
  readonly at: number;
}

export type Assembly =
  | { readonly ok: true; readonly track: Float32Array; readonly placed: readonly Placed[] }
  | { readonly ok: false; readonly overruns: readonly Overrun[]; readonly message: string };

/**
 * Trims, fits, normalises and places every line (Property 6). Nothing is written when any line
 * overruns; the result lists them all. `inputs` are mono at VOICE_RATE, one per line, in order.
 */
export function assembleVoice(inputs: readonly { readonly line: VoiceLine; readonly samples: Float32Array }[], processors: Processors, duration: number): Assembly {
  const rate = VOICE_RATE;
  const pad = Math.round(PAD_SECONDS * rate);
  const planned: { line: VoiceLine; clip: Float32Array; lead: number; speech: number; fit: Fit }[] = [];
  const overruns: Overrun[] = [];
  for (const { line, samples } of inputs) {
    const bounds = trimBounds(samples, rate);
    if (bounds === null) {
      overruns.push({ line, speech: 0 });
      continue;
    }
    const from = Math.max(0, bounds.start - pad);
    const to = Math.min(samples.length, bounds.end + pad);
    const speech = (bounds.end - bounds.start) / rate;
    const fit = planFit(speech, line.window);
    if (fit.kind === "overrun") overruns.push({ line, speech });
    planned.push({ line, clip: samples.slice(from, to), lead: bounds.start - from, speech, fit });
  }
  const silent = overruns.filter((item) => item.speech === 0);
  if (silent.length > 0) return { ok: false, overruns: silent, message: `Silent recording${silent.length === 1 ? "" : "s"}: ${silent.map((item) => item.line.name).join(", ")}. Re-record ${silent.length === 1 ? "it" : "them"}.` };
  if (overruns.length > 0) return { ok: false, overruns, message: overrunReport(overruns) };

  const track = new Float32Array(Math.round(duration * rate));
  const placed: Placed[] = [];
  for (const { line, clip, lead, speech, fit } of planned) {
    const stretched = fit.tempo > 1 ? processors.stretch(clip, fit.tempo) : clip;
    const shaped = processors.normalise(stretched);
    const leadAfter = Math.round(lead / fit.tempo);
    const offset = Math.round(line.start * rate) - leadAfter;
    for (let index = 0; index < shaped.length; index += 1) {
      const at = offset + index;
      if (at >= 0 && at < track.length) track[at] = track[at]! + shaped[index]!;
    }
    placed.push({ line, speech, tempo: fit.tempo, at: line.start });
  }
  return { ok: true, track, placed };
}

/** Mono 16-bit PCM WAV. */
export function encodeWav(samples: Float32Array, rate: number = VOICE_RATE): Uint8Array {
  const bytes = new Uint8Array(44 + samples.length * 2);
  const view = new DataView(bytes.buffer);
  const text = (at: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) view.setUint8(at + index, value.charCodeAt(index));
  };
  text(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, samples.length * 2, true);
  for (let index = 0; index < samples.length; index += 1) {
    const value = Math.max(-1, Math.min(1, samples[index]!));
    view.setInt16(44 + index * 2, Math.round(value < 0 ? value * 0x8000 : value * 0x7fff), true);
  }
  return bytes;
}

const sceneTitle = (id: SceneId): string => SCENES.find((scene) => scene.id === id)!.title;

/** video/voice/RECORDING.md, generated from Script_Data (Requirement 8.2). */
export function recordingMarkdown(lines: readonly VoiceLine[] = voiceLines()): string {
  let out = `# Recording the narration\n\nGenerated from \`video/src/script.ts\` by \`pnpm --filter @jacquard/video script\`. Edit the source, not this file.\n\n`;
  out += `Record one file per line: \`video/voice/lines/01.wav\` to \`${lines[lines.length - 1]!.file}\` (${lines.length} lines). Any sample rate, mono or stereo. Then run \`pnpm --filter @jacquard/video voice\`.\n\n`;
  out += `## Tips\n\n`;
  out += `- Record in a quiet room. Switch off fans and notifications; soft furnishings help.\n`;
  out += `- A phone or laptop mic is fine. Keep it about 20 cm from your mouth, a little to one side so the p and b sounds do not pop.\n`;
  out += `- Read at an easy pace. Each line has a target: the seconds its captions are on screen (planned at ${WORDS_PER_MINUTE} words a minute). Speech up to ${Math.round((MAX_STRETCH - 1) * 100)} % longer is sped up to fit, pitch kept; anything longer stops the script, which lists the line numbers, their lengths and their targets. Words are never cut.\n`;
  out += `- Leave about 1 s of silence before and after each line. The script trims it.\n`;
  out += `- To redo a line, record it again and overwrite its file, then run the command again.\n`;
  out += `- If your recorder saves another format, convert it, for example \`ffmpeg -i 05.m4a 05.wav\`.\n\n`;
  out += `## Lines\n\n`;
  let scene: SceneId | null = null;
  for (const line of lines) {
    if (line.sceneId !== scene) {
      scene = line.sceneId;
      out += `\n### ${sceneTitle(scene)}\n\n`;
    }
    out += `${line.number}. **${line.file}** · target ${line.window.toFixed(1)} s · ${wordCount(line.text)} words (${secondsFor(line.text).toFixed(1)} s at ${WORDS_PER_MINUTE} wpm)\n\n   ${line.text}\n\n`;
  }
  return out.replace(/\n{3,}/g, "\n\n");
}
