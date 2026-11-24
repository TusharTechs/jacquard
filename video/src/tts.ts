// Synthetic narration (demo-video Requirement 9), the pure part: what Kokoro-82M is asked to say
// for each line, the speed it says it at, and the check of its transcript against the script.
// scripts/tts.ts runs the model (voice/tts/tts.py) and the transcription; this module has no Node
// imports so it is tested on its own.
import { splitSentences } from "./cues.ts";

/** The voice used for all 26 lines; chosen from the samples (see KIRO_JOURNEY.md). */
export const CHOSEN_VOICE = "af_heart";
/** Voices tried on the sample lines. */
export const SAMPLE_VOICES: readonly string[] = ["af_heart", "af_bella", "am_michael", "bm_george"];
export const SAMPLE_LINES: readonly number[] = [1, 7, 18, 21];

/** Kokoro's speed for a line at its natural pace, and the allowed range (Requirement 9.4). */
export const BASE_SPEED = 1;
export const MIN_SPEED = 0.9;
export const MAX_SPEED = 1.05;
/**
 * Silence added between two sentences of a line, seconds. Kokoro already ends and starts each
 * sentence with about 0.75 s of silence between them; 0.35 s more made 1.1 s pauses [decision].
 */
export const SENTENCE_PAUSE = 0;

export interface Override {
  /** Matched on whole words, in the script text. */
  readonly pattern: RegExp;
  /** misaki phonemes (American English), written as [word](/phonemes/) for Kokoro. */
  readonly phonemes: string;
  readonly why: string;
  /** Only in these lines (numbers 1 to 26); everywhere when absent. */
  readonly lines?: readonly number[];
}

/**
 * Pronunciation overrides. Each was heard wrong in a transcript without it: "JACQUARD" came back
 * as "Jaccard", "Kiro" as "Cairo", "WIF" as "WAF", and the American voices' "handlooms" as
 * "hanlums" or "handlums" (the British sample said it right). Kiro's first phonemes, /kˈɪɹO/, came
 * back as "Kiro" in every line but 22 ("Quiro"); /kˈɪəɹO/ is heard as "Kiro" there too. In line 18
 * "the tests" came back as "the test" at every speed tried; /tˈɛstsz/ is heard as "tests". MCP, AWS
 * and CLI are spoken as letters without one (their transcripts read "MCP", "AWS", "CLI").
 */
export const OVERRIDES: readonly Override[] = [
  { pattern: /\b(JACQUARD|[Jj]acquard)\b/g, phonemes: "ʤəkˈɑɹd", why: "juh-KARD" },
  { pattern: /\b(Kiro)\b/g, phonemes: "kˈɪəɹO", why: "KEER-oh" },
  { pattern: /\b(WIF)\b/g, phonemes: "wˈɪf", why: "wiff" },
  { pattern: /\b([Hh]andlooms)\b/g, phonemes: "hˈændlˌumz", why: "HAND-looms" },
  { pattern: /\b(tests)\b/g, phonemes: "tˈɛstsz", why: "tests, with its last s heard", lines: [18] },
];

/** The text Kokoro is given for one sentence: the script's words with the overrides marked up. */
export function speechText(sentence: string, line: number, overrides: readonly Override[] = OVERRIDES): string {
  let out = sentence;
  for (const override of overrides) {
    if (override.lines !== undefined && !override.lines.includes(line)) continue;
    out = out.replace(override.pattern, (word) => `[${word}](/${override.phonemes}/)`);
  }
  return out;
}

/** The sentences of a line, each as Kokoro is given it; never split into words. */
export function speechSentences(text: string, line: number, overrides: readonly Override[] = OVERRIDES): string[] {
  return splitSentences(text).map((sentence) => speechText(sentence, line, overrides));
}

/** A line spoken faster than this sounds rushed; it is slowed towards SETTLED_WPM [decision]. */
export const RUSHED_WPM = 170;
export const SETTLED_WPM = 160;

/** Kokoro's seed for a line's first take. */
export function lineSeed(line: number): number {
  return line;
}

/**
 * Takes to try again for a line whose transcript differs: new seeds at the same speed first (the
 * natural pace), then nearby speeds inside the range.
 */
export function retryTakes(line: number, speed: number): { readonly speed: number; readonly seed: number }[] {
  const seeds = [1, 2, 3].map((take) => ({ speed, seed: lineSeed(line) + 100 * take }));
  const speeds = [0.03, -0.03, 0.06, -0.06]
    .map((step) => Math.round((speed + step) * 1000) / 1000)
    .filter((value) => value >= MIN_SPEED && value <= MAX_SPEED)
    .map((value) => ({ speed: value, seed: lineSeed(line) }));
  return [...seeds, ...speeds];
}

const clampSpeed = (value: number): number => Math.max(MIN_SPEED, Math.min(MAX_SPEED, Math.round(value * 1000) / 1000));

/**
 * Speed for a line of `words` words whose speech lasted `speech` seconds at `speed`. Natural pace
 * when it fits. Longer than its window: just fast enough to fit, at most MAX_SPEED. Rushed (over
 * RUSHED_WPM): slowed towards SETTLED_WPM, at least MIN_SPEED, but never past what fits its window.
 * A line is never slowed only to fill its window.
 */
