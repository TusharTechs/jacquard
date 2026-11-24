// Writes video/script.md from Script_Data (demo-video 2.2): narration, word count and timing per
// scene, the claims with their labels, and the beats. Also video/voice/RECORDING.md, the list of
// lines to record (demo-video 8.2).
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DURATION, SCENES, WORDS_PER_MINUTE, secondsFor, wordCount } from "../src/script.ts";
import { recordingMarkdown, voiceLines } from "../src/voice.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const clock = (seconds: number): string => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}${seconds % 1 === 0 ? "" : `.${String(Math.round((seconds % 1) * 10))}`}`;

let out = `# Demo video script\n\nGenerated from \`video/src/script.ts\` by \`pnpm --filter @jacquard/video script\`. Edit the source, not this file.\n\nLength: ${clock(DURATION)} (${DURATION} s). Pace: ${WORDS_PER_MINUTE} words a minute. Total narration: ${SCENES.reduce((sum, scene) => sum + wordCount(scene.narration), 0)} words.\n\nThe captions are burned in from this text and the \`.srt\` is made from it. The narration is a synthetic voice (Kokoro-82M, run locally, chosen by Tushar), one file per part (\`voice/RECORDING.md\`, ${voiceLines().length} lines); the captions follow where each line is actually spoken.\n`;
for (const [index, scene] of SCENES.entries()) {
  const words = wordCount(scene.narration);
  const window = scene.voice.end - scene.voice.start;
  out += `\n## ${index + 1}. ${scene.title} (${clock(scene.start)} to ${clock(scene.end)})\n\n`;
  out += `Voice ${clock(scene.voice.start)} to ${clock(scene.voice.end)} (${window.toFixed(1)} s) · ${words} words · ${((words / WORDS_PER_MINUTE) * 60).toFixed(1)} s at ${WORDS_PER_MINUTE} wpm · window allows ${Math.floor((window / 60) * WORDS_PER_MINUTE)} words\n\n`;
  out += `| Voice | Seconds | Words | Needs at ${WORDS_PER_MINUTE} wpm | Narration |\n|---|---|---|---|---|\n${scene.parts.map((part) => `| ${clock(part.start)} to ${clock(part.end)} | ${(part.end - part.start).toFixed(1)} | ${wordCount(part.text)} | ${secondsFor(part.text).toFixed(1)} | ${part.text} |`).join("\n")}\n\n`;
  out += `Claims:\n\n| Claim | Label | Source |\n|---|---|---|\n${scene.claims.map((claim) => `| ${claim.text} | ${claim.label} | ${claim.source} |`).join("\n")}\n\n`;
  out += `Beats:\n\n| From | To | Kind | Shows |\n|---|---|---|---|\n${scene.beats.map((beat) => `| ${clock(beat.at)} | ${clock(beat.until)} | ${beat.kind} | ${beat.note} |`).join("\n")}\n`;
}
out += `\n## Notes for review\n\n- Changed after the first review: the Problem scene ends with the bridge line; the Kiro narration is ${wordCount(SCENES[2]!.narration)} words, with pauses between parts; the close no longer repeats "builder, not AI" and says the code is open source (MIT, see LICENSE).\n- Changed after the second review: the agents line now says the custom agents audited through our own MCP server, and that the Chrome DevTools and AWS Documentation MCP servers helped Kiro check the app and deploy it; the parts after it are re-timed. The narration is one file per part (\`voice/RECORDING.md\`), assembled by \`pnpm --filter @jacquard/video voice\`.\n- Changed after that: Tushar chose a synthetic voice instead of recording. \`pnpm --filter @jacquard/video tts\` makes every line with Kokoro-82M (local), checks each transcript against this script, and the end card says "Narration: synthetic voice (Kokoro-82M)".\n- Not said, as before: "a long float is a mistake you only find on the loom" and "cards are punched by hand" (no support in product.md or weaving-domain.md).\n`;
writeFileSync(join(root, "script.md"), out);
console.log(`script.md: ${SCENES.length} scenes, ${DURATION} s`);
writeFileSync(join(root, "voice", "RECORDING.md"), recordingMarkdown());
console.log(`voice/RECORDING.md: ${voiceLines().length} lines`);
