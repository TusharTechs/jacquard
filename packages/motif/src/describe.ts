// Description to Motif_Plan (motif-builder Requirement 1). See motif-builder design.md, "src/describe.ts".
//
// A small, fixed grammar: one subject, an optional count, symmetry, size, layout, ground and up to
// four colours by name. The text is read once from left to right, trying three-word, then two-word,
// then one-word phrases against fixed tables. Pure and total: any text gives a plan, the same text
// and options give an equal result, and nothing here reads a clock, randomness or the network.
import type { Symmetry } from "./types.js";

export type BuilderSubject =
  | "lotus"
  | "peacock"
  | "star"
  | "diamond"
  | "paisley"
  | "rosette"
  | "tree"
  | "elephant"
  | "border"
  | "stripe"
  | "check"
  | "lattice";
export type BuilderLayout = "single" | "border" | "allOver";
export type BuilderSize = "small" | "medium" | "large";

export interface BuilderColour {
  readonly name: string;
  /** Lower-case `#rrggbb`. */
  readonly hex: string;
}

/** What the builder draws (motif-builder glossary, Motif_Plan). */
export interface MotifPlan {
  readonly subject: BuilderSubject;
  /** Petals, points, stripes, bands, teeth or cells; null when the subject has no count. */
  readonly count: number | null;
  readonly layout: BuilderLayout;
  readonly size: BuilderSize;
  readonly symmetry: Symmetry;
  /** 2 to 4 distinct colours; entry 0 is the ground. */
  readonly colours: readonly BuilderColour[];
}

/** Chip edits (1.7): each one replaces what the text says. */
export interface PlanOverrides {
  readonly subject?: BuilderSubject;
  readonly count?: number;
  readonly layout?: BuilderLayout;
  readonly size?: BuilderSize;
  readonly symmetry?: Symmetry;
  /** A colour name from BUILDER_COLOURS. */
  readonly ground?: string;
  readonly colourCount?: number;
}

export interface MotifDescription {
  readonly plan: MotifPlan;
  /** Phrases that changed the plan, in text order, as written (lower case). */
  readonly understood: readonly string[];
  /** Words that changed nothing and are not filler, in text order, without repeats. */
  readonly unused: readonly string[];
  /** True when no subject word was found and the plan is a rosette (1.3). */
  readonly fellBack: boolean;
  /** Clamps, dropped colours and ignored subjects, in plain words. */
  readonly notes: readonly string[];
}

export interface DescribeOptions {
  /** The loom setup's colour count, used when fewer than two colours are named (1.6). */
  readonly colourCount: number;
  /** The profile's region limit; the plan never has more colours. Default 4. */
  readonly maxColours?: number;
  readonly overrides?: PlanOverrides;
}

export const BUILDER_SUBJECTS: readonly BuilderSubject[] = [
  "lotus",
  "peacock",
  "star",
  "diamond",
  "paisley",
  "rosette",
  "tree",
  "elephant",
  "border",
  "stripe",
  "check",
  "lattice",
];
export const BUILDER_LAYOUTS: readonly BuilderLayout[] = ["single", "border", "allOver"];
export const BUILDER_SIZES: readonly BuilderSize[] = ["small", "medium", "large"];
export const BUILDER_SYMMETRIES: readonly Symmetry[] = ["none", "mirrorEnds", "mirrorPicks", "mirrorBoth"];

/** Figures placed by layout and size; the others fill the repeat (2.4). */
export const FIGURE_SUBJECTS: ReadonlySet<BuilderSubject> = new Set<BuilderSubject>([
  "lotus",
  "peacock",
  "star",
  "diamond",
  "paisley",
  "rosette",
  "tree",
  "elephant",
]);

/** Subjects not symmetric about their own centre (glossary, Asymmetric_Subject). */
export const ASYMMETRIC_SUBJECTS: ReadonlySet<BuilderSubject> = new Set<BuilderSubject>(["paisley", "elephant", "peacock"]);