export function chooseSpeed(speech: number, window: number, words: number, speed: number = BASE_SPEED): number {
  if (speech > window) return clampSpeed(Math.ceil(((speed * speech) / window) * 1000) / 1000);
  const wpm = (words / speech) * 60;
  if (wpm <= RUSHED_WPM) return clampSpeed(speed);
  const settled = (speed * SETTLED_WPM) / wpm;
  const fits = (speed * speech) / window;
  return clampSpeed(Math.max(settled, fits));
}

const ONES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

/** 0 to 9999 in words, as a transcript would spell a spoken number ("96" → "ninety six"). */
export function numberWords(value: number): string {
  if (value < 20) return ONES[value]!;
  if (value < 100) return `${TENS[Math.floor(value / 10)]}${value % 10 === 0 ? "" : ` ${ONES[value % 10]}`}`;
  if (value < 1000) return `${ONES[Math.floor(value / 100)]} hundred${value % 100 === 0 ? "" : ` ${numberWords(value % 100)}`}`;
  return `${numberWords(Math.floor(value / 1000))} thousand${value % 1000 === 0 ? "" : ` ${numberWords(value % 1000)}`}`;
}

/** Lower case, numbers as words, punctuation and hyphens dropped: the words a listener hears. */
export function heardWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/\d+/g, (digits) => (Number(digits) < 10000 ? ` ${numberWords(Number(digits))} ` : digits))
    .replace(/[-‐‑–—/]/g, " ")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word !== "");
}

/**
 * Words a transcript may spell differently from the script although they sound the same: British
 * against American spelling, and one homophone the transcriber cannot tell apart. Each pair holds
 * for that script word only ("two" is accepted for "too", not for "two" in "two-pick").
 */
export const SAME_SOUND: readonly { readonly script: string; readonly heard: string; readonly kind: "spelling" | "homophone" }[] = [
  { script: "stylised", heard: "stylized", kind: "spelling" },
  { script: "labelled", heard: "labeled", kind: "spelling" },
  { script: "too", heard: "two", kind: "homophone" },
];

export interface TranscriptCheck {
  readonly match: boolean;
  /** Script words not heard, and heard words not in the script, in order. */
  readonly missing: readonly string[];
  readonly extra: readonly string[];
  /** SAME_SOUND pairs the match relied on, as "script/heard (kind)". */
  readonly sameSound: readonly string[];
}

/**
 * The transcript matches when it has the script's words, differing in punctuation, case, hyphens or
 * spacing only ("auto-fix" and "autofix" are the same; "Jaccard" and "jacquard" are not), or in a
 * SAME_SOUND pair, which the result lists.
 */
export function checkTranscript(script: string, transcript: string): TranscriptCheck {
  const expected = heardWords(script);
  const heard = heardWords(transcript);
  if (expected.join("") === heard.join("")) return { match: true, missing: [], extra: [], sameSound: [] };
  const used: string[] = [];
  const same = (want: string, got: string): boolean => {
    if (want === got) return true;
    const pair = SAME_SOUND.find((item) => item.script === want && item.heard === got);
    return pair !== undefined;
  };
  // Longest common subsequence, for the report.
  const table: number[][] = Array.from({ length: expected.length + 1 }, () => new Array<number>(heard.length + 1).fill(0));
  for (let i = expected.length - 1; i >= 0; i -= 1) {
    for (let j = heard.length - 1; j >= 0; j -= 1) {
      table[i]![j] = same(expected[i]!, heard[j]!) ? table[i + 1]![j + 1]! + 1 : Math.max(table[i + 1]![j]!, table[i]![j + 1]!);
    }
  }
  const missing: string[] = [];
  const extra: string[] = [];
  let i = 0;
  let j = 0;
  while (i < expected.length && j < heard.length) {
    if (same(expected[i]!, heard[j]!)) {
      if (expected[i] !== heard[j]) used.push(`${expected[i]}/${heard[j]} (${SAME_SOUND.find((item) => item.script === expected[i])!.kind})`);
      i += 1;
      j += 1;
    } else if (table[i + 1]![j]! >= table[i]![j + 1]!) missing.push(expected[i++]!);
    else extra.push(heard[j++]!);
  }
  missing.push(...expected.slice(i));
  extra.push(...heard.slice(j));
  // Words split or joined differently ("auto fix" against "autofix") are spacing, not words.
  if (missing.join("") === extra.join("")) return { match: true, missing: [], extra: [], sameSound: used };
  return { match: false, missing, extra, sameSound: used };
}

export interface LineCheck {
  readonly match: boolean;
  /** "line": the whole line's transcript matched; "sentences": each sentence's did. */
  readonly by: "line" | "sentences" | null;
  readonly missing: readonly string[];
  readonly extra: readonly string[];
  readonly sameSound: readonly string[];
}

/**
 * A line passes when its whole transcript matches, or, when that differs, when every sentence
 * transcribed on its own matches its sentence. The fallback is for a transcriber that rewrites a
 * word from the next sentence's context ("the tests … a lattice test" heard as "the test … a
 * lattice test"); a word said wrong still fails, because its own sentence fails too.
 */
export function checkLine(script: string, whole: string, bySentence?: readonly string[]): LineCheck {
  const line = checkTranscript(script, whole);
  if (line.match) return { ...line, by: "line" };
  const sentences = splitSentences(script);
  if (bySentence === undefined || bySentence.length !== sentences.length) return { ...line, by: null };
  const checks = sentences.map((sentence, index) => checkTranscript(sentence, bySentence[index]!));
  if (checks.every((check) => check.match)) return { match: true, by: "sentences", missing: [], extra: [], sameSound: checks.flatMap((check) => check.sameSound) };
  return { ...line, by: null };
}
