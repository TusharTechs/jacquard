// Gallery snapshot (kiro-product 2.2 to 2.5): a fresh buildGallery() equals the committed files byte
// for byte, every example ends with zero float violations, and every motif is labelled a stand-in.
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildGallery } from "../../../scripts/gallery/generate";

const here = dirname(fileURLToPath(import.meta.url));
const galleryDir = join(here, "..", "public", "gallery");
const IDS = ["lotus-border", "peacock-butta", "temple-stripe", "star-lattice"];

const files = buildGallery();

interface Example {
  readonly id: string;
  readonly source: string;
  readonly check: { readonly violationsBefore: number; readonly flips: number; readonly violationsAfter: number };
}

describe("gallery", () => {
  it("matches the committed files byte for byte (2.3, 2.4)", () => {
    const committed = readdirSync(galleryDir).filter((name) => name.endsWith(".json")).sort();
    expect(committed).toEqual(files.map((file) => file.path).sort());
    for (const file of files) {
      const text = readFileSync(join(galleryDir, file.path), "utf8");
      expect(text, `${file.path} differs from a fresh run; run pnpm gallery`).toBe(file.text);
    }
  });

  it("is the same on a second run (2.3)", () => {
    expect(buildGallery()).toEqual(files);
  });

  it("lists all four examples in index.json", () => {
    const index = JSON.parse(readFileSync(join(galleryDir, "index.json"), "utf8")) as { id: string }[];
    expect(index.map((entry) => entry.id)).toEqual(IDS);
  });

  for (const id of IDS) {
    it(`${id}: zero violations after auto-fix, motif from the stand-in (2.2, 2.5)`, () => {
      const example = JSON.parse(readFileSync(join(galleryDir, `${id}.json`), "utf8")) as Example;
      expect(example.id).toBe(id);
      expect(example.source).toBe("standIn");
      expect(example.check.violationsAfter).toBe(0);
      if (example.check.violationsBefore === 0) expect(example.check.flips).toBe(0);
    });
  }
});
