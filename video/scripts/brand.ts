// The JACQUARD logo and the GitHub social preview, as PNG (so they do not depend on fonts on
// GitHub): the app's own mark (apps/web/public/favicon.svg, a punch card) and the wordmark in
// Fraunces, in the app's colours (src/theme.ts). Rendered with Playwright's Chromium.
// Usage, in video/: node scripts/brand.ts   → ../media/brand/
import { chromium } from "@playwright/test";
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { COLOURS } from "../src/theme.ts";

const video = join(dirname(fileURLToPath(import.meta.url)), "..");
const repo = join(video, "..");
const out = join(repo, "media", "brand");
mkdirSync(out, { recursive: true });

// Fonts and the image go in as data URLs: a page set with setContent cannot read file:// URLs.
const dataUrl = (file: string, type: string) => `data:${type};base64,${readFileSync(file).toString("base64")}`;
const font = (path: string) => dataUrl(join(video, "node_modules", path), "font/woff2");
const mark = readFileSync(join(repo, "apps", "web", "public", "favicon.svg"), "utf8");
const cloth = dataUrl(join(repo, "media", "polish", "weave-cloth-peacock-1440.png"), "image/png");

const css = `
@font-face { font-family: "Fraunces"; src: url("${font("@fontsource-variable/fraunces/files/fraunces-latin-full-normal.woff2")}") format("woff2"); font-weight: 100 900; }
@font-face { font-family: "Instrument Sans"; src: url("${font("@fontsource-variable/instrument-sans/files/instrument-sans-latin-wght-normal.woff2")}") format("woff2"); font-weight: 400 700; }
@font-face { font-family: "IBM Plex Mono"; src: url("${font("@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-500-normal.woff2")}") format("woff2"); font-weight: 500; }
* { margin: 0; box-sizing: border-box; }
html, body { background: transparent; }
.logo { display: inline-flex; align-items: center; gap: 28px; padding: 16px 24px; }
.logo svg { width: 132px; height: 132px; }
.word { font-family: "Fraunces"; font-weight: 650; font-size: 112px; letter-spacing: 0.14em; font-variation-settings: "SOFT" 0, "WONK" 1; line-height: 1; }
`;

function logo(colour: string): string {
  return `<div class="logo" id="shot">${mark}<span class="word" style="color:${colour}">JACQUARD</span></div>`;
}

const social = `
<div id="shot" style="width:1280px;height:640px;background:${COLOURS.room};position:relative;overflow:hidden;font-family:'Instrument Sans'">
  <div style="position:absolute;left:80px;top:96px;width:620px">
    <div class="logo" style="padding:0;gap:22px">${mark.replace("<svg ", '<svg style="width:96px;height:96px" ')}<span class="word" style="color:${COLOURS.ink};font-size:76px">JACQUARD</span></div>
    <div style="margin-top:44px;font-size:38px;line-height:1.25;color:${COLOURS.ink}">Punch cards for handlooms: design, check, weave and print jacquard cards.</div>
    <div style="margin-top:36px;font-family:'IBM Plex Mono';font-size:24px;color:${COLOURS.brassStrong}">Built with Kiro · Kiroween 2026</div>
  </div>
  <div style="position:absolute;left:760px;top:96px;width:460px;height:448px;border-radius:14px;overflow:hidden;box-shadow:0 24px 50px -26px rgb(60 40 20 / 0.6);background:url('${cloth}');background-size:1440px auto;background-position:-40px -150px"></div>
</div>`;

const browser = await chromium.launch();
async function shoot(html: string, file: string, scale: number, transparent: boolean): Promise<void> {
  const page = await browser.newPage({ deviceScaleFactor: scale, viewport: { width: 1400, height: 800 } });
  await page.setContent(`<!doctype html><html><head><style>${css}</style></head><body>${html}</body></html>`);
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  const loaded = await page.evaluate(() => document.fonts.check('650 40px "Fraunces"'));
  if (!loaded) throw new Error("Fraunces did not load");
  await page.locator("#shot").screenshot({ path: join(out, file), omitBackground: transparent });
  await page.close();
  console.log(`media/brand/${file}`);
}
await shoot(logo(COLOURS.ink), "jacquard-logo-light.png", 2, true);
await shoot(logo(COLOURS.onPrimary), "jacquard-logo-dark.png", 2, true);
await shoot(social, "social-preview.png", 1, false);
await browser.close();

const thumbnail = join(video, "out", "youtube", "thumbnail.png");
if (existsSync(thumbnail)) {
  copyFileSync(thumbnail, join(out, "demo-thumbnail.png"));
  console.log("media/brand/demo-thumbnail.png");
}
