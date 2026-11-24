// Writes out/jacquard-demo.srt from the narration (demo-video 2.6), the same cues as the captions.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { cuesForParts, toSrt } from "../src/cues.ts";
import { SCENES } from "../src/script.ts";

const out = join(dirname(fileURLToPath(import.meta.url)), "..", "out");
mkdirSync(out, { recursive: true });
const cues = cuesForParts(SCENES);
writeFileSync(join(out, "jacquard-demo.srt"), toSrt(cues));
console.log(`out/jacquard-demo.srt: ${cues.length} cues`);
