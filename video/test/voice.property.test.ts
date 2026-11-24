// Voice assembly (demo-video Requirement 8), with synthetic tones as the recorded lines; no speech
// and no text-to-speech. Properties 4 to 6 and examples for the overrun report and RECORDING.md.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { DURATION, SCENES } from "../src/script.ts";
import { MAX_STRETCH, PAD_SECONDS, VOICE_RATE, assembleVoice, checkLineFiles, encodeWav, overrunReport, planFit, recordingMarkdown, trimBounds, voiceLines } from "../src/voice.ts";
import type { Processors, VoiceLine } from "../src/voice.ts";

const RATE = VOICE_RATE;

/** Deterministic low noise (a quiet room) around a 220 Hz tone of `tone` seconds. */
function toneLine(lead: number, tone: number, tail: number, amplitude = 0.3, seed = 1): Float32Array {
  const samples = new Float32Array(Math.round((lead + tone + tail) * RATE));
  let state = seed >>> 0 || 1;
  const from = Math.round(lead * RATE);
  const to = from + Math.round(tone * RATE);
  for (let index = 0; index < samples.length; index += 1) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const noise = ((state / 0xffffffff) * 2 - 1) * 0.0005;
    samples[index] = noise + (index >= from && index < to ? amplitude * Math.sin((2 * Math.PI * 220 * (index - from)) / RATE) : 0);
  }
  return samples;
}

/** Test doubles for the ffmpeg steps: a resample for the stretch (pitch is not checked here), unity loudness. */
const processors: Processors = {
  stretch: (samples, tempo) => {
    const out = new Float32Array(Math.round(samples.length / tempo));
    for (let index = 0; index < out.length; index += 1) out[index] = samples[Math.min(samples.length - 1, Math.round(index * tempo))]!;
    return out;
  },
  normalise: (samples) => samples,
};

/** First and last sample above the tone's half amplitude. */
function speechSpan(track: Float32Array, from: number, to: number): { first: number; last: number } | null {
  let first = -1;
  let last = -1;
  for (let index = Math.max(0, from); index < Math.min(track.length, to); index += 1) {
    if (Math.abs(track[index]!) > 0.15) {
      if (first === -1) first = index;
      last = index;
    }
  }
  return first === -1 ? null : { first, last };
}

const LINES = voiceLines();

describe("voice lines", () => {
  it("numbers every narration part in order through the video, 01 to the last", () => {
    const parts = SCENES.flatMap((scene) => scene.parts);
    expect(LINES).toHaveLength(parts.length);
    LINES.forEach((line, index) => {
      expect(line.number).toBe(index + 1);
      expect(line.file).toBe(`${String(index + 1).padStart(2, "0")}.wav`);
      expect(line.text).toBe(parts[index]!.text);
      expect(line.start).toBe(parts[index]!.start);
      expect(line.window).toBeCloseTo(parts[index]!.end - parts[index]!.start, 9);
    });
  });

  it("lists missing and unexpected files", () => {
    const files = LINES.filter((line) => line.number !== 3 && line.number !== 12).map((line) => line.file);
    expect(checkLineFiles([...files, "27.wav", "notes.txt", ".gitkeep"], LINES)).toEqual({ missing: ["03", "12"], unexpected: ["27.wav"] });
    expect(checkLineFiles(LINES.map((line) => line.file), LINES)).toEqual({ missing: [], unexpected: [] });
  });

  it("keeps voice/RECORDING.md in step with the script", () => {
    const file = join(dirname(fileURLToPath(import.meta.url)), "..", "voice", "RECORDING.md");
    expect(readFileSync(file, "utf8")).toBe(recordingMarkdown());
    for (const line of LINES) expect(recordingMarkdown()).toContain(line.text);
  });
});

describe("Property 4: a line fits its window, at most 5 % faster, or is reported", () => {
  it("holds for any speech length and window", () => {
    fc.assert(
      fc.property(fc.double({ min: 0.2, max: 20, noNaN: true }), fc.double({ min: 0.2, max: 20, noNaN: true }), (speech, window) => {
        const fit = planFit(speech, window);
        // planFit treats lengths within 1e-9 s of a limit as on it (float rounding).
        if (speech <= window + 1e-9) expect(fit).toEqual({ kind: "fits", tempo: 1 });
        else if (speech <= window * MAX_STRETCH) {
          expect(fit.kind).toBe("stretch");
          expect(fit.tempo).toBeGreaterThan(1);
          expect(fit.tempo).toBeLessThanOrEqual(MAX_STRETCH + 1e-9);
          expect(speech / fit.tempo).toBeLessThanOrEqual(window + 1e-9);
        } else if (speech > window * MAX_STRETCH * (1 + 1e-9)) expect(fit.kind).toBe("overrun");
      }),
    );
  });

  it("reports every overrunning line with its number, length and window, and writes no track", () => {
    const too = new Set([2, 9, 26]);
    const inputs = LINES.map((line) => ({ line, samples: toneLine(1, too.has(line.number) ? line.window * 1.08 : line.window * 0.9, 1, 0.3, line.number) }));
    const result = assembleVoice(inputs, processors, DURATION);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.overruns.map((item) => item.line.number)).toEqual([2, 9, 26]);
    for (const item of result.overruns) {
      expect(result.message).toContain(`${item.line.name}: ${item.speech.toFixed(2)} s of speech, window ${item.line.window.toFixed(2)} s`);
      expect(item.speech).toBeGreaterThan(item.line.window * MAX_STRETCH);
    }
    expect(result.message).toMatch(/^3 lines too long/);
  });

  it("stretches a line up to 5 % over and places it inside its window", () => {
    const inputs = LINES.map((line) => ({ line, samples: toneLine(1, line.number === 7 ? line.window * 1.04 : line.window * 0.8, 1, 0.3, line.number) }));
    const result = assembleVoice(inputs, processors, DURATION);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const seven = result.placed[6]!;
    expect(seven.tempo).toBeGreaterThan(1.03);
    expect(seven.tempo).toBeLessThanOrEqual(MAX_STRETCH);
    const line = LINES[6]!;
    // Line 8 starts 0.1 s after line 7's window ends, so look no further than 0.05 s past it.
    const span = speechSpan(result.track, Math.round((line.start - 0.05) * RATE), Math.round((line.end + 0.05) * RATE))!;
    expect(span.first / RATE).toBeGreaterThanOrEqual(line.start - 0.011);
    expect(span.last / RATE).toBeLessThanOrEqual(line.end + 0.011);
  });

  it("formats a single overrun", () => {
    const line: VoiceLine = LINES[0]!;
    expect(overrunReport([{ line, speech: 6.2 }])).toBe(
      `1 line too long for its window, even 5 % faster. Re-record it a little quicker:\n  01: 6.20 s of speech, window ${line.window.toFixed(2)} s (fits up to ${(line.window * MAX_STRETCH).toFixed(2)} s): "${line.text}"`,
    );
  });
});