/** The symmetry a subject gets when the text names none (1.5) [decision]. */
export const SUBJECT_SYMMETRY: Readonly<Record<BuilderSubject, Symmetry>> = {
  lotus: "mirrorBoth",
  peacock: "none",
  star: "mirrorBoth",
  diamond: "mirrorBoth",
  paisley: "none",
  rosette: "mirrorBoth",
  tree: "mirrorEnds",
  elephant: "none",
  border: "mirrorEnds",
  stripe: "mirrorBoth",
  check: "mirrorBoth",
  lattice: "mirrorBoth",
};

export interface CountRange {
  readonly min: number;
  readonly max: number;
  readonly fallback: number;
  /** The noun the chip shows: "petals", "points" … */
  readonly noun: string;
}

/** Count ranges per subject [decision]; subjects missing here have no count. */
export const COUNT_RANGES: Readonly<Partial<Record<BuilderSubject, CountRange>>> = {
  lotus: { min: 3, max: 12, fallback: 8, noun: "petals" },
  rosette: { min: 4, max: 12, fallback: 8, noun: "petals" },
  star: { min: 4, max: 12, fallback: 8, noun: "points" },
  stripe: { min: 1, max: 6, fallback: 3, noun: "stripes" },
  check: { min: 1, max: 4, fallback: 2, noun: "bands" },
  border: { min: 2, max: 12, fallback: 4, noun: "teeth" },
  lattice: { min: 1, max: 4, fallback: 2, noun: "cells" },
};

/** Yarn-like colours with fixed values [decision]. The first name is the one shown. */
export const BUILDER_COLOURS: readonly BuilderColour[] = [
  { name: "cream", hex: "#f2e8d5" },
  { name: "white", hex: "#faf7f0" },
  { name: "black", hex: "#1f1a17" },
  { name: "grey", hex: "#8a8580" },
  { name: "red", hex: "#b0302a" },
  { name: "maroon", hex: "#7a1f2b" },
  { name: "pink", hex: "#d9738a" },
  { name: "orange", hex: "#d9642b" },
  { name: "saffron", hex: "#e8942a" },
  { name: "yellow", hex: "#e2b93b" },
  { name: "gold", hex: "#c9a23a" },
  { name: "green", hex: "#2f6b4f" },
  { name: "sage", hex: "#9cc5a1" },
  { name: "olive", hex: "#6b6b2a" },
  { name: "teal", hex: "#1f6f6f" },
  { name: "blue", hex: "#2c5aa0" },
  { name: "indigo", hex: "#1e3a5f" },
  { name: "sky", hex: "#a8c8e0" },
  { name: "purple", hex: "#5b3f7a" },
  { name: "brown", hex: "#6b4226" },
];

/** Other names for colours. */
const COLOUR_ALIASES: Readonly<Record<string, string>> = {
  ivory: "cream",
  natural: "cream",
  undyed: "cream",
  beige: "cream",
  "off white": "cream",
  offwhite: "cream",
  charcoal: "black",
  gray: "grey",
  silver: "grey",
  crimson: "red",
  scarlet: "red",
  vermilion: "red",
  madder: "maroon",
  wine: "maroon",
  burgundy: "maroon",
  rose: "pink",
  rust: "orange",
  turmeric: "yellow",
  mustard: "yellow",
  golden: "gold",
  zari: "gold",
  emerald: "green",
  parrot: "green",
  turquoise: "teal",
  cyan: "teal",
  navy: "indigo",
  violet: "purple",
  aubergine: "purple",
  lilac: "purple",
  walnut: "brown",
  chocolate: "brown",
  sky: "sky",
};

/** Each subject's own yarn colours for roles 1 to 3 [decision]. */
const SUBJECT_COLOURS: Readonly<Record<BuilderSubject, readonly string[]>> = {
  lotus: ["pink", "maroon", "yellow"],
  peacock: ["teal", "indigo", "gold"],
  star: ["indigo", "gold", "red"],
  diamond: ["maroon", "indigo", "gold"],
  paisley: ["maroon", "gold", "indigo"],
  rosette: ["maroon", "gold", "green"],
  tree: ["green", "brown", "red"],
  elephant: ["grey", "maroon", "gold"],
  border: ["maroon", "gold", "indigo"],
  stripe: ["indigo", "maroon", "gold"],
  check: ["indigo", "maroon", "gold"],
  lattice: ["green", "maroon", "gold"],
};

