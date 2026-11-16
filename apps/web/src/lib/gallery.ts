// Gallery loading (Phase G). The gallery files are static JSON under `public/gallery/`, written by
// `scripts/gallery/generate.ts`. Everything fetched is checked here, at the boundary, before it
// reaches the editor or the engine. The `check` field of an example is ignored: the app runs its
// own float check on whatever is on the grid. Every gallery motif was made by the stand-in
// generator, not a model.
import type { Design, Weave, WeaveAssignment } from "@jacquard/engine";
import type { Symmetry } from "@jacquard/motif";
import { PROFILE_NAMES, SYMMETRIES } from "../state/setup-state";
import { WEAVE_SLOTS, defaultWeaves } from "./default-weaves";
import type { ProfileName, SetupState } from "../state/setup-state";

export interface GalleryIndexEntry {
  readonly id: string;
  readonly title: string;
  readonly profile: ProfileName;
  readonly ends: number;
  readonly picks: number;
}

export interface GalleryExample {
  readonly id: string;
  readonly title: string;
  readonly setup: SetupState;
  readonly palette: readonly string[];
  readonly design: Design;
  readonly weaves: WeaveAssignment;
}

/** The weaves an opened example uses: the app's defaults with the example's weaves on top. */
export function exampleWeaves(example: GalleryExample): WeaveAssignment {
  return { ...defaultWeaves(WEAVE_SLOTS), ...example.weaves };
}

export class GalleryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GalleryError";
  }
}

type Fetch = (input: string, init?: { signal?: AbortSignal }) => Promise<Response>;

/** `import.meta.env.BASE_URL` with a trailing slash ("/" when Vite does not provide one). */
export function galleryBase(): string {
  const base: string = import.meta.env.BASE_URL ?? "/";
  return `${base.endsWith("/") ? base : `${base}/`}gallery/`;
}

const ID = /^[a-z0-9][a-z0-9-]*$/;
const HEX6 = /^#[0-9a-f]{6}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isNonNegativeInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isPositiveInt(value: unknown): value is number {
  return isNonNegativeInt(value) && value > 0;
}

function isProfile(value: unknown): value is ProfileName {
  return typeof value === "string" && (PROFILE_NAMES as readonly string[]).includes(value);
}

function isSymmetry(value: unknown): value is Symmetry {
  return typeof value === "string" && (SYMMETRIES as readonly string[]).includes(value);
}

function fail(what: string): never {
  throw new GalleryError(`The gallery file is not in the expected shape: ${what}.`);
}

export function parseGalleryIndex(value: unknown): GalleryIndexEntry[] {
  if (!Array.isArray(value)) fail("the index is not a list of examples");
  return value.map((entry, position) => {
    if (!isRecord(entry)) fail(`index entry ${position} is not an object`);
    const { id, title, profile, ends, picks } = entry;
    if (typeof id !== "string" || !ID.test(id)) fail(`index entry ${position} has no valid id`);
    if (typeof title !== "string" || title.trim() === "") fail(`index entry ${position} has no title`);
    if (!isProfile(profile)) fail(`index entry ${position} has an unknown profile`);
    if (!isPositiveInt(ends) || !isPositiveInt(picks)) fail(`index entry ${position} has no valid size`);
    return { id, title, profile, ends, picks };
  });
}

function parseSetup(value: unknown): SetupState {
  if (!isRecord(value)) fail("setup is not an object");
  const { profile, colourCount, repeat, minFeature, symmetry, repeatAcross } = value;
  if (!isProfile(profile)) fail('setup.profile is not "120", "240" or "400"');
  if (!isPositiveInt(colourCount)) fail("setup.colourCount is not a positive whole number");
  if (!isRecord(repeat) || !isPositiveInt(repeat.ends) || !isPositiveInt(repeat.picks)) fail("setup.repeat is not a size");
  if (!isPositiveInt(minFeature)) fail("setup.minFeature is not a positive whole number");
  if (!isSymmetry(symmetry)) fail("setup.symmetry is not a known symmetry");
  if (typeof repeatAcross !== "boolean") fail("setup.repeatAcross is not true or false");
  return { profile, colourCount, repeat: { ends: repeat.ends, picks: repeat.picks }, minFeature, symmetry, repeatAcross };
}

