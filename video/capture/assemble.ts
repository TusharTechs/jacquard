// Turns a capture run into footage (demo-video design, "Capture"): JPEG frames at their screencast
// timestamps become a constant 30 fps H.264 file, the tapped app audio is placed at its start time,
// and the beats are written relative to the first frame.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

interface Capture {
  frames: { file: string; time: number }[];
  beats: { name: string; time: number }[];
  audioStartedAt: number | null;
}

const here = dirname(fileURLToPath(import.meta.url));
const frames = join(here, "frames");
const out = join(here, "..", "public", "capture");
mkdirSync(out, { recursive: true });

const capture = JSON.parse(readFileSync(join(frames, "capture.json"), "utf8")) as Capture;
const t0 = capture.frames[0]!.time;
const lines: string[] = [];
// The screencast sends frames only when the page changes, so the last frame lasts until the end beat.
const endBeat = capture.beats.find((beat) => beat.name === "end")?.time ?? capture.frames[capture.frames.length - 1]!.time;
capture.frames.forEach((frame, index) => {
  const next = capture.frames[index + 1];
  const duration = next === undefined ? Math.max(1 / 30, endBeat - frame.time) : Math.max(0.001, next.time - frame.time);
  lines.push(`file '${join(frames, "jpg", frame.file)}'`, `duration ${duration.toFixed(6)}`);
});
// The concat demuxer uses the last file's duration only if it is listed again.
lines.push(`file '${join(frames, "jpg", capture.frames[capture.frames.length - 1]!.file)}'`);
writeFileSync(join(frames, "list.txt"), lines.join("\n") + "\n");
const length = Math.max(capture.frames[capture.frames.length - 1]!.time + 1 / 30, endBeat) - t0;

execFileSync("ffmpeg", ["-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", join(frames, "list.txt"), "-vf", "fps=30,scale=1920:1080:flags=lanczos,format=yuv420p", "-c:v", "libx264", "-preset", "slow", "-crf", "16", "-movflags", "+faststart", join(out, "live.mp4")]);

const audioIn = join(frames, "audio.webm");
if (capture.audioStartedAt !== null && existsSync(audioIn)) {
  const delayMs = Math.max(0, Math.round((capture.audioStartedAt - t0) * 1000));
  execFileSync("ffmpeg", ["-y", "-v", "error", "-i", audioIn, "-af", `adelay=${delayMs}|${delayMs},apad`, "-t", length.toFixed(3), "-ar", "48000", "-ac", "2", join(out, "live-audio.wav")]);
}

const beats = Object.fromEntries(capture.beats.map((beat) => [beat.name, Number((beat.time - t0).toFixed(3))]));
writeFileSync(join(out, "beats.json"), JSON.stringify({ length: Number(length.toFixed(3)), beats }, null, 1) + "\n");
console.log(`public/capture/live.mp4: ${capture.frames.length} frames, ${length.toFixed(1)} s; beats: ${Object.keys(beats).join(", ")}`);
