// The README's two diagrams as PNG, light and dark, from media/brand/*.mmd (the one source of truth),
// in the app's colours (src/theme.ts) and Instrument Sans. GitHub draws Mermaid in a frame too short
// for them, so the README shows these images and keeps the Mermaid code in a collapsed block.
// Usage, in video/: npm install --prefix /tmp/mmd mermaid@12.3.0 && MERMAID_JS=/tmp/mmd/node_modules/mermaid/dist/mermaid.min.js node scripts/diagrams.ts
import { chromium } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { COLOURS } from "../src/theme.ts";

const video = join(dirname(fileURLToPath(import.meta.url)), "..");
const brand = join(video, "..", "media", "brand");
const mermaidJs = process.env.MERMAID_JS ?? "";
if (!existsSync(mermaidJs)) throw new Error("Set MERMAID_JS to mermaid.min.js from a mermaid install outside the repo (see Usage).");

const fontUrl = `data:font/woff2;base64,${readFileSync(
  join(video, "node_modules", "@fontsource-variable/instrument-sans/files/instrument-sans-latin-wght-normal.woff2"),
).toString("base64")}`;

interface Palette {
  readonly background: string;
  readonly frame: string;
  readonly cluster: string;
  readonly clusterBorder: string;
  readonly node: string;
  readonly nodeBorder: string;
  readonly text: string;
  readonly line: string;
}
const PALETTES: Readonly<Record<"light" | "dark", Palette>> = {
  light: {
    background: COLOURS.paper,
    frame: COLOURS.line,
    cluster: COLOURS.surface,
    clusterBorder: COLOURS.lineStrong,
    node: COLOURS.raised,
    nodeBorder: COLOURS.walnut,
    text: COLOURS.ink,
    line: COLOURS.walnut,
  },
  dark: {
    background: COLOURS.ink,
    frame: COLOURS.walnut,
    cluster: COLOURS.primary,
    clusterBorder: COLOURS.brass,
    node: COLOURS.walnut,
    nodeBorder: COLOURS.lineStrong,
    text: COLOURS.onPrimary,
    line: COLOURS.line,
  },
};

const browser = await chromium.launch();
for (const name of ["architecture", "data-flow"]) {
  const source = readFileSync(join(brand, `${name}.mmd`), "utf8");
  for (const [mode, p] of Object.entries(PALETTES)) {
    const page = await browser.newPage({ deviceScaleFactor: 2, viewport: { width: 1200, height: 900 } });
    await page.setContent(`<!doctype html><html><head><style>
      @font-face { font-family: "Instrument Sans"; src: url("${fontUrl}") format("woff2"); font-weight: 400 700; }
      * { margin: 0; } html, body { background: transparent; }
      #shot { display: inline-block; padding: 28px 32px; border-radius: 16px; background: ${p.background}; border: 2px solid ${p.frame}; }
      #shot svg { display: block; }
      #shot svg * { filter: none !important; }
    </style></head><body><div id="shot"></div></body></html>`);
    await page.addScriptTag({ content: readFileSync(mermaidJs, "utf8") });
    const svgOk = await page.evaluate(
      async ({ source, p }) => {
        await document.fonts.load('500 17px "Instrument Sans"');
        if (!document.fonts.check('500 17px "Instrument Sans"')) return "font";
        const mermaid = (window as unknown as { mermaid: any }).mermaid;
        mermaid.initialize({
          startOnLoad: false,
          theme: "base",
          flowchart: { useMaxWidth: false, htmlLabels: true, nodeSpacing: 30, rankSpacing: 40, padding: 12, wrappingWidth: 400, curve: "basis" },
          themeVariables: {
            fontFamily: '"Instrument Sans"',
            fontSize: "17px",
            background: p.background,
            primaryColor: p.node,
            mainBkg: p.node,
            primaryTextColor: p.text,
            nodeTextColor: p.text,
            primaryBorderColor: p.nodeBorder,
            nodeBorder: p.nodeBorder,
            lineColor: p.line,
            clusterBkg: p.cluster,
            clusterBorder: p.clusterBorder,
            titleColor: p.text,
            edgeLabelBackground: p.background,
            textColor: p.text,
          },
        });
        const { svg } = await mermaid.render("diagram", source);
        document.getElementById("shot")!.innerHTML = svg;
        return "ok";
      },
      { source, p },
    );
    if (svgOk !== "ok") throw new Error(`Instrument Sans did not load (${name}, ${mode})`);
    const file = `${name}-${mode}.png`;
    await page.locator("#shot").screenshot({ path: join(brand, file), omitBackground: true });
    const box = await page.locator("#shot").boundingBox();
    console.log(`media/brand/${file}  ${Math.round((box?.width ?? 0) * 2)}x${Math.round((box?.height ?? 0) * 2)}`);
    await page.close();
  }
}
await browser.close();