const SUBJECT_WORDS: Readonly<Record<string, BuilderSubject>> = {
  lotus: "lotus",
  kamal: "lotus",
  "water lily": "lotus",
  peacock: "peacock",
  peahen: "peacock",
  mor: "peacock",
  star: "star",
  diamond: "diamond",
  lozenge: "diamond",
  rhombus: "diamond",
  paisley: "paisley",
  kalga: "paisley",
  kalka: "paisley",
  mango: "paisley",
  ambi: "paisley",
  keri: "paisley",
  rosette: "rosette",
  flower: "rosette",
  floral: "rosette",
  blossom: "rosette",
  phool: "rosette",
  "tree of life": "tree",
  tree: "tree",
  elephant: "elephant",
  hathi: "elephant",
  haathi: "elephant",
  border: "border",
  stripe: "stripe",
  striped: "stripe",
  check: "check",
  checked: "check",
  checks: "check",
  chequered: "check",
  checkered: "check",
  gingham: "check",
  lattice: "lattice",
  jaal: "lattice",
  jali: "lattice",
  trellis: "lattice",
};

const NUMBER_WORDS: Readonly<Record<string, number>> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
};

/** Count nouns and the subjects they fit. */
const COUNT_NOUNS: Readonly<Record<string, readonly BuilderSubject[]>> = {
  petal: ["lotus", "rosette"],
  petalled: ["lotus", "rosette"],
  petaled: ["lotus", "rosette"],
  point: ["star"],
  pointed: ["star"],
  arm: ["star"],
  ray: ["star"],
  stripe: ["stripe"],
  band: ["stripe", "check"],
  tooth: ["border"],
  teeth: ["border"],
  cell: ["lattice"],
};

const SYMMETRY_WORDS: Readonly<Record<string, Symmetry>> = {
  mirror: "mirrorEnds",
  mirrored: "mirrorEnds",
  symmetric: "mirrorEnds",
  symmetrical: "mirrorEnds",
  pair: "mirrorEnds",
  facing: "mirrorEnds",
  "two way": "mirrorEnds",
  "four way": "mirrorBoth",
  "4 way": "mirrorBoth",
  fourfold: "mirrorBoth",
  "four fold": "mirrorBoth",
  "4 fold": "mirrorBoth",
  quartered: "mirrorBoth",
  radial: "mirrorBoth",
  "top to bottom": "mirrorPicks",
  "up and down": "mirrorPicks",
  asymmetric: "none",
  asymmetrical: "none",
  "no symmetry": "none",
  "not symmetric": "none",
};

const SIZE_WORDS: Readonly<Record<string, BuilderSize>> = {
  small: "small",
  tiny: "small",
  little: "small",
  mini: "small",
  medium: "medium",
  large: "large",
  big: "large",
  bold: "large",
  huge: "large",
};

const LAYOUT_WORDS: Readonly<Record<string, BuilderLayout>> = {
  single: "single",
  butta: "single",
  buta: "single",
  central: "single",
  centred: "single",
  centered: "single",
  medallion: "single",
  border: "border",
  edge: "border",
  band: "border",
  "all over": "allOver",
  allover: "allOver",
  repeat: "allOver",
  repeating: "allOver",
  repeated: "allOver",
  scattered: "allOver",
};

const GROUND_WORDS: ReadonlySet<string> = new Set(["ground", "background", "base"]);

/** Words that are neither understood nor reported as unused [decision]. */
const FILLER: ReadonlySet<string> = new Set([
  "a",
  "an",
  "the",
  "with",
  "on",
  "of",
  "and",
  "in",
  "at",
  "for",
  "to",
  "its",
  "it",
  "is",
  "are",
  "has",
  "have",
  "having",
  "that",
  "this",
  "some",
  "my",
  "me",
  "make",
  "draw",
  "please",
  "motif",
  "design",
  "pattern",
  "cloth",
  "fabric",
  "saree",
  "sari",
  "woven",
  "weave",
  "like",
  "style",
  "traditional",
  "indian",
  "simple",
  "nice",
  "beautiful",
  "pretty",
  "plain",
  "colour",
  "colours",
  "color",
  "colors",
  "coloured",
  "colored",
  "in",
  "by",
  "set",
  "one",
]);

