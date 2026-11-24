// `pnpm --filter @jacquard/video voice` (demo-video Requirements 8, 9): builds
// public/audio/voice.wav from the narration lines, voice/lines/01.wav to the last, one per part.
// The lines are a synthetic voice made by `pnpm --filter @jacquard/video tts` (Kokoro-82M, local);
// a person's recording of a line works the same way.
// 1. Decode each line to mono 48 kHz (ffmpeg; any sample rate, mono or stereo).
// 2. Trim leading and trailing silence, keep 0.15 s around the speech (src/voice.ts).
// 3. Fit each line to its part's window: up to 5 % faster with ffmpeg atempo (pitch kept);
//    longer lines stop the script with a list of numbers, lengths and windows. Words are never cut.
// 4. Normalise each line to −16 LUFS (ffmpeg ebur128, then a gain and a −1 dBFS peak limiter).
// 5. Place each line so its speech starts at its part's start; write 48 kHz mono 16-bit WAV.
// 6. Set assets.voice to true, render the mix with the voice muted, and check that it is at least
//    18 dB under the voice in every part.
// Options: --lines <dir>, --out <file>, --no-assets (leave public/data/assets.json alone),
// --no-check (skip the render and the loudness check). 7. Write src/voice-timing.ts (where each
// line's speech and each sentence is), which the captions and the .srt follow.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { DURATION } from "../src/script.ts";
import { VOICE_LUFS } from "../src/mix.ts";
import { VOICE_RATE, assembleVoice, checkLineFiles, encodeWav, voiceLines } from "../src/voice.ts";
import { UNDER_VOICE_MIN_DB, ffmpeg, lufsOfFile, lufsOfSamples, underVoice } from "./lufs.ts";

const args = process.argv.slice(2);
const flag = (name: string, fallback: string): string => {
  const index = args.indexOf(name);
  return index === -1 ? fallback : args[index + 1]!;
};
const linesDir = flag("--lines", "voice/lines");
const outFile = flag("--out", "public/audio/voice.wav");
const writeAssets = !args.includes("--no-assets");
const check = !args.includes("--no-check");

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

const raw = (samples: Float32Array): Uint8Array => new Uint8Array(samples.buffer, samples.byteOffset, samples.byteLength);
const floats = (bytes: Buffer): Float32Array => {
  const copy = new Uint8Array(bytes.length - (bytes.length % 4));
  copy.set(bytes.subarray(0, copy.length));
  return new Float32Array(copy.buffer);
};
const pcmIn = ["-f", "f32le", "-ar", String(VOICE_RATE), "-ac", "1", "-i", "pipe:0"];
const pcmOut = ["-f", "f32le", "-ar", String(VOICE_RATE), "-ac", "1", "pipe:1"];

const lines = voiceLines();
if (!existsSync(linesDir)) fail(`No folder ${linesDir}. Record ${lines[0]!.file} to ${lines[lines.length - 1]!.file} there (see voice/RECORDING.md).`);
const { missing, unexpected } = checkLineFiles(readdirSync(linesDir), lines);
if (missing.length > 0 || unexpected.length > 0) {
  fail(
    [
      missing.length > 0 ? `Missing lines (${missing.length} of ${lines.length}): ${missing.join(", ")}.` : "",
      unexpected.length > 0 ? `Not a line of the script: ${unexpected.join(", ")} (lines are ${lines[0]!.file} to ${lines[lines.length - 1]!.file}).` : "",
      "See voice/RECORDING.md.",
    ]
      .filter(Boolean)
      .join("\n"),
  );
}

