// The scripted run on the live site (demo-video 3.1 to 3.4). Repeatable: storage is cleared so the
// Opening shows, every wait is on something visible, and every step logs a beat. Output goes to
// video/capture/frames (JPEG frames, audio, beats); assemble.ts turns it into public/capture.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import { startScreencast } from "./screencast.ts";

const here = dirname(fileURLToPath(import.meta.url));
const OUT = join(here, "frames");
const LIVE_URL = "https://main.d28e9v65r7sow0.amplifyapp.com/";
const DESCRIPTION = "a peacock in gold and maroon on a cream ground";

const beats: { name: string; time: number }[] = [];
function beat(name: string): void {
  beats.push({ name, time: Date.now() / 1000 });
}

async function glide(page: Page, target: Locator): Promise<void> {
  await target.scrollIntoViewIfNeeded();
  const box = await target.boundingBox();
  if (box === null) throw new Error("target has no box");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 24 });
}

async function press(page: Page, target: Locator): Promise<void> {
  await glide(page, target);
  await page.waitForTimeout(250);
  await target.click();
}

test("live site, scripted for the demo video", async ({ page }) => {
  mkdirSync(OUT, { recursive: true });
  await page.addInitScript({ path: join(here, "audio-tap.js") });
  await page.addInitScript({ path: join(here, "cursor.js") });
  // Print is shown through the print stylesheet, not the browser's dialog.
  await page.addInitScript(() => {
    window.print = () => undefined;
  });

  // A fresh visit: no saved design, the Opening not yet seen.
  await page.goto(LIVE_URL + "#/design");
  await page.evaluate(() => localStorage.clear());
  const cast = await startScreencast(page, join(OUT, "jpg"));
  await page.goto(LIVE_URL + "?capture=1#/design", { waitUntil: "domcontentloaded" });
  beat("opening");
  await page.mouse.move(960, 700);
  await page.waitForTimeout(4600);

  // Describe the peacock; the chips appear while typing.
  const box = page.getByLabel("Describe the motif");
  await box.scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, -120));
  await press(page, box);
  beat("type");
  await page.keyboard.type(DESCRIPTION, { delay: 70 });
  await expect(page.getByRole("group", { name: "What the motif builder understood" })).toBeVisible();
  beat("chips");
  await page.waitForTimeout(2200);
  await press(page, page.getByRole("button", { name: "Generate motif" }));
  beat("generate");
  await page.waitForTimeout(600);
  await page.locator(".area-bench canvas").first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(2600);
  beat("motif");
  await page.waitForTimeout(1500);

  // Check: the violations pulse, then auto-fix places its flips.
  await press(page, page.getByRole("button", { name: /Continue to Check/ }));
  beat("check");
  await page.waitForTimeout(3200);
  const autoFix = page.getByRole("button", { name: /^Auto-fix/ }).first();
  await press(page, autoFix);
  beat("autofix");
  await page.waitForTimeout(3600);

  // Weave: sound on, the loom weaving, then the Cloth view.
  await press(page, page.getByRole("button", { name: /Continue to Weave/ }));
  beat("weave");
  const sound = page.getByRole("button", { name: "Sound" });
  await sound.waitFor();
  await press(page, sound);
  beat("sound");
  await page.waitForTimeout(9000);
  await press(page, page.locator(".loom-speeds button", { hasText: "4" }));
  beat("fast");
  await expect(page.locator(".loom-view")).toHaveAttribute("aria-pressed", "true", { timeout: 120_000 });
  beat("cloth");
  await page.waitForTimeout(6000);

  // Cards: the chain punching, Print, the WIF export.
  await press(page, page.getByRole("button", { name: /Continue to Cards/ }));
  beat("cards");
  await page.waitForTimeout(5000);
  await press(page, page.getByRole("button", { name: "Print cards" }));
  beat("print");
  await page.emulateMedia({ media: "print" });
  await page.waitForTimeout(2500);
  await page.emulateMedia({ media: "screen" });
  await page.waitForTimeout(600);
  const downloadPromise = page.waitForEvent("download");
  await press(page, page.getByRole("button", { name: "WIF file" }));
  beat("wif");
  const download = await downloadPromise;
  await download.saveAs(join(OUT, download.suggestedFilename()));
  await page.waitForTimeout(2500);
  beat("end");

  const { frames } = await cast.stop();
  const audio = (await page.evaluate(() => (window as unknown as { __stopAudioTap: () => Promise<{ startedAt: number; base64: string } | null> }).__stopAudioTap())) ?? null;
  if (audio !== null) writeFileSync(join(OUT, "audio.webm"), Buffer.from(audio.base64, "base64"));
  writeFileSync(
    join(OUT, "capture.json"),
    JSON.stringify({ frames, beats, audioStartedAt: audio === null ? null : audio.startedAt / 1000, wif: download.suggestedFilename() }, null, 1),
  );
  expect(frames.length).toBeGreaterThan(100);
  expect(audio).not.toBeNull();
});