/** At most this many tokens are read, so the work stays bounded [decision]. */
const MAX_TOKENS = 200;
/** Colours per plan (1.6). */
const MIN_COLOURS = 2;
const MAX_COLOURS = 4;

const COLOUR_BY_NAME: ReadonlyMap<string, BuilderColour> = new Map(BUILDER_COLOURS.map((colour) => [colour.name, colour]));

function tokenize(text: string): string[] {
  const lower = text.toLowerCase();
  const tokens: string[] = [];
  let current = "";
  for (let index = 0; index < lower.length && tokens.length < MAX_TOKENS; index += 1) {
    const code = lower.charCodeAt(index);
    const isWord = (code >= 0x61 && code <= 0x7a) || (code >= 0x30 && code <= 0x39);
    if (isWord) {
      current += lower[index] as string;
    } else if (current !== "") {
      tokens.push(current);
      current = "";
    }
  }
  if (current !== "" && tokens.length < MAX_TOKENS) tokens.push(current);
  return tokens;
}

/** The table key for a word or phrase, trying the word as written, then without "es" or "s". */
function lookup<T>(table: Readonly<Record<string, T>>, phrase: string): T | undefined {
  if (Object.prototype.hasOwnProperty.call(table, phrase)) return table[phrase];
  for (const suffix of ["es", "s"]) {
    if (phrase.endsWith(suffix) && phrase.length > suffix.length + 2) {
      const bare = phrase.slice(0, -suffix.length);
      if (Object.prototype.hasOwnProperty.call(table, bare)) return table[bare];
    }
  }
  return undefined;
}

function colourOf(phrase: string): BuilderColour | undefined {
  const direct = COLOUR_BY_NAME.get(phrase);
  if (direct !== undefined) return direct;
  const alias = Object.prototype.hasOwnProperty.call(COLOUR_ALIASES, phrase) ? COLOUR_ALIASES[phrase] : undefined;
  return alias === undefined ? undefined : COLOUR_BY_NAME.get(alias);
}

function numberOf(token: string): number | undefined {
  if (Object.prototype.hasOwnProperty.call(NUMBER_WORDS, token)) return NUMBER_WORDS[token];
  if (/^[0-9]{1,3}$/.test(token)) return Number(token);
  return undefined;
}

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function isKnown<T>(list: readonly T[], value: unknown): value is T {
  return (list as readonly unknown[]).includes(value);
}

interface Reading {
  subject: BuilderSubject | null;
  subjectPhrase: string;
  count: { value: number; phrase: string; noun: string } | null;
  symmetry: Symmetry | null;
  size: BuilderSize | null;
  layout: BuilderLayout | null;
  ground: BuilderColour | null;
  figureColours: BuilderColour[];
  understood: string[];
  unused: string[];
  notes: string[];
  pairWithTwo: boolean;
}

