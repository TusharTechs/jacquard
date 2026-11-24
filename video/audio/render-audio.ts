// Renders the score and the effects offline (demo-video 5.1, 5.2): bundles browser-entry.ts with
// esbuild, runs it in headless Chromium through Playwright, saves the WAV downloads to
// public/audio, and normalises the score to SCORE_REF_LUFS with ffmpeg's loudnorm.
import { execFileSync } from "node:child_process";
import { mkdirSync, renameSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { chromium } from "@playwright/test";
import { SCORE_REF_LUFS } from "../src/mix.ts";
import { DURATION } from "../src/script.ts";

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "..", "public", "audio");
mkdirSync(out, { recursive: true });

const bundle = await build({ entryPoints: [join(here, "browser-entry.ts")], bundle: true, format: "iife", write: false, platform: "browser", target: "es2022" });
const code = bundle.outputFiles[0]!.text;

const browser = await chromium.launch({ headless: true, args: ["--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage({ acceptDownloads: true });
await page.setContent("<!doctype html><title>score</title>");
await page.addScriptTag({ content: code });
const downloads: Promise<void>[] = [];
page.on("download", (download) => {
  downloads.push(download.saveAs(join(out, download.suggestedFilename())));
});
const names = await page.evaluate((seconds) => window.renderAll(seconds), DURATION);
await new Promise((resolve) => setTimeout(resolve, 500));
await Promise.all(downloads);
await browser.close();

// Normalise the score stem so the mix gains in src/mix.ts mean what they say.
const raw = join(out, "score.wav");
const normalised = join(out, "score-norm.wav");
execFileSync("ffmpeg", ["-y", "-v", "error", "-i", raw, "-af", `loudnorm=I=${SCORE_REF_LUFS}:TP=-2:LRA=11`, "-ar", "48000", normalised]);
renameSync(normalised, join(out, "score.wav"));
console.log(`public/audio: ${names.join(", ")} (score normalised to ${SCORE_REF_LUFS} LUFS)`);
