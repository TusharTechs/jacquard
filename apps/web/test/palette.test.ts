// Region display colours and label contrast.
import { describe, expect, it } from "vitest";
import { DARK_TEXT, DEFAULT_REGION_COLOURS, LIGHT_TEXT, contrastText, regionColours } from "../src/lib/palette";

describe("palette", () => {
  it("uses the motif palette, normalised, and the defaults past its end", () => {
    expect(regionColours(["#FFF", "#8C2F39"], 3)).toEqual(["#ffffff", "#8c2f39", DEFAULT_REGION_COLOURS[2]]);
  });

  it("uses the 8 default colours without a motif palette", () => {
    expect(DEFAULT_REGION_COLOURS).toHaveLength(8);
    expect(regionColours(null, 8)).toEqual(DEFAULT_REGION_COLOURS);
  });

  it("picks legible label text", () => {
    expect(contrastText("#ffffff")).toBe(DARK_TEXT);
    expect(contrastText("#f3ead8")).toBe(DARK_TEXT);
    expect(contrastText("#000000")).toBe(LIGHT_TEXT);
    expect(contrastText("#2f4b7c")).toBe(LIGHT_TEXT);
  });
});