/** Reads the tokens into a Reading. Each token is consumed by at most one phrase. */
function read(tokens: readonly string[]): Reading {
  const reading: Reading = {
    subject: null,
    subjectPhrase: "",
    count: null,
    symmetry: null,
    size: null,
    layout: null,
    ground: null,
    figureColours: [],
    understood: [],
    unused: [],
    notes: [],
    pairWithTwo: false,
  };
  const used = tokens.map(() => false);
  const found: { subject: BuilderSubject; phrase: string }[] = [];
  const phraseAt = (start: number, length: number): string | null =>
    start + length <= tokens.length ? tokens.slice(start, start + length).join(" ") : null;
  const markUsed = (start: number, length: number): void => {
    for (let index = start; index < start + length; index += 1) used[index] = true;
  };

  // Counts first: "<number> [word] <count noun>", so "eight point star" keeps "eight" for the count.
  const counts: { start: number; value: number; nounIndex: number; noun: string }[] = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const value = numberOf(tokens[index] as string);
    if (value === undefined) continue;
    for (let gap = 1; gap <= 2 && index + gap < tokens.length; gap += 1) {
      const noun = tokens[index + gap] as string;
      const fits = lookup(COUNT_NOUNS, noun);
      if (fits !== undefined) {
        counts.push({ start: index, value, nounIndex: index + gap, noun });
        break;
      }
    }
  }

  for (let index = 0; index < tokens.length; index += 1) {
    if (used[index]) continue;
    let matched = false;
    for (const length of [3, 2, 1]) {
      const phrase = phraseAt(index, length);
      if (phrase === null) continue;
      // Ground: "<colour> ground", "<colour> background".
      if (length >= 2) {
        const last = tokens[index + length - 1] as string;
        const head = tokens.slice(index, index + length - 1).join(" ");
        const colour = GROUND_WORDS.has(last) ? colourOf(head) : undefined;
        if (colour !== undefined) {
          reading.ground = colour;
          reading.understood.push(phrase);
          markUsed(index, length);
          matched = true;
          break;
        }
      }
      if (length === 2 && phrase.startsWith("plain ") && GROUND_WORDS.has(tokens[index + 1] as string)) {
        reading.understood.push(phrase);
        markUsed(index, length);
        matched = true;
        break;
      }
      const subject = lookup(SUBJECT_WORDS, phrase);
      if (subject !== undefined) {
        found.push({ subject, phrase });
        reading.understood.push(phrase);
        if (subject === "border" && reading.layout === null) reading.layout = "border";
        markUsed(index, length);
        matched = true;
        break;
      }
      const symmetry = lookup(SYMMETRY_WORDS, phrase);
      if (symmetry !== undefined) {
        reading.symmetry = symmetry;
        reading.understood.push(phrase);
        markUsed(index, length);
        matched = true;
        break;
      }
      const layout = lookup(LAYOUT_WORDS, phrase);
      if (layout !== undefined) {
        reading.layout = layout;
        reading.understood.push(phrase);
        markUsed(index, length);
        matched = true;
        break;
      }
      if (length === 1) {
        const size = lookup(SIZE_WORDS, phrase);
        if (size !== undefined) {
          reading.size = size;
          reading.understood.push(phrase);
          markUsed(index, 1);
          matched = true;
          break;
        }
      }
      const colour = colourOf(phrase);
      if (colour !== undefined) {
        // "on red" is the ground; any other colour is a figure colour.
        if (index > 0 && tokens[index - 1] === "on" && reading.ground === null) reading.ground = colour;
        else reading.figureColours.push(colour);
        reading.understood.push(phrase);
        markUsed(index, length);
        matched = true;
        break;
      }
      if (length === 1) {
        const count = counts.find((candidate) => candidate.start === index);
        if (count !== undefined) {
          // Decided after the subject is known; mark both tokens now so they are not unused.
          // A noun that is also a subject ("five stripes") is read again as the subject.
          used[index] = true;
          if (lookup(SUBJECT_WORDS, count.noun) === undefined) used[count.nounIndex] = true;
          matched = true;
          break;
        }
        // "two peacocks": a facing pair.
        if (tokens[index] === "two" || tokens[index] === "2") {
          const next = tokens[index + 1];
          if (next !== undefined && lookup(SUBJECT_WORDS, next) !== undefined) {
            reading.pairWithTwo = true;
            reading.understood.push(`${tokens[index] as string} ${next}`);
            used[index] = true;
            matched = true;
            break;
          }
        }
      }
    }
    if (!matched && !used[index]) {
      const token = tokens[index] as string;
      if (!FILLER.has(token) && !GROUND_WORDS.has(token) && !reading.unused.includes(token)) reading.unused.push(token);
      used[index] = true;
    }
  }
  // The subject (1.1): the first figure, else the first pattern other than border, else border.
  // "border" that is not the subject is the layout word; any other subject word is not drawn.
  const chosen =
    found.find((item) => FIGURE_SUBJECTS.has(item.subject)) ?? found.find((item) => item.subject !== "border") ?? found[0];
  const extraSubjects: string[] = [];
  if (chosen !== undefined) {
    reading.subject = chosen.subject;
    reading.subjectPhrase = chosen.phrase;
    for (const item of found) {
      if (item.subject === chosen.subject || item.subject === "border") continue;
      extraSubjects.push(item.phrase);
      const at = reading.understood.indexOf(item.phrase);
      if (at !== -1) reading.understood.splice(at, 1);
    }
  }
  // "two peacocks" is understood as one phrase; drop the separate subject word that follows it.
  if (reading.pairWithTwo) {
    reading.understood = reading.understood.filter(
      (phrase, index, all) => !(index > 0 && (all[index - 1] as string).endsWith(` ${phrase}`) && lookup(SUBJECT_WORDS, phrase) !== undefined),
    );
  }

  // Counts that fit the subject (the first one wins); the others are unused.
  const subject = reading.subject;
  for (const count of counts) {
    const fits = lookup(COUNT_NOUNS, count.noun) ?? [];
    const phrase = tokens.slice(count.start, count.nounIndex + 1).join(" ");
    if (subject !== null && fits.includes(subject) && reading.count === null) {
      reading.count = { value: count.value, phrase, noun: count.noun };
      insertInOrder(reading.understood, phrase, tokens, count.start);
      // "five stripes": the count phrase already names the subject.
      if (phrase.endsWith(` ${reading.subjectPhrase}`)) {
        const at = reading.understood.indexOf(reading.subjectPhrase);
        if (at !== -1) reading.understood.splice(at, 1);
      }
    } else if (!reading.unused.includes(phrase)) {
      reading.unused.push(phrase);
    }
  }
  for (const phrase of extraSubjects) {
    if (!reading.unused.includes(phrase)) reading.unused.push(phrase);
  }
  if (extraSubjects.length > 0) reading.notes.push(`One subject at a time: ${extraSubjects.join(", ")} not drawn.`);
  return reading;
}

