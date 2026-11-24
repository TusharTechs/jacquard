// The video uses the app's tokens (demo-video 6.1): every colour and font stack in src/theme.ts
// equals the value in apps/web/src/styles.css.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { COLOURS, CSS_NAMES, FONTS } from "../src/theme.ts";

const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "..", "apps", "web", "src", "styles.css"), "utf8");

function cssValue(name: string): string {
  const match = new RegExp(`${name.replace(/-/g, "\\-")}:\\s*([^;]+);`).exec(css);
  if (match === null) throw new Error(`${name} not in styles.css`);
  return match[1]!.trim();
}

describe("theme", () => {
  it("uses the app's colour tokens", () => {
    for (const [key, value] of Object.entries(COLOURS)) {
      expect(cssValue(CSS_NAMES[key as keyof typeof COLOURS]), key).toBe(value);
    }
  });
  it("uses the app's font stacks", () => {
    expect(cssValue("--font-display")).toBe(FONTS.display);
    expect(cssValue("--font-sans")).toBe(FONTS.sans);
    expect(cssValue("--font-mono")).toBe(FONTS.mono);
  });
});
