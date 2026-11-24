// Loudness check (demo-video 5.3): the mix of a render, measured with ffmpeg's EBU R128 meter
// inside each narration window, must be at least 18 dB under the voice target (VOICE_LUFS). Until
// the recording exists the voice track is silent, so this measures everything except the voice:
// the score, and the app's and the effects' sounds, which is stricter than the score alone.
import { execFileSync } from "node:child_process";
import { VOICE_LUFS } from "../src/mix.ts";
import { SCENES } from "../src/script.ts";

const file = process.argv[2] ?? "out/draft.mp4";
let worst = -Infinity;
for (const scene of SCENES) {
  const { start, end } = scene.voice;
  const log = execFileSync("sh", ["-c", `ffmpeg -hide_banner -nostats -ss ${start} -to ${end} -i '${file}' -vn -af ebur128 -f null - 2>&1 | grep -E '^ +I:' | tail -1`], { encoding: "utf8" });
  const lufs = Number(/I:\s+(-?[\d.]+)/.exec(log)?.[1] ?? "NaN");
  worst = Math.max(worst, lufs);
  console.log(`${scene.id}: ${lufs} LUFS under narration (limit ${VOICE_LUFS - 18})`);
}
if (!(worst <= VOICE_LUFS - 18)) {
  console.error(`too loud: ${worst} LUFS`);
  process.exit(1);
}
console.log(`ok: loudest window ${worst} LUFS, ${(VOICE_LUFS - worst).toFixed(1)} dB under the ${VOICE_LUFS} LUFS voice target`);