/** Inserts `phrase` into `understood` so the list stays in text order. */
function insertInOrder(understood: string[], phrase: string, tokens: readonly string[], start: number): void {
  // Position of each understood phrase in the text: the first token index where it begins.
  const positions = understood.map((item) => firstIndex(tokens, item));
  let at = positions.findIndex((position) => position > start);
  if (at === -1) at = understood.length;
  understood.splice(at, 0, phrase);
}

function firstIndex(tokens: readonly string[], phrase: string): number {
  const words = phrase.split(" ");
  for (let index = 0; index + words.length <= tokens.length; index += 1) {
    if (words.every((word, offset) => tokens[index + offset] === word)) return index;
  }
  return tokens.length;
}

/** A subject's own symmetry (1.5); an odd petal or point count is mirror-symmetric left to right only. */
function naturalSymmetry(subject: BuilderSubject, count: number | null): Symmetry {
  const own = SUBJECT_SYMMETRY[subject];
  const radial = subject === "lotus" || subject === "rosette" || subject === "star";
  return radial && count !== null && count % 2 === 1 ? "mirrorEnds" : own;
}

/** True when a subject's drawing is symmetric top to bottom, so mirroring the picks keeps it whole. */
export function picksSymmetric(subject: BuilderSubject, count: number | null): boolean {
  switch (subject) {
    case "lotus":
    case "rosette":
    case "star":
      return (count ?? 8) % 2 === 0;
    case "peacock":
    case "tree":
    case "paisley":
    case "elephant":
      return false;
    default:
      return true;
  }
}

function withoutPicks(symmetry: Symmetry): Symmetry {
  if (symmetry === "mirrorBoth") return "mirrorEnds";
  if (symmetry === "mirrorPicks") return "none";
  return symmetry;
}

