// Loudness of the Vertical_Cut (demo-video 9.9): renders its sound twice, the voice alone
// ({"music":false,"effects":false}) and everything else ({"voice":false}), and checks that in every
// stretch of voice the rest of the mix is at least 18 dB under it.
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { UNDER_VOICE_MIN_DB, lufsOfFile } from "./lufs.ts";
import { SHOTS, VERTICAL_WINDOWS } from "../src/vertical.ts";

mkdirSync("out/.tmp", { recursive: true });
const render = (file: string, props: object) =>
  execFileSync("npx", ["remotion", "render", "src/index.ts", "Vertical", file, "--codec=wav", `--props=${JSON.stringify(props)}`, "--log=error"], { stdio: "inherit" });
render("out/.tmp/vertical-voice.wav", { music: false, effects: false });
render("out/.tmp/vertical-bed.wav", { voice: false });

// One row per shot with speech; windows shorter than 0.4 s are too short for the meter.
const rows = VERTICAL_WINDOWS.filter((window) => window.end - window.start >= 0.4).map((window) => {
  const shot = SHOTS.find((item) => window.start >= item.at - 1e-6 && window.start < item.at + item.to - item.from)!;
  const voice = lufsOfFile("out/.tmp/vertical-voice.wav", window.start, window.end);
  const bed = lufsOfFile("out/.tmp/vertical-bed.wav", window.start, window.end);
  return { line: String(shot.line).padStart(2, "0"), start: window.start, voice, bed, margin: voice - bed };
});
for (const row of rows) console.log(`${row.line} at ${row.start.toFixed(2)} s: voice ${row.voice.toFixed(1)} LUFS, rest ${row.bed.toFixed(1)} LUFS, ${row.margin.toFixed(1)} dB under`);
const short = rows.filter((row) => row.margin < UNDER_VOICE_MIN_DB);
if (short.length > 0) {
  console.error(`less than ${UNDER_VOICE_MIN_DB} dB under the voice: ${short.map((row) => row.line).join(", ")}`);
  process.exit(1);
}
console.log(`ok: the rest of the mix is at least ${Math.min(...rows.map((row) => row.margin)).toFixed(1)} dB under the voice in every line`);