function parseDesign(value: unknown): number[][] {
  if (!Array.isArray(value) || value.length === 0) fail("design is not a list of picks");
  let width = -1;
  return value.map((row, pick) => {
    if (!Array.isArray(row) || row.length === 0) fail(`design pick ${pick} is not a list of cells`);
    if (width === -1) width = row.length;
    else if (row.length !== width) fail("design is not rectangular");
    if (!row.every(isNonNegativeInt)) fail(`design pick ${pick} has a cell that is not a non-negative whole number`);
    return [...row];
  });
}

/** Region keys must be whole numbers; each weave must be an object with a `kind`. The engine checks the rest. */
function parseWeaves(value: unknown): WeaveAssignment {
  if (!isRecord(value)) fail("weaves is not an object");
  const weaves: Record<number, Weave> = {};
  for (const [key, weave] of Object.entries(value)) {
    if (!/^(0|[1-9]\d*)$/.test(key)) fail(`weaves has a region key "${key}" that is not a whole number`);
    if (!isRecord(weave) || typeof weave.kind !== "string") fail(`the weave of region ${key} is not a weave`);
    weaves[Number(key)] = weave as unknown as Weave;
  }
  return weaves;
}

export function parseGalleryExample(value: unknown): GalleryExample {
  if (!isRecord(value)) fail("the example is not an object");
  const { id, title, setup, palette, design, weaves } = value;
  if (typeof id !== "string" || !ID.test(id)) fail("the example has no valid id");
  if (typeof title !== "string" || title.trim() === "") fail("the example has no title");
  const parsedSetup = parseSetup(setup);
  if (!Array.isArray(palette) || palette.length === 0 || !palette.every((colour) => typeof colour === "string" && HEX6.test(colour))) {
    fail("palette is not a list of #rrggbb colours");
  }
  const parsedDesign = parseDesign(design);
  if (parsedDesign.length !== parsedSetup.repeat.picks || parsedDesign[0]!.length !== parsedSetup.repeat.ends) {
    fail("design size does not match setup.repeat");
  }
  if (parsedDesign.some((row) => row.some((cell) => cell >= palette.length))) fail("design uses a region with no palette colour");
  return {
    id,
    title,
    setup: parsedSetup,
    palette: palette.map((colour: string) => colour.toLowerCase()),
    design: parsedDesign,
    weaves: parseWeaves(weaves),
  };
}

async function getJson(fetcher: Fetch, url: string, signal: AbortSignal | undefined): Promise<unknown> {
  let response: Response;
  try {
    response = await fetcher(url, signal === undefined ? undefined : { signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new GalleryError("The gallery could not be reached.");
  }
  if (!response.ok) throw new GalleryError(`The gallery file answered with status ${response.status}.`);
  try {
    return (await response.json()) as unknown;
  } catch {
    throw new GalleryError("The gallery file is not valid JSON.");
  }
}

export interface LoadedGallery {
  readonly entries: readonly GalleryIndexEntry[];
  readonly examples: ReadonlyMap<string, GalleryExample>;
}

/** Fetches the index, then each example it lists. Any failure rejects with a GalleryError. */
export async function loadGallery(options: { readonly signal?: AbortSignal; readonly fetcher?: Fetch } = {}): Promise<LoadedGallery> {
  const fetcher: Fetch = options.fetcher ?? ((input, init) => fetch(input, init));
  const base = galleryBase();
  const entries = parseGalleryIndex(await getJson(fetcher, `${base}index.json`, options.signal));
  const examples = await Promise.all(
    entries.map(async (entry) => {
      const example = parseGalleryExample(await getJson(fetcher, `${base}${entry.id}.json`, options.signal));
      if (example.id !== entry.id) fail(`example ${entry.id} has the id ${example.id}`);
      return example;
    }),
  );
  return { entries, examples: new Map(examples.map((example) => [example.id, example])) };
}
