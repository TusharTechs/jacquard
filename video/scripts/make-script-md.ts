// Writes video/script.md from Script_Data (demo-video 2.2): narration, word count and timing per
// scene, the claims with their labels, and the beats.
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DURATION, SCENES, WORDS_PER_MINUTE, wordCount } from "../src/script.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const clock = (seconds: number): string => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}${seconds % 1 === 0 ? "" : `.${String(Math.round((seconds % 1) * 10))}`}`;

let out = `# Demo video script\n\nGenerated from \`video/src/script.ts\` by \`pnpm --filter @jacquard/video script\`. Edit the source, not this file.\n\nLength: ${clock(DURATION)} (${DURATION} s). Pace: ${WORDS_PER_MINUTE} words a minute. Total narration: ${SCENES.reduce((sum, scene) => sum + wordCount(scene.narration), 0)} words.\n\nThe captions are burned in from this text and the \`.srt\` is made from it. Until the recording exists, the voice track is silent.\n`;
for (const [index, scene] of SCENES.entries()) {
  const words = wordCount(scene.narration);
  const window = scene.voice.end - scene.voice.start;
  out += `\n## ${index + 1}. ${scene.title} (${clock(scene.start)} to ${clock(scene.end)})\n\n`;
  out += `Voice ${clock(scene.voice.start)} to ${clock(scene.voice.end)} (${window.toFixed(1)} s) · ${words} words · ${((words / WORDS_PER_MINUTE) * 60).toFixed(1)} s at ${WORDS_PER_MINUTE} wpm · window allows ${Math.floor((window / 60) * WORDS_PER_MINUTE)} words\n\n`;
  out += `> ${scene.narration}\n\n`;
  out += `Claims:\n\n| Claim | Label | Source |\n|---|---|---|\n${scene.claims.map((claim) => `| ${claim.text} | ${claim.label} | ${claim.source} |`).join("\n")}\n\n`;
  out += `Beats:\n\n| From | To | Kind | Shows |\n|---|---|---|---|\n${scene.beats.map((beat) => `| ${clock(beat.at)} | ${clock(beat.until)} | ${beat.kind} | ${beat.note} |`).join("\n")}\n`;
}
out += `\n## Notes for review\n\n- "A long float is a mistake you only find on the loom" from the brief is not said: neither product.md nor weaving-domain.md says when a float is found. The line used is weaving-domain.md's "long floats snag and weaken cloth".\n- "Cards are punched by hand" is not said: product.md names card punchers who turn a design into a physical card set, and the line says only that.\n`;
writeFileSync(join(root, "script.md"), out);
console.log(`script.md: ${SCENES.length} scenes, ${DURATION} s`);
