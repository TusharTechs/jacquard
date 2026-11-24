// Loudness check (demo-video 5.3). Two modes:
// - `node scripts/loudness.ts [render.mp4]`: before the recording exists. The voice track is
//   silent, so this measures everything except the voice (score, effects, the app's sound) inside
//   each narration window; it must be at least 18 dB under the voice target (VOICE_LUFS).
// - `node scripts/loudness.ts --voice public/audio/voice.wav --bed out/.tmp/bed.wav`: against the
//   real voice track, per narration part (8.5). scripts/voice.ts runs this mode after assembly.
import { VOICE_LUFS } from "../src/mix.ts";
import { SCENES } from "../src/script.ts";
import { voiceLines } from "../src/voice.ts";
import { UNDER_VOICE_MIN_DB, lufsOfFile, underVoice } from "./lufs.ts";

const args = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
};

const voice = flag("--voice");
const bed = flag("--bed");
if (voice !== undefined && bed !== undefined) {
  const { rows, ok } = underVoice(voice, bed, voiceLines());
  for (const row of rows) console.log(`${row.line.name}: voice ${row.voice.toFixed(1)} LUFS, rest of the mix ${row.bed.toFixed(1)} LUFS, ${row.margin.toFixed(1)} dB under`);
  const worst = rows.reduce((least, row) => (row.margin < least.margin ? row : least));
  if (!ok) {
    console.error(`too loud under the voice: ${rows.filter((row) => row.margin < UNDER_VOICE_MIN_DB).map((row) => `${row.line.name} (${row.margin.toFixed(1)} dB)`).join(", ")}; needs ${UNDER_VOICE_MIN_DB} dB`);
    process.exit(1);
  }
  console.log(`ok: the rest of the mix is at least ${worst.margin.toFixed(1)} dB under the voice (line ${worst.line.name})`);
} else {
  const file = args[0] ?? "out/draft.mp4";
  let worst = -Infinity;
  for (const scene of SCENES) {
    const lufs = lufsOfFile(file, scene.voice.start, scene.voice.end);
    worst = Math.max(worst, lufs);
    console.log(`${scene.id}: ${lufs} LUFS under narration (limit ${VOICE_LUFS - UNDER_VOICE_MIN_DB})`);
  }
  if (!(worst <= VOICE_LUFS - UNDER_VOICE_MIN_DB)) {
    console.error(`too loud: ${worst} LUFS`);
    process.exit(1);
  }
  console.log(`ok: loudest window ${worst} LUFS, ${(VOICE_LUFS - worst).toFixed(1)} dB under the ${VOICE_LUFS} LUFS voice target`);
}