/** Description to Motif_Plan (Requirement 1). Total and pure. */
export function describeMotif(text: string, options: DescribeOptions): MotifDescription {
  const source = typeof text === "string" ? text : "";
  const reading = read(tokenize(source));
  const overrides = options.overrides ?? {};
  const notes = [...reading.notes];

  const fellBack = reading.subject === null && !isKnown(BUILDER_SUBJECTS, overrides.subject);
  const subject: BuilderSubject = isKnown(BUILDER_SUBJECTS, overrides.subject) ? overrides.subject : (reading.subject ?? "rosette");

  // Count (1.2): the text's count when it fits the subject, else the subject's default.
  const range = COUNT_RANGES[subject];
  let count: number | null = null;
  if (range !== undefined) {
    const wanted =
      typeof overrides.count === "number" && Number.isFinite(overrides.count)
        ? overrides.count
        : reading.count !== null && reading.subject === subject
          ? reading.count.value
          : range.fallback;
    count = clampInt(wanted, range.min, range.max);
    if (count !== Math.round(wanted)) notes.push(`${String(count)} ${range.noun} is the ${count < wanted ? "most" : "fewest"} a ${subject} can have here.`);
  }

  const layout: BuilderLayout = isKnown(BUILDER_LAYOUTS, overrides.layout)
    ? overrides.layout
    : FIGURE_SUBJECTS.has(subject)
      ? (reading.layout ?? "single")
      : subject === "border"
        ? "border"
        : "allOver";
  const size: BuilderSize = isKnown(BUILDER_SIZES, overrides.size) ? overrides.size : (reading.size ?? "medium");
  const asked: Symmetry = isKnown(BUILDER_SYMMETRIES, overrides.symmetry)
    ? overrides.symmetry
    : (reading.symmetry ?? (reading.pairWithTwo ? "mirrorEnds" : naturalSymmetry(subject, count)));
  // A figure that is not symmetric top to bottom is never mirrored that way: the mirror would cut
  // it in half and show the lower half upside down (2.5) [decision].
  const symmetry = picksSymmetric(subject, count) ? asked : withoutPicks(asked);
  if (symmetry !== asked) notes.push(`A ${subject} is not mirrored top to bottom, so that part of the symmetry is not used.`);

  // Colours (1.6).
  const limit = clampInt(Math.min(MAX_COLOURS, options.maxColours ?? MAX_COLOURS), MIN_COLOURS, MAX_COLOURS);
  const groundOverride = typeof overrides.ground === "string" ? colourOf(overrides.ground) : undefined;
  let ground = groundOverride ?? reading.ground;
  const figures: BuilderColour[] = [];
  for (const colour of reading.figureColours) {
    if (figures.some((item) => item.hex === colour.hex)) continue;
    if (ground !== null && ground !== undefined && ground.hex === colour.hex) continue;
    figures.push(colour);
  }
  // Two or more figure colours named: those plus the ground. Otherwise the setup's count.
  const wantedCount =
    typeof overrides.colourCount === "number" && Number.isFinite(overrides.colourCount)
      ? overrides.colourCount
      : figures.length >= 2
        ? figures.length + 1
        : options.colourCount;
  const colourCount = clampInt(wantedCount, MIN_COLOURS, limit);
  if (ground === null || ground === undefined) {
    const cream = COLOUR_BY_NAME.get("cream") as BuilderColour;
    ground = figures.some((item) => item.hex === cream.hex) ? (COLOUR_BY_NAME.get("white") as BuilderColour) : cream;
  }
  const dropped = figures.slice(colourCount - 1);
  if (dropped.length > 0 && overrides.colourCount === undefined) {
    notes.push(`${String(colourCount)} colours at most: ${dropped.map((item) => item.name).join(", ")} not used.`);
  }
  const colours: BuilderColour[] = [ground, ...figures.slice(0, colourCount - 1)];
  for (const name of SUBJECT_COLOURS[subject]) {
    if (colours.length >= colourCount) break;
    const colour = COLOUR_BY_NAME.get(name) as BuilderColour;
    if (!colours.some((item) => item.hex === colour.hex)) colours.push(colour);
  }
  for (const colour of BUILDER_COLOURS) {
    if (colours.length >= colourCount) break;
    if (!colours.some((item) => item.hex === colour.hex)) colours.push(colour);
  }

  return {
    plan: { subject, count, layout, size, symmetry, colours },
    understood: reading.understood,
    unused: reading.unused,
    fellBack,
    notes,
  };
}
