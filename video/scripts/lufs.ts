// Loudness measurement with ffmpeg's EBU R128 meter (demo-video 5.3, 8.5), shared by
// scripts/loudness.ts and scripts/voice.ts.
import { spawnSync } from "node:child_process";
import type { VoiceLine } from "../src/voice.ts";

/** Runs ffmpeg; returns stdout as bytes. Throws with ffmpeg's message on failure. */
export function ffmpeg(args: readonly string[], input?: Uint8Array): Buffer {
  const result = spawnSync("ffmpeg", ["-hide_banner", "-nostats", ...args], { input, maxBuffer: 1 << 30 });
  if (result.status !== 0) throw new Error(`ffmpeg ${args.join(" ")} failed:\n${result.stderr?.toString().slice(-2000)}`);
  return result.stdout;
}

function integrated(stderr: string): number {
  const summary = stderr.slice(stderr.lastIndexOf("Summary:"));
  const value = Number(/I:\s+(-?[\d.]+|-inf)\s+LUFS/.exec(summary)?.[1]?.replace("-inf", "-Infinity") ?? "NaN");
  return value <= -70 ? -Infinity : value;
}

/** Integrated loudness (LUFS) of a file, or of [start, end) seconds of it. −Infinity if silent. */
export function lufsOfFile(file: string, start?: number, end?: number): number {
  const range = start === undefined ? [] : ["-ss", String(start), "-to", String(end)];
  const result = spawnSync("ffmpeg", ["-hide_banner", "-nostats", ...range, "-i", file, "-vn", "-af", "ebur128", "-f", "null", "-"], { maxBuffer: 1 << 30 });
  if (result.status !== 0) throw new Error(`could not measure ${file}:\n${result.stderr.toString().slice(-2000)}`);
  return integrated(result.stderr.toString());
}

/** Integrated loudness of mono float samples. */
export function lufsOfSamples(samples: Float32Array, rate: number): number {
  const result = spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-f", "f32le", "-ar", String(rate), "-ac", "1", "-i", "pipe:0", "-af", "ebur128", "-f", "null", "-"], {
    input: new Uint8Array(samples.buffer, samples.byteOffset, samples.byteLength),
    maxBuffer: 1 << 30,
  });
  if (result.status !== 0) throw new Error(`could not measure samples:\n${result.stderr.toString().slice(-2000)}`);
  return integrated(result.stderr.toString());
}

/** Minimum gap between the voice and the rest of the mix under narration (Requirement 5.3). */
export const UNDER_VOICE_MIN_DB = 18;

export interface UnderVoice {
  readonly line: VoiceLine;
  readonly voice: number;
  readonly bed: number;
  readonly margin: number;
}

/**
 * For every narration part: the voice's loudness in the part's window (from the voice track) and
 * the loudness of everything else in the mix there (score, effects, the app's sound: a render with
 * the voice muted). The gap must be at least 18 dB in every part.
 */
export function underVoice(voiceFile: string, bedFile: string, lines: readonly VoiceLine[]): { readonly rows: readonly UnderVoice[]; readonly ok: boolean } {
  const rows = lines.map((line) => {
    const voice = lufsOfFile(voiceFile, line.start, line.end);
    const bed = lufsOfFile(bedFile, line.start, line.end);
    return { line, voice, bed, margin: voice - bed };
  });
  return { rows, ok: rows.every((row) => row.margin >= UNDER_VOICE_MIN_DB) };
}
