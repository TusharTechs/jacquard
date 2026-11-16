// Motif request contract shared by the backend and the web app (Requirement 1).
// See design.md, "@jacquard/motif", Request contract.
//
// `validateMotifRequest` checks a parsed JSON body against 1.1 and the limits of 1.3. Fields are
// checked in a fixed order and the first problem is returned, with `field` naming its path.
// Extra fields are ignored and are not copied into the result.
import type { Repeat, Symmetry } from "./types.js";

export type MotifInput =
  | { kind: "text"; prompt: string }
  | { kind: "sketch"; mediaType: "image/png" | "image/jpeg"; data: string };

export interface MotifRequest {
  input: MotifInput;
  colourCount: number;
  symmetry: Symmetry;
  repeat: Repeat;
}

export interface MotifResponse {
  svg: string;
  palette: string[];
  source: "model" | "standIn";
}

export type MotifErrorCode =
  | "REQUEST_INVALID"
  | "MODEL_TIMEOUT"
  | "MOTIF_SVG_INVALID"
  | "MOTIF_TOO_MANY_COLOURS"
  | "MODEL_UNAVAILABLE"
  | "INTERNAL_ERROR";

export interface MotifErrorBody {
  code: MotifErrorCode;
  message: string;
  field?: string;
}

/** Product limits from 1.1 and 1.3 [decision]. */
const MIN_COLOURS = 2;
const MAX_COLOURS = 8;
const MIN_REPEAT = 8;
const MAX_REPEAT = 400;
const MAX_PROMPT_CHARACTERS = 500;
const MAX_SKETCH_BYTES = 1_500_000;

const SYMMETRIES: readonly Symmetry[] = ["none", "mirrorEnds", "mirrorPicks", "mirrorBoth"];
const MEDIA_TYPES: readonly string[] = ["image/png", "image/jpeg"];

type Validation = { ok: true; value: MotifRequest } | { ok: false; error: MotifErrorBody };

function reject(field: string, problem: string): { ok: false; error: MotifErrorBody } {
  return {
    ok: false,
    error: { code: "REQUEST_INVALID", field, message: `Request field "${field}" ${problem}.` },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isIntegerIn(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;
}

function isBase64Character(code: number): boolean {
  return (
    (code >= 0x41 && code <= 0x5a) || // A-Z
    (code >= 0x61 && code <= 0x7a) || // a-z
    (code >= 0x30 && code <= 0x39) || // 0-9
    code === 0x2b || // +
    code === 0x2f // /
  );
}

/**
 * Decoded size in bytes of standard padded base64, computed from the length and the padding
 * without decoding; -1 when the text is not valid base64.
 */
function decodedBase64Size(data: string): number {
  if (data.length === 0 || data.length % 4 !== 0) return -1;
  let padding = 0;
  if (data.endsWith("==")) padding = 2;
  else if (data.endsWith("=")) padding = 1;
  const body = data.length - padding;
  for (let index = 0; index < body; index += 1) {
    if (!isBase64Character(data.charCodeAt(index))) return -1;
  }
  return (data.length / 4) * 3 - padding;
}

function validateInput(input: unknown): { ok: true; value: MotifInput } | { ok: false; error: MotifErrorBody } {
  if (!isRecord(input)) return reject("input", "must be an object");
  const kind = input["kind"];
  if (kind === "text") {
    const prompt = input["prompt"];
    if (typeof prompt !== "string") return reject("input.prompt", "must be a string");
    if (prompt.trim().length === 0) return reject("input.prompt", "must not be empty");
    // Counted in Unicode code points, so a character outside the BMP counts once.
    if (Array.from(prompt).length > MAX_PROMPT_CHARACTERS) {
      return reject("input.prompt", `must be at most ${MAX_PROMPT_CHARACTERS} characters`);
    }
    return { ok: true, value: { kind: "text", prompt } };
  }
  if (kind === "sketch") {
    const mediaType = input["mediaType"];
    if (typeof mediaType !== "string" || !MEDIA_TYPES.includes(mediaType)) {
      return reject("input.mediaType", 'must be "image/png" or "image/jpeg"');
    }
    const data = input["data"];
    if (typeof data !== "string") return reject("input.data", "must be a base64 string");
    const size = decodedBase64Size(data);
    if (size === -1) return reject("input.data", "must be non-empty, valid base64");
    if (size > MAX_SKETCH_BYTES) return reject("input.data", `must decode to at most ${MAX_SKETCH_BYTES} bytes`);
    return { ok: true, value: { kind: "sketch", mediaType: mediaType as "image/png" | "image/jpeg", data } };
  }
  return reject("input.kind", 'must be "text" or "sketch"');
}

/** Validates a parsed JSON body as a Motif_Request (1.1, 1.3). */
export function validateMotifRequest(body: unknown): Validation {
  if (!isRecord(body)) return reject("body", "must be a JSON object");
  const input = validateInput(body["input"]);
  if (!input.ok) return input;
  const colourCount = body["colourCount"];
  if (!isIntegerIn(colourCount, MIN_COLOURS, MAX_COLOURS)) {
    return reject("colourCount", `must be an integer from ${MIN_COLOURS} to ${MAX_COLOURS}`);
  }
  const symmetry = body["symmetry"];
  if (typeof symmetry !== "string" || !(SYMMETRIES as readonly string[]).includes(symmetry)) {
    return reject("symmetry", `must be one of ${SYMMETRIES.join(", ")}`);
  }
  const repeat = body["repeat"];
  if (!isRecord(repeat)) return reject("repeat", "must be an object");
  const ends = repeat["ends"];
  if (!isIntegerIn(ends, MIN_REPEAT, MAX_REPEAT)) {
    return reject("repeat.ends", `must be an integer from ${MIN_REPEAT} to ${MAX_REPEAT}`);
  }
  const picks = repeat["picks"];
  if (!isIntegerIn(picks, MIN_REPEAT, MAX_REPEAT)) {
    return reject("repeat.picks", `must be an integer from ${MIN_REPEAT} to ${MAX_REPEAT}`);
  }
  return {
    ok: true,
    value: { input: input.value, colourCount, symmetry: symmetry as Symmetry, repeat: { ends, picks } },
  };
}
