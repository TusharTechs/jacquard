// Captions from the narration (demo-video 2.6). The burned-in captions and the .srt come from the
// same text: cuesFor splits a scene's narration into cues of at most two lines and shares the
// narration window between them by word count. See design.md, "Captions".

export const MAX_LINE = 42;
export const MAX_LINES = 2;

export interface Cue {
  /** Seconds from the start of the video. */
  readonly start: number;
  readonly end: number;
  readonly lines: readonly string[];
}

export function normalise(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function words(text: string): string[] {
  const clean = normalise(text);
  return clean === "" ? [] : clean.split(" ");
}

/** Greedy lines of at most MAX_LINE characters; a longer word stands alone on its line. */
function linesOf(sentence: readonly string[]): string[] {
  const lines: string[] = [];
  let current = "";
  for (const word of sentence) {
    if (current === "") current = word;
    else if (current.length + 1 + word.length <= MAX_LINE) current += ` ${word}`;
    else {
      lines.push(current);
      current = word;
    }
  }
  if (current !== "") lines.push(current);
  return lines;
}

/** Sentences as word lists; a sentence ends at a word ending in . ! ? or a closing quote after one. */
function sentences(all: readonly string[]): string[][] {
  const result: string[][] = [];
  let current: string[] = [];
  for (const word of all) {
    current.push(word);
    if (/[.!?]["”’)]?$/.test(word)) {
      result.push(current);
      current = [];
    }
  }
  if (current.length > 0) result.push(current);
  return result;
}

/** The sentences of a text, as the captions split them; the synthetic voice speaks the same ones. */
export function splitSentences(text: string): string[] {
  return sentences(words(text)).map((sentence) => sentence.join(" "));
}

/** Cues for one narration window, contiguous from `start` to `end`. */
export function cuesFor(text: string, start: number, end: number): Cue[] {
  const all = words(text);
  if (all.length === 0) return [];
  const groups: string[][] = [];
  for (const sentence of sentences(all)) {
    const lines = linesOf(sentence);
    for (let index = 0; index < lines.length; index += MAX_LINES) groups.push(lines.slice(index, index + MAX_LINES));
  }
  const counts = groups.map((lines) => lines.join(" ").split(" ").length);
  const total = counts.reduce((sum, count) => sum + count, 0);
  const span = end - start;
  const cues: Cue[] = [];
  let at = start;
  let seen = 0;
  groups.forEach((lines, index) => {
    seen += counts[index]!;
    const until = index === groups.length - 1 ? end : start + (span * seen) / total;
    cues.push({ start: at, end: until, lines });
    at = until;
  });
  return cues;
}

function stamp(seconds: number): string {
  const ms = Math.round(seconds * 1000);
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  const rest = ms % 1000;
  const two = (value: number): string => String(value).padStart(2, "0");
  return `${two(h)}:${two(m)}:${two(s)},${String(rest).padStart(3, "0")}`;
}

function parseStamp(text: string): number {
  const match = /^(\d{2}):(\d{2}):(\d{2}),(\d{3})$/.exec(text.trim());
  if (match === null) throw new Error(`bad SRT time ${text}`);
  const [, h, m, s, ms] = match;
  return (Number(h) * 3_600_000 + Number(m) * 60_000 + Number(s) * 1000 + Number(ms)) / 1000;
}

/** Numbered SRT, one block per cue, times rounded to the millisecond. */
export function toSrt(cues: readonly Cue[]): string {
  return cues.map((cue, index) => `${index + 1}\n${stamp(cue.start)} --> ${stamp(cue.end)}\n${cue.lines.join("\n")}\n`).join("\n");
}

export function fromSrt(text: string): Cue[] {
  const blocks = text.replace(/\r\n/g, "\n").split(/\n\n+/).filter((block) => block.trim() !== "");
  return blocks.map((block) => {
    const [, times, ...lines] = block.split("\n");
    const [from, to] = (times ?? "").split(" --> ");
    return { start: parseStamp(from ?? ""), end: parseStamp(to ?? ""), lines: lines.filter((line) => line !== "") };
  });
}

/** Cues for every part of every scene, in order (the captions and the .srt use exactly these). */
export function cuesForParts(scenes: readonly { readonly parts: readonly { readonly text: string; readonly start: number; readonly end: number }[] }[]): Cue[] {
  return scenes.flatMap((scene) => scene.parts.flatMap((part) => cuesFor(part.text, part.start, part.end)));
}

/** Where one narration line's speech is in the video (scripts/voice.ts writes these). */
export interface LineTiming {
  readonly start: number;
  readonly end: number;
  readonly sentences: readonly { readonly start: number; readonly end: number }[];
}

/** How long a caption stays after its line's speech ends, at most (it never overlaps the next line). */
export const CAPTION_HOLD = 0.5;

/**
 * Cues timed to the recorded voice (demo-video 9.7): each sentence's cues start where that
 * sentence's speech starts and share its time by word count; the last cue of a line stays
 * CAPTION_HOLD after the speech, never into the next line. A part without timing, or whose sentence
 * count differs, keeps its planned window.
 */
export function cuesForTimedParts(
  scenes: readonly { readonly parts: readonly { readonly text: string; readonly start: number; readonly end: number }[] }[],
  timing: readonly LineTiming[],
): Cue[] {
  const parts = scenes.flatMap((scene) => scene.parts);
  if (timing.length !== parts.length) return cuesForParts(scenes);
  return parts.flatMap((part, index) => {
    const line = timing[index]!;
    const said = splitSentences(part.text);
    if (line.sentences.length !== said.length) return cuesFor(part.text, part.start, part.end);
    const next = index + 1 < parts.length ? timing[index + 1]!.start : Infinity;
    const lineEnd = Math.min(line.end + CAPTION_HOLD, next - 0.04, Math.max(part.end, line.end));
    return said.flatMap((sentence, k) => {
      const start = line.sentences[k]!.start;
      const end = k + 1 < said.length ? line.sentences[k + 1]!.start : Math.max(lineEnd, line.sentences[k]!.end);
      return cuesFor(sentence, start, end);
    });
  });
}
