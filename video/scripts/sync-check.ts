// Caption-to-voice sync check (demo-video 9.7): renders the Main_Cut at 960x540 with only the voice
// in the sound ({"music":false,"effects":false}), then, for every narration line, finds where the
// voice starts in the render's audio and where the caption band changes in the render's picture,
// and logs the offset. Fails if any line's caption is more than 0.2 s from its voice.
// Usage: node scripts/sync-check.ts [--no-render]
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { VOICE_TIMING } from "../src/voice-timing.ts";
import { FRAME_SECONDS, VOICE_RATE, trimBounds, voiceLines } from "../src/voice.ts";

const FILE = "out/sync-check.mp4";
const FPS = 30;
const LIMIT = 0.2;
if (VOICE_TIMING.length === 0) {
  console.error("No voice timing yet: run pnpm --filter @jacquard/video voice first.");
  process.exit(1);
}
mkdirSync("out", { recursive: true });
if (!process.argv.includes("--no-render")) {
  execFileSync("npx", ["remotion", "render", "src/index.ts", "Main", FILE, "--scale=0.5", "--crf=28", `--props=${JSON.stringify({ music: false, effects: false })}`, "--log=error"], { stdio: "inherit" });
}

// The voice, from the render's own audio.
const pcm = execFileSync("ffmpeg", ["-v", "error", "-i", FILE, "-vn", "-f", "f32le", "-ac", "1", "-ar", String(VOICE_RATE), "pipe:1"], { maxBuffer: 1 << 30 });
const copy = new Uint8Array(pcm.length - (pcm.length % 4));
copy.set(pcm.subarray(0, copy.length));
const audio = new Float32Array(copy.buffer);

// The caption band's middle (960x540: 140x30 at 410, 482, inside the walnut box of the shortest
// caption), as grey frames; a caption appearing or changing moves its mean difference a lot.
const W = 140;
const H = 30;
const frames = execFileSync("ffmpeg", ["-v", "error", "-i", FILE, "-an", "-vf", `crop=${W}:${H}:410:482,format=gray`, "-f", "rawvideo", "pipe:1"], { maxBuffer: 1 << 30 });
const count = Math.floor(frames.length / (W * H));
const changes: number[] = [];
for (let f = 1; f < count; f += 1) {
  let sum = 0;
  for (let i = 0; i < W * H; i += 1) sum += Math.abs(frames[f * W * H + i]! - frames[(f - 1) * W * H + i]!);
  if (sum / (W * H) > 12) changes.push(f / FPS);
}

const lines = voiceLines();
const rows = VOICE_TIMING.map((timing, index) => {
  const previousEnd = index === 0 ? 0 : VOICE_TIMING[index - 1]!.end;
  const from = Math.max(previousEnd + 0.05, timing.start - 0.6);
  const to = Math.min(timing.end, timing.start + 0.6);
  const slice = audio.slice(Math.round(from * VOICE_RATE), Math.round(to * VOICE_RATE));
  const bounds = trimBounds(slice, VOICE_RATE);
  const voice = bounds === null ? NaN : from + bounds.start / VOICE_RATE;
  const caption = changes.reduce((best, t) => (Math.abs(t - voice) < Math.abs(best - voice) ? t : best), Infinity);
  return { line: lines[index]!.name, voice: Number(voice.toFixed(3)), caption: Number(caption.toFixed(3)), offset: Number((caption - voice).toFixed(3)) };
});
writeFileSync("out/sync-check.json", JSON.stringify(rows, null, 1));
for (const row of rows) console.log(`${row.line}: voice starts ${row.voice.toFixed(2)} s, caption ${row.caption.toFixed(2)} s, offset ${row.offset >= 0 ? "+" : ""}${row.offset.toFixed(2)} s`);
const worst = rows.reduce((a, b) => (Math.abs(b.offset) > Math.abs(a.offset) ? b : a));
const bad = rows.filter((row) => !(Math.abs(row.offset) <= LIMIT));
console.log(`largest offset ${worst.offset.toFixed(2)} s (line ${worst.line}); analysis frame ${FRAME_SECONDS * 1000} ms, video frame ${Math.round(1000 / FPS)} ms`);
if (bad.length > 0) {
  console.error(`over ${LIMIT} s: ${bad.map((row) => row.line).join(", ")}`);
  process.exit(1);
}
console.log(`ok: every caption within ${LIMIT} s of its voice`);
