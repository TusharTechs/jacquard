// Gallery generator (kiro-product Requirement 2; design.md, "Gallery"). Pure and deterministic: no
// clock, no randomness, no file system, no network. `run.mjs` writes the files; the web app's
// gallery test compares them with a fresh `buildGallery()`.
//
// Every motif is made by the stand-in generator because no model was connected (2.5). The card
// format has not been tested on a working loom.
import { PROFILE_120, PROFILE_240, PROFILE_400, autoFix, buildLiftPlan, checkFloats } from "@jacquard/engine";
import type { LiftPlan, LoomProfile, WeaveAssignment } from "@jacquard/engine";
import { motifToDesign, standInMotif } from "@jacquard/motif";
import type { Symmetry } from "@jacquard/motif";
import { defaultWeaves } from "../../apps/web/src/lib/default-weaves";

export type GalleryProfileName = "120" | "240" | "400";

export interface GallerySetup {
  readonly profile: GalleryProfileName;
  readonly colourCount: number;
  readonly repeat: { readonly ends: number; readonly picks: number };
  readonly minFeature: number;
  readonly symmetry: Symmetry;
  readonly repeatAcross: boolean;
}

export interface GalleryInput {
  readonly id: string;
  readonly title: string;
  readonly prompt: string;
  readonly setup: GallerySetup;
}

export interface GalleryExample {
  readonly id: string;
  readonly title: string;
  readonly prompt: string;
  readonly source: "standIn";
  readonly setup: GallerySetup;
  readonly palette: readonly string[];
  readonly design: readonly (readonly number[])[];
  readonly weaves: WeaveAssignment;
  readonly check: { readonly violationsBefore: number; readonly flips: number; readonly violationsAfter: number };
}

export interface GalleryIndexEntry {
  readonly id: string;
  readonly title: string;
  readonly profile: GalleryProfileName;
  readonly ends: number;
  readonly picks: number;
}

export interface GalleryFile {
  /** Relative to `apps/web/public/gallery/`. */
  readonly path: string;
  readonly text: string;
}

/** The four fixed examples of design.md, "Gallery" [decision]. */
export const GALLERY_INPUTS: readonly GalleryInput[] = [
  {
    id: "lotus-border",
    title: "Lotus border",
    prompt: "lotus border",
    setup: { profile: "240", colourCount: 3, repeat: { ends: 48, picks: 48 }, minFeature: 2, symmetry: "mirrorEnds", repeatAcross: false },
  },
  {
    id: "peacock-butta",
    title: "Peacock butta",
    prompt: "peacock butta",
    setup: { profile: "240", colourCount: 4, repeat: { ends: 40, picks: 40 }, minFeature: 2, symmetry: "mirrorEnds", repeatAcross: false },
  },
  {
    id: "temple-stripe",
    title: "Temple stripe",
    prompt: "temple stripe",
    setup: { profile: "120", colourCount: 2, repeat: { ends: 24, picks: 32 }, minFeature: 2, symmetry: "none", repeatAcross: false },
  },
  {
    id: "star-lattice",
    title: "Star lattice",
    prompt: "star lattice",
    setup: { profile: "400", colourCount: 4, repeat: { ends: 50, picks: 50 }, minFeature: 3, symmetry: "mirrorBoth", repeatAcross: false },
  },
];

const PROFILES: Readonly<Record<GalleryProfileName, LoomProfile>> = {
  "120": PROFILE_120,
  "240": PROFILE_240,
  "400": PROFILE_400,
};

/** The engine's built-in profile for a name. */
export function resolveGalleryProfile(name: GalleryProfileName): LoomProfile {
  return PROFILES[name];
}

/** The stand-in motif SVG for an example's prompt and setup. */
export function galleryMotif(input: GalleryInput): string {
  return standInMotif({
    input: { kind: "text", prompt: input.prompt },
    colourCount: input.setup.colourCount,
    symmetry: input.setup.symmetry,
    repeat: input.setup.repeat,
  });
}

function fail(id: string, step: string, error: { code: string; message?: string }): never {
  throw new Error(`gallery example ${id}: ${step} failed with ${error.code}${error.message === undefined ? "" : `: ${error.message}`}`);
}

/** Runs one example through motif, lift plan, float check and auto-fix (2.1, 2.2). */
export function buildExample(input: GalleryInput): GalleryExample {
  const { id, setup } = input;
  const profile = resolveGalleryProfile(setup.profile);
  const motif = motifToDesign(galleryMotif(input), {
    colourCount: setup.colourCount,
    symmetry: setup.symmetry,
    repeat: setup.repeat,
    minFeature: setup.minFeature,
  });
  if (!motif.ok) fail(id, "motifToDesign", motif.error);
  const { design, palette } = motif.value;
  const weaves = defaultWeaves(palette.length);
  const built = buildLiftPlan({ design, weaves, profile, repeatAcross: setup.repeatAcross });
  if (!built.ok) fail(id, "buildLiftPlan", built.error);
  const before = checkFloats(built.value.plan, profile);
  if (!before.ok) fail(id, "checkFloats", before.error);
  let plan: LiftPlan = built.value.plan;
  let flips = 0;
  if (before.value.length > 0) {
    const fixed = autoFix(plan, profile);
    if (!fixed.ok) fail(id, "autoFix", fixed.error);
    plan = fixed.value.plan;
    flips = fixed.value.flips.length;
  }
  const after = checkFloats(plan, profile);
  if (!after.ok) fail(id, "checkFloats after autoFix", after.error);
  return {
    id,
    title: input.title,
    prompt: input.prompt,
    source: "standIn",
    setup,
    palette,
    design,
    weaves,
    check: { violationsBefore: before.value.length, flips, violationsAfter: after.value.length },
  };
}

/** Sorts object keys at every level so the output does not depend on construction order. */
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) out[key] = canonical((value as Record<string, unknown>)[key]);
    return out;
  }
  return value;
}

function isPrimitive(value: unknown): boolean {
  return value === null || typeof value !== "object";
}

/**
 * Canonical JSON text: sorted keys, 2-space indent, trailing newline. An array whose items are all
 * primitives is written on one line (one design row per line) [decision], so diffs stay readable.
 */
export function canonicalJson(value: unknown): string {
  const write = (inner: unknown, indent: string): string => {
    if (isPrimitive(inner)) return JSON.stringify(inner);
    const next = `${indent}  `;
    if (Array.isArray(inner)) {
      if (inner.length === 0) return "[]";
      if (inner.every(isPrimitive)) return `[${inner.map((item) => JSON.stringify(item)).join(", ")}]`;
      return `[\n${inner.map((item) => `${next}${write(item, next)}`).join(",\n")}\n${indent}]`;
    }
    const entries = Object.entries(inner as Record<string, unknown>);
    if (entries.length === 0) return "{}";
    return `{\n${entries.map(([key, item]) => `${next}${JSON.stringify(key)}: ${write(item, next)}`).join(",\n")}\n${indent}}`;
  };
  return `${write(canonical(value), "")}\n`;
}

/** Every gallery file: one per example, then `index.json` (2.1, 2.3). */
export function buildGallery(): GalleryFile[] {
  const examples = GALLERY_INPUTS.map(buildExample);
  const index: GalleryIndexEntry[] = examples.map((example) => ({
    id: example.id,
    title: example.title,
    profile: example.setup.profile,
    ends: example.setup.repeat.ends,
    picks: example.setup.repeat.picks,
  }));
  return [
    ...examples.map((example) => ({ path: `${example.id}.json`, text: canonicalJson(example) })),
    { path: "index.json", text: canonicalJson(index) },
  ];
}