// Sentence ranges from the synthetic voice's sidecar (voice/lines/NN.json), when there is one, so
// the captions can follow each sentence (9.7).
const sentenceRanges = (line: (typeof lines)[number]) => {
  const side = join(linesDir, line.file.replace(/\.wav$/, ".json"));
  if (!existsSync(side)) return undefined;
  const data = JSON.parse(readFileSync(side, "utf8")) as { rate: number; sentences: { start: number; end: number }[] };
  const scale = VOICE_RATE / data.rate;
  return data.sentences.map((range) => ({ start: Math.round(range.start * scale), end: Math.round(range.end * scale) }));
};
const heardWords = (line: (typeof lines)[number]) => {
  const side = join(linesDir, line.file.replace(/\.wav$/, ".json"));
  if (!existsSync(side)) return undefined;
  return (JSON.parse(readFileSync(side, "utf8")) as { words?: { word: string; start: number; end: number }[] }).words;
};
const inputs = lines.map((line) => ({ line, samples: floats(ffmpeg(["-v", "error", "-i", join(linesDir, line.file), ...pcmOut])), sentences: sentenceRanges(line), words: heardWords(line) }));
const assembly = assembleVoice(
  inputs,
  {
    stretch: (samples, tempo) => floats(ffmpeg([...pcmIn, "-af", `atempo=${tempo.toFixed(6)}`, ...pcmOut], raw(samples))),
    normalise: (samples) => {
      const measured = lufsOfSamples(samples, VOICE_RATE);
      if (!Number.isFinite(measured)) throw new Error("a line is too quiet to measure");
      const gain = VOICE_LUFS - measured;
      return floats(ffmpeg([...pcmIn, "-af", `volume=${gain.toFixed(3)}dB,alimiter=limit=0.891:attack=5:release=50:level=false:latency=true`, ...pcmOut], raw(samples)));
    },
  },
  DURATION,
);
if (!assembly.ok) fail(assembly.message);

mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, encodeWav(assembly.track, VOICE_RATE));
for (const item of assembly.placed) {
  console.log(`${item.line.name}: ${item.speech.toFixed(2)} s in a ${item.line.window.toFixed(2)} s window${item.tempo > 1 ? `, ${((item.tempo - 1) * 100).toFixed(1)} % faster` : ""}, at ${item.at.toFixed(1)} s`);
}
console.log(`${outFile}: ${assembly.placed.length} lines, ${DURATION} s, 48 kHz, voice at ${lufsOfFile(outFile).toFixed(1)} LUFS (target ${VOICE_LUFS})`);

if (writeAssets) {
  // Where each line's speech is, for the captions and the .srt (9.7).
  const timing = assembly.placed.map((item) => ({
    start: Number(item.at.toFixed(3)),
    end: Number(item.end.toFixed(3)),
    sentences: (item.sentences.length > 0 ? item.sentences : [{ start: item.at, end: item.end }]).map((span) => ({ start: Number(span.start.toFixed(3)), end: Number(span.end.toFixed(3)) })),
    words: item.words.map((word) => ({ word: word.word, start: Number(word.start.toFixed(3)), end: Number(word.end.toFixed(3)) })),
  }));
  writeFileSync(
    "src/voice-timing.ts",
    `// Where each narration line's speech actually is in the Main_Cut, in seconds (demo-video 9.7).\n// Generated by scripts/voice.ts after the voice track is assembled; empty until then, when the\n// captions use the parts' planned windows. Do not edit by hand.\nimport type { LineTiming } from "./cues.ts";\n\nexport const VOICE_TIMING: readonly LineTiming[] = ${JSON.stringify(timing, null, 2)};\n`,
  );
  console.log(`src/voice-timing.ts: ${timing.length} lines`);
  const assetsFile = "public/data/assets.json";
  const assets = existsSync(assetsFile) ? (JSON.parse(readFileSync(assetsFile, "utf8")) as Record<string, unknown>) : {};
  writeFileSync(assetsFile, JSON.stringify({ ...assets, voice: true }));
  console.log(`${assetsFile}: voice true`);
}

if (check) {
  // Everything but the voice, as the Main_Cut mixes it.
  const bed = "out/.tmp/bed.wav";
  mkdirSync(dirname(bed), { recursive: true });
  console.log("rendering the mix without the voice for the loudness check…");
  execFileSync("npx", ["remotion", "render", "src/index.ts", "Main", bed, "--codec=wav", `--props=${JSON.stringify({ voice: false })}`, "--log=error"], { stdio: "inherit" });
  const { rows, ok } = underVoice(outFile, bed, lines);
  const short = rows.filter((row) => row.margin < UNDER_VOICE_MIN_DB);
  const worst = rows.reduce((least, row) => (row.margin < least.margin ? row : least));
  if (!ok) fail(`The rest of the mix is less than ${UNDER_VOICE_MIN_DB} dB under the voice in: ${short.map((row) => `${row.line.name} (${row.margin.toFixed(1)} dB)`).join(", ")}.`);
  console.log(`loudness ok: the rest of the mix is at least ${worst.margin.toFixed(1)} dB under the voice (line ${worst.line.name})`);
}
