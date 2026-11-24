// Writes out/jacquard-demo.srt from the narration (demo-video 2.6), the same cues as the captions,
// timed to the voice once scripts/voice.ts has written src/voice-timing.ts (9.7).
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { cuesForTimedParts, toSrt } from "../src/cues.ts";
import { SCENES } from "../src/script.ts";
import { VOICE_TIMING } from "../src/voice-timing.ts";

const out = join(dirname(fileURLToPath(import.meta.url)), "..", "out");
mkdirSync(out, { recursive: true });
const cues = cuesForTimedParts(SCENES, VOICE_TIMING);
writeFileSync(join(out, "jacquard-demo.srt"), toSrt(cues));
console.log(`out/jacquard-demo.srt: ${cues.length} cues`);