describe("Property 5: trimming never cuts the speech", () => {
  it("keeps the whole tone and drops silence beyond one frame, for any lead, tail and level", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 2, noNaN: true }),
        fc.double({ min: 0.3, max: 3, noNaN: true }),
        fc.double({ min: 0, max: 2, noNaN: true }),
        fc.double({ min: 0.02, max: 0.9, noNaN: true }),
        fc.integer({ min: 1, max: 1000 }),
        (lead, tone, tail, amplitude, seed) => {
          const samples = toneLine(lead, tone, tail, amplitude, seed);
          const bounds = trimBounds(samples, RATE)!;
          const from = Math.round(lead * RATE);
          const to = from + Math.round(tone * RATE);
          const frame = Math.round(0.01 * RATE);
          expect(bounds.start).toBeLessThanOrEqual(from);
          expect(bounds.end).toBeGreaterThanOrEqual(Math.min(samples.length, to));
          expect(bounds.start).toBeGreaterThanOrEqual(from - frame);
          expect(bounds.end).toBeLessThanOrEqual(to + frame);
        },
      ),
      { numRuns: 60 },
    );
  });

  it("keeps a quiet tail that fades to 40 dB under the peak", () => {
    const samples = toneLine(1, 1, 1);
    const from = Math.round(1.5 * RATE);
    const to = Math.round(2 * RATE);
    for (let index = from; index < to; index += 1) samples[index] = samples[index]! * Math.pow(10, (-40 * (index - from)) / (to - from) / 20);
    const bounds = trimBounds(samples, RATE)!;
    expect(bounds.end).toBeGreaterThanOrEqual(to - Math.round(0.01 * RATE));
  });

  it("finds nothing in silence", () => {
    expect(trimBounds(new Float32Array(RATE), RATE)).toBeNull();
  });
});

describe("Property 6: each line's speech starts at its part's start", () => {
  it("places any fitting set of lines at their starts, inside their windows, in a track of the video's length", () => {
    fc.assert(
      fc.property(
        fc.array(fc.record({ lead: fc.double({ min: 0.2, max: 1.5, noNaN: true }), share: fc.double({ min: 0.3, max: 1, noNaN: true }), tail: fc.double({ min: 0.2, max: 1.5, noNaN: true }) }), {
          minLength: LINES.length,
          maxLength: LINES.length,
        }),
        (shapes) => {
          const inputs = LINES.map((line, index) => ({ line, samples: toneLine(shapes[index]!.lead, line.window * shapes[index]!.share, shapes[index]!.tail, 0.3, index + 1) }));
          const result = assembleVoice(inputs, processors, DURATION);
          expect(result.ok).toBe(true);
          if (!result.ok) return;
          expect(result.track.length).toBe(Math.round(DURATION * RATE));
          LINES.forEach((line, index) => {
            // Search from the previous window's end at the earliest: parts can be 0.1 s apart.
            const from = Math.max(index === 0 ? 0 : LINES[index - 1]!.end, line.start - PAD_SECONDS - 0.05);
            const span = speechSpan(result.track, Math.round(from * RATE), Math.round((line.end + 0.05) * RATE))!;
            // The tone starts within one analysis frame of the part's start and ends inside the window.
            expect(Math.abs(span.first / RATE - line.start)).toBeLessThanOrEqual(0.011);
            expect(span.last / RATE).toBeLessThanOrEqual(line.start + line.window * shapes[index]!.share + 0.011);
          });
          // Nothing but low noise between the parts.
          for (let index = 1; index < LINES.length; index += 1) {
            const gap = speechSpan(result.track, Math.round((LINES[index - 1]!.end + 0.02) * RATE), Math.round((LINES[index]!.start - 0.02) * RATE));
            expect(gap).toBeNull();
          }
        },
      ),
      { numRuns: 8 },
    );
  });

  it("writes a 48 kHz mono 16-bit WAV", () => {
    const bytes = encodeWav(new Float32Array([0, 0.5, -0.5, 1, -1]), RATE);
    const view = new DataView(bytes.buffer);
    expect(String.fromCharCode(...bytes.subarray(0, 4))).toBe("RIFF");
    expect(view.getUint16(22, true)).toBe(1);
    expect(view.getUint32(24, true)).toBe(48000);
    expect(view.getUint16(34, true)).toBe(16);
    expect([1, 2, 3, 4].map((index) => view.getInt16(44 + index * 2, true))).toEqual([16384, -16384, 32767, -32768]);
  });
});
