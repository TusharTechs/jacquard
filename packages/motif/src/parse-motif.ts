// Motif_SVG parser and validator (Requirement 4). See design.md, "Parser".
//
// A hand-written, single-pass XML tokenizer that understands only what Motif_SVG needs. It reads
// the input once from left to right (indexOf and short slices only, no regular expression over the
// whole input), so its run time is linear in the input length. Every check happens as the
// document is read, so the reported `reason` names the first offending construct in document
// order (4.3). Expected failures are returned as values; an unexpected exception becomes
// MOTIF_SVG_INVALID with reason `internal` (4.8).
import { edgeTolerance, shapeContains } from "./geometry.js";
import type { Motif, MotifError, MotifResult, MotifShape, Point } from "./types.js";

/** Product limits from 4.4 [decision]. */
const MAX_LENGTH = 65_536;
const MAX_SHAPES = 2_000;
/** Fixed vertex count for circle and ellipse polygons, so output is deterministic (design). */
const ELLIPSE_VERTICES = 64;
/** Longest attribute value quoted in a `fill:<value>` reason, so messages stay short. */
const MAX_REASON_VALUE = 40;

type ShapeName = "rect" | "circle" | "ellipse" | "polygon" | "path";
type ElementName = "svg" | "g" | "title" | "desc" | ShapeName;

const SHAPE_NAMES: ReadonlySet<string> = new Set<ShapeName>(["rect", "circle", "ellipse", "polygon", "path"]);

/** Attribute allow list per element (4.2; design, Parser). */
const ALLOWED_ATTRIBUTES: Readonly<Record<ElementName, ReadonlySet<string>>> = {
  svg: new Set(["id", "xmlns", "viewBox", "width", "height", "version"]),
  g: new Set(["id", "fill", "transform"]),
  title: new Set(["id"]),
  desc: new Set(["id"]),
  rect: new Set(["id", "fill", "transform", "x", "y", "width", "height"]),
  circle: new Set(["id", "fill", "transform", "cx", "cy", "r"]),
  ellipse: new Set(["id", "fill", "transform", "cx", "cy", "rx", "ry"]),
  polygon: new Set(["id", "fill", "transform", "points"]),
  path: new Set(["id", "fill", "transform", "d"]),
};

const BUILT_IN_ENTITIES: Readonly<Record<string, string>> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
};

/** 2D affine matrix [a, b, c, d, e, f]: x' = a x + c y + e, y' = b x + d y + f. */
type Matrix = readonly [number, number, number, number, number, number];
const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

/** `outer · inner`: apply `inner` first, then `outer`. */
function multiply(outer: Matrix, inner: Matrix): Matrix {
  const [a1, b1, c1, d1, e1, f1] = outer;
  const [a2, b2, c2, d2, e2, f2] = inner;
  return [
    a1 * a2 + c1 * b2,
    b1 * a2 + d1 * b2,
    a1 * c2 + c1 * d2,
    b1 * c2 + d1 * d2,
    a1 * e2 + c1 * f2 + e1,
    b1 * e2 + d1 * f2 + f1,
  ];
}

function applyMatrix(m: Matrix, x: number, y: number): Point {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

function invalid(reason: string): { ok: false; error: MotifError } {
  return {
    ok: false,
    error: { code: "MOTIF_SVG_INVALID", reason, message: `The motif SVG was rejected (${reason}).` },
  };
}

function tooManyColours(count: number, limit: number): { ok: false; error: MotifError } {
  return {
    ok: false,
    error: {
      code: "MOTIF_TOO_MANY_COLOURS",
      count,
      limit,
      message: `The motif uses ${count} colours; the limit is ${limit}.`,
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Character helpers

function isWhitespace(code: number): boolean {
  return code === 0x20 || code === 0x09 || code === 0x0a || code === 0x0d;
}

function isNameStart(code: number): boolean {
  return (code >= 0x41 && code <= 0x5a) || (code >= 0x61 && code <= 0x7a) || code === 0x5f || code === 0x3a;
}

function isNameChar(code: number): boolean {
  return isNameStart(code) || (code >= 0x30 && code <= 0x39) || code === 0x2d || code === 0x2e;
}

function isDigit(code: number): boolean {
  return code >= 0x30 && code <= 0x39;
}

function skipWhitespace(text: string, index: number): number {
  let at = index;
  while (at < text.length && isWhitespace(text.charCodeAt(at))) at += 1;
  return at;
}

/** Skips whitespace and commas (list separators in points, path data and transforms). */
function skipSeparators(text: string, index: number): number {
  let at = index;
  while (at < text.length) {
    const code = text.charCodeAt(at);
    if (!isWhitespace(code) && code !== 0x2c) break;
    at += 1;
  }
  return at;
}

/** Reads an XML name at `index`; returns "" when there is none. */
function readName(text: string, index: number): string {
  if (index >= text.length || !isNameStart(text.charCodeAt(index))) return "";
  let at = index + 1;
  while (at < text.length && isNameChar(text.charCodeAt(at))) at += 1;
  return text.slice(index, at);
}

function isBlank(text: string): boolean {
  return skipWhitespace(text, 0) === text.length;
}

/** Replaces the five XML built-in entities; returns null for any other reference (design). */
function decodeEntities(text: string): string | null {
  if (!text.includes("&")) return text;
  let out = "";
  let at = 0;
  while (at < text.length) {
    const amp = text.indexOf("&", at);
    if (amp === -1) {
      out += text.slice(at);
      break;
    }
    out += text.slice(at, amp);
    const semicolon = text.indexOf(";", amp + 1);
    if (semicolon === -1 || semicolon - amp > 5) return null;
    const replacement = BUILT_IN_ENTITIES[text.slice(amp + 1, semicolon)];
    if (replacement === undefined) return null;
    out += replacement;
    at = semicolon + 1;
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Numbers

/** End index of an SVG number starting at `index`, or -1 when there is none. */
function scanNumber(text: string, index: number): number {
  let at = index;
  const sign = text.charCodeAt(at);
  if (sign === 0x2b || sign === 0x2d) at += 1;
  let digits = 0;
  while (at < text.length && isDigit(text.charCodeAt(at))) {
    at += 1;
    digits += 1;
  }
  if (text.charCodeAt(at) === 0x2e) {
    at += 1;
    while (at < text.length && isDigit(text.charCodeAt(at))) {
      at += 1;
      digits += 1;
    }
  }
  if (digits === 0) return -1;
  const e = text.charCodeAt(at);
  if (e === 0x65 || e === 0x45) {
    let exponent = at + 1;
    const exponentSign = text.charCodeAt(exponent);
    if (exponentSign === 0x2b || exponentSign === 0x2d) exponent += 1;
    let exponentDigits = 0;
    while (exponent < text.length && isDigit(text.charCodeAt(exponent))) {
      exponent += 1;
      exponentDigits += 1;
    }
    if (exponentDigits > 0) at = exponent;
  }
  return at;
}

/** Reads a number at `index`; returns [value, end] or null when there is no finite number. */
function readNumber(text: string, index: number): [number, number] | null {
  const end = scanNumber(text, index);
  if (end === -1) return null;
  const value = Number(text.slice(index, end));
  return Number.isFinite(value) ? [value, end] : null;
}

/** A whole attribute value that is one number, optionally surrounded by whitespace. */
function parseSingleNumber(text: string): number | null {
  const start = skipWhitespace(text, 0);
  const read = readNumber(text, start);
  if (read === null) return null;
  return skipWhitespace(text, read[1]) === text.length ? read[0] : null;
}

/** Numbers separated by whitespace and commas. */
function parseNumberList(text: string): number[] | null {
  const values: number[] = [];
  let at = skipSeparators(text, 0);
  while (at < text.length) {
    const read = readNumber(text, at);
    if (read === null) return null;
    values.push(read[0]);
    at = skipSeparators(text, read[1]);
  }
  return values;
}

// ---------------------------------------------------------------------------------------------
// Attribute values

/** `#rgb` or `#rrggbb` normalised to lower-case `#rrggbb`, `none`, or null (4.2, 4.3). */
function parseFill(raw: string): string | null {
  const value = raw.trim();
  if (value === "none") return "none";
  if (value.charCodeAt(0) !== 0x23 || (value.length !== 4 && value.length !== 7)) return null;
  let hex = "";
  for (let index = 1; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    const isHex = isDigit(code) || (code >= 0x41 && code <= 0x46) || (code >= 0x61 && code <= 0x66);
    if (!isHex) return null;
    hex += value[index] as string;
  }
  hex = hex.toLowerCase();
  if (hex.length === 3) hex = hex.replace(/./g, (digit) => digit + digit);
  return `#${hex}`;
}

/** `translate`, `scale` and `matrix` only, composed left to right (4.2). */
function parseTransform(text: string): Matrix | null {
  let matrix = IDENTITY;
  let at = skipSeparators(text, 0);
  while (at < text.length) {
    const name = readName(text, at);
    if (name === "") return null;
    const open = skipWhitespace(text, at + name.length);
    if (text.charCodeAt(open) !== 0x28) return null;
    const close = text.indexOf(")", open + 1);
    if (close === -1) return null;
    const args = parseNumberList(text.slice(open + 1, close));
    if (args === null) return null;
    let step: Matrix;
    if (name === "translate" && (args.length === 1 || args.length === 2)) {
      step = [1, 0, 0, 1, args[0] as number, args[1] ?? 0];
    } else if (name === "scale" && (args.length === 1 || args.length === 2)) {
      const sx = args[0] as number;
      step = [sx, 0, 0, args[1] ?? sx, 0, 0];
    } else if (name === "matrix" && args.length === 6) {
      step = args as unknown as Matrix;
    } else {
      return null;
    }
    matrix = multiply(matrix, step);
    at = skipSeparators(text, close + 1);
  }
  return matrix;
}

type PathResult = { ok: true; polygons: Point[][] } | { ok: false; reason: string };

/** Path data with `M L H V Z` and their lower-case forms only (4.2). One polygon per subpath. */
function parsePath(d: string): PathResult {
  const polygons: Point[][] = [];
  let current: Point[] | null = null;
  let command = "";
  let x = 0;
  let y = 0;
  let startX = 0;
  let startY = 0;
  let at = skipSeparators(d, 0);
  const finish = (): void => {
    if (current !== null && current.length > 0) polygons.push(current);
    current = null;
  };
  const lineTo = (nextX: number, nextY: number): void => {
    if (current === null) current = [[x, y]];
    x = nextX;
    y = nextY;
    current.push([x, y]);
  };
  const readArgs = (count: number): number[] | null => {
    const args: number[] = [];
    for (let index = 0; index < count; index += 1) {
      if (index > 0) at = skipSeparators(d, at);
      const read = readNumber(d, at);
      if (read === null) return null;
      args.push(read[0]);
      at = read[1];
    }
    return args;
  };
  while (at < d.length) {
    const code = d.charCodeAt(at);
    const isLetter = (code >= 0x41 && code <= 0x5a) || (code >= 0x61 && code <= 0x7a);
    if (isLetter) {
      const letter = d[at] as string;
      if (!"MLHVZmlhvz".includes(letter)) return { ok: false, reason: `pathCommand:${letter}` };
      if (command === "" && letter !== "M" && letter !== "m") return { ok: false, reason: "pathData" };
      command = letter;
      at += 1;
      if (letter === "Z" || letter === "z") {
        finish();
        x = startX;
        y = startY;
      }
      at = skipSeparators(d, at);
      continue;
    }
    if (command === "" || command === "Z" || command === "z") return { ok: false, reason: "pathData" };
    const relative = command === command.toLowerCase();
    const upper = command.toUpperCase();
    const args = readArgs(upper === "H" || upper === "V" ? 1 : 2);
    if (args === null) return { ok: false, reason: "pathData" };
    const first = args[0] as number;
    if (upper === "M") {
      finish();
      x = relative ? x + first : first;
      y = relative ? y + (args[1] as number) : (args[1] as number);
      startX = x;
      startY = y;
      current = [[x, y]];
      // Further coordinate pairs after a moveto are implicit linetos.
      command = relative ? "l" : "L";
    } else if (upper === "L") {
      lineTo(relative ? x + first : first, relative ? y + (args[1] as number) : (args[1] as number));
    } else if (upper === "H") {
      lineTo(relative ? x + first : first, y);
    } else {
      lineTo(x, relative ? y + first : first);
    }
    at = skipSeparators(d, at);
  }
  finish();
  return { ok: true, polygons };
}

// ---------------------------------------------------------------------------------------------
// Shapes

type Attributes = ReadonlyMap<string, string>;

type ShapeResult = { ok: true; polygons: Point[][] } | { ok: false; reason: string };

/** Reads geometry attribute `name` (default `fallback`); null when present but not a number. */
function geometry(attributes: Attributes, name: string, fallback: number, nonNegative: boolean): number | null {
  const raw = attributes.get(name);
  if (raw === undefined) return fallback;
  const value = parseSingleNumber(raw);
  if (value === null || (nonNegative && value < 0)) return null;
  return value;
}

function ellipsePolygon(cx: number, cy: number, rx: number, ry: number): Point[] {
  const points: Point[] = [];
  for (let index = 0; index < ELLIPSE_VERTICES; index += 1) {
    const angle = (2 * Math.PI * index) / ELLIPSE_VERTICES;
    points.push([cx + rx * Math.cos(angle), cy + ry * Math.sin(angle)]);
  }
  return points;
}

/** Shape polygons in the shape's own coordinates (before its transform). */
function localPolygons(name: ShapeName, attributes: Attributes): ShapeResult {
  const read = (attr: string, fallback: number, nonNegative = false): number | null =>
    geometry(attributes, attr, fallback, nonNegative);
  const bad = (attr: string): ShapeResult => ({ ok: false, reason: `number:${attr}` });
  switch (name) {
    case "rect": {
      const x = read("x", 0);
      if (x === null) return bad("x");
      const y = read("y", 0);
      if (y === null) return bad("y");
      const width = read("width", 0, true);
      if (width === null) return bad("width");
      const height = read("height", 0, true);
      if (height === null) return bad("height");
      return { ok: true, polygons: [[[x, y], [x + width, y], [x + width, y + height], [x, y + height]]] };
    }
    case "circle": {
      const cx = read("cx", 0);
      if (cx === null) return bad("cx");
      const cy = read("cy", 0);
      if (cy === null) return bad("cy");
      const r = read("r", 0, true);
      if (r === null) return bad("r");
      return { ok: true, polygons: [ellipsePolygon(cx, cy, r, r)] };
    }
    case "ellipse": {
      const cx = read("cx", 0);
      if (cx === null) return bad("cx");
      const cy = read("cy", 0);
      if (cy === null) return bad("cy");
      const rx = read("rx", 0, true);
      if (rx === null) return bad("rx");
      const ry = read("ry", 0, true);
      if (ry === null) return bad("ry");
      return { ok: true, polygons: [ellipsePolygon(cx, cy, rx, ry)] };
    }
    case "polygon": {
      const values = parseNumberList(attributes.get("points") ?? "");
      if (values === null || values.length % 2 !== 0) return bad("points");
      const points: Point[] = [];
      for (let index = 0; index < values.length; index += 2) {
        points.push([values[index] as number, values[index + 1] as number]);
      }
      return { ok: true, polygons: [points] };
    }
    case "path":
      return parsePath(attributes.get("d") ?? "");
  }
}

// ---------------------------------------------------------------------------------------------
// Document reader

interface Frame {
  readonly name: ElementName;
  /** Inherited fill: normalised hex, "none", or undefined when no ancestor sets one. */
  readonly fill: string | undefined;
  readonly matrix: Matrix;
}

interface DrawnShape {
  readonly name: ShapeName;
  readonly fill: string;
  readonly polygons: Point[][];
}

type ViewBox = readonly [number, number, number, number];

type DocumentResult =
  | { ok: true; viewBox: ViewBox; shapes: DrawnShape[] }
  | { ok: false; reason: string };

function fail(reason: string): { ok: false; reason: string } {
  return { ok: false, reason };
}

function clip(value: string): string {
  return value.length > MAX_REASON_VALUE ? value.slice(0, MAX_REASON_VALUE) : value;
}

/** Name-level attribute checks: forbidden rules first, then the element's allow list (4.2, 4.3). */
function attributeNameProblem(element: ElementName, name: string): string | null {
  const lower = name.toLowerCase();
  if (lower.startsWith("on")) return `attribute:${name}`;
  if (lower === "href" || lower.endsWith(":href")) return `attribute:${name}`;
  if (lower === "style") return "attribute:style";
  if (!ALLOWED_ATTRIBUTES[element].has(name)) return `attribute:${name}`;
  return null;
}

function parseViewBox(raw: string | undefined): ViewBox | null {
  if (raw === undefined) return null;
  const values = parseNumberList(raw);
  if (values === null || values.length !== 4) return null;
  const [minX, minY, width, height] = values as [number, number, number, number];
  return width > 0 && height > 0 ? [minX, minY, width, height] : null;
}

function readDocument(source: string): DocumentResult {
  const stack: Frame[] = [];
  const shapes: DrawnShape[] = [];
  let viewBox: ViewBox | null = null;
  let rootSeen = false;
  let shapeCount = 0;
  let sawMarkup = false;
  let at = source.charCodeAt(0) === 0xfeff ? 1 : 0;

  while (at < source.length) {
    // Character data up to the next tag.
    const lt = source.indexOf("<", at);
    const textEnd = lt === -1 ? source.length : lt;
    if (textEnd > at) {
      const decoded = decodeEntities(source.slice(at, textEnd));
      if (decoded === null) return fail("entity");
      const top = stack[stack.length - 1];
      const inText = top !== undefined && (top.name === "title" || top.name === "desc");
      if (!inText && !isBlank(decoded)) return fail("text");
      at = textEnd;
      continue;
    }

    if (source.startsWith("<?", at)) {
      const close = source.indexOf("?>", at + 2);
      const target = readName(source, at + 2);
      // Only the XML declaration, and only before any other markup (4.3).
      if (close === -1 || target !== "xml" || sawMarkup) return fail("processingInstruction");
      sawMarkup = true;
      at = close + 2;
      continue;
    }
    if (source.startsWith("<!--", at)) {
      const close = source.indexOf("-->", at + 4);
      if (close === -1) return fail("markup");
      sawMarkup = true;
      at = close + 3;
      continue;
    }
    if (source.startsWith("<!", at)) {
      const word = source.slice(at + 2, at + 9).toUpperCase();
      if (word.startsWith("DOCTYPE")) return fail("doctype");
      if (word.startsWith("ENTITY")) return fail("entity");
      if (source.startsWith("<![CDATA[", at)) return fail("cdata");
      return fail("markup");
    }
    sawMarkup = true;

    if (source.startsWith("</", at)) {
      const name = readName(source, at + 2);
      const close = skipWhitespace(source, at + 2 + name.length);
      if (name === "" || source.charCodeAt(close) !== 0x3e) return fail("markup");
      const top = stack.pop();
      if (top === undefined || top.name !== name) return fail("markup");
      at = close + 1;
      continue;
    }

    // Start tag. The element name is checked before its attributes (4.3).
    const tagName = readName(source, at + 1);
    if (tagName === "") return fail("markup");
    const parent = stack[stack.length - 1];
    let element: ElementName;
    if (parent === undefined) {
      if (rootSeen || tagName !== "svg") return fail("root");
      rootSeen = true;
      element = "svg";
    } else {
      const textParent = parent.name === "title" || parent.name === "desc";
      const shapeParent = SHAPE_NAMES.has(parent.name);
      const isMeta = tagName === "title" || tagName === "desc";
      const allowed = tagName === "g" || SHAPE_NAMES.has(tagName) || isMeta;
      if (!allowed || textParent || (shapeParent && !isMeta)) return fail(`element:${tagName}`);
      element = tagName as ElementName;
    }

    const attributes = new Map<string, string>();
    let cursor = at + 1 + tagName.length;
    let selfClosing = false;
    for (;;) {
      const next = skipWhitespace(source, cursor);
      if (source.charCodeAt(next) === 0x3e) {
        cursor = next + 1;
        break;
      }
      if (source.startsWith("/>", next)) {
        selfClosing = true;
        cursor = next + 2;
        break;
      }
      if (next === cursor) return fail("markup");
      const name = readName(source, next);
      if (name === "") return fail("markup");
      const problem = attributeNameProblem(element, name);
      if (problem !== null) return fail(problem);
      if (attributes.has(name)) return fail(`attribute:${name}`);
      let equals = skipWhitespace(source, next + name.length);
      if (source.charCodeAt(equals) !== 0x3d) return fail("markup");
      equals = skipWhitespace(source, equals + 1);
      const quote = source[equals];
      if (quote !== '"' && quote !== "'") return fail("markup");
      const valueEnd = source.indexOf(quote, equals + 1);
      if (valueEnd === -1) return fail("markup");
      const raw = source.slice(equals + 1, valueEnd);
      if (raw.includes("<")) return fail("markup");
      const value = decodeEntities(raw);
      if (value === null) return fail("entity");
      attributes.set(name, value);
      cursor = valueEnd + 1;
    }

    // Attribute values.
    let fill = parent?.fill;
    let matrix = parent?.matrix ?? IDENTITY;
    if (element === "svg") {
      viewBox = parseViewBox(attributes.get("viewBox"));
      if (viewBox === null) return fail("viewBox");
    }
    const rawFill = attributes.get("fill");
    if (rawFill !== undefined) {
      const parsed = parseFill(rawFill);
      if (parsed === null) return fail(`fill:${clip(rawFill)}`);
      fill = parsed;
    }
    const rawTransform = attributes.get("transform");
    if (rawTransform !== undefined) {
      const parsed = parseTransform(rawTransform);
      if (parsed === null) return fail("transform");
      matrix = multiply(matrix, parsed);
    }

    if (SHAPE_NAMES.has(element)) {
      const shapeName = element as ShapeName;
      shapeCount += 1;
      if (shapeCount > MAX_SHAPES) return fail("tooLarge");
      const local = localPolygons(shapeName, attributes);
      if (!local.ok) return fail(local.reason);
      // A shape with no fill anywhere is black, as in SVG; `fill="none"` shapes are dropped.
      const resolved = fill ?? "#000000";
      if (resolved !== "none") {
        const polygons = local.polygons.map((polygon) =>
          polygon.map(([x, y]) => applyMatrix(matrix, x, y)),
        );
        shapes.push({ name: shapeName, fill: resolved, polygons });
      }
    }

    if (!selfClosing) stack.push({ name: element, fill, matrix });
    at = cursor;
  }

  if (stack.length > 0) return fail("markup");
  if (!rootSeen || viewBox === null) return fail("root");
  return { ok: true, viewBox, shapes };
}

// ---------------------------------------------------------------------------------------------
// Palette (4.6)

/** True when the transformed rect covers all four corners of the viewBox. */
function coversViewBox(shape: DrawnShape, viewBox: ViewBox): boolean {
  if (shape.name !== "rect") return false;
  const [minX, minY, width, height] = viewBox;
  const tolerance = edgeTolerance(width, height);
  const corners: Point[] = [
    [minX, minY],
    [minX + width, minY],
    [minX + width, minY + height],
    [minX, minY + height],
  ];
  return corners.every(([x, y]) => shapeContains(shape.polygons, x, y, tolerance));
}

function parseUnchecked(svg: unknown, colourLimit: number): MotifResult<Motif> {
  if (typeof svg !== "string") return invalid("root");
  if (svg.length > MAX_LENGTH) return invalid("tooLarge");
  const doc = readDocument(svg);
  if (!doc.ok) return invalid(doc.reason);

  const first = doc.shapes[0];
  const background = first !== undefined && coversViewBox(first, doc.viewBox) ? first.fill : "#ffffff";
  const palette: string[] = [background];
  const indexOf = new Map<string, number>([[background, 0]]);
  const shapes: MotifShape[] = doc.shapes.map((shape) => {
    let paletteIndex = indexOf.get(shape.fill);
    if (paletteIndex === undefined) {
      paletteIndex = palette.length;
      palette.push(shape.fill);
      indexOf.set(shape.fill, paletteIndex);
    }
    return { paletteIndex, polygons: shape.polygons };
  });

  // Written as a negated comparison so that a NaN limit rejects rather than accepts.
  if (!(palette.length <= colourLimit)) return tooManyColours(palette.length, colourLimit);
  const [minX, minY, width, height] = doc.viewBox;
  return { ok: true, value: { viewBox: [minX, minY, width, height], palette, shapes } };
}

/**
 * Parses and validates Motif_SVG text (Requirement 4). Returns the viewBox, the palette (entry 0
 * is the background) and the shapes in document order as polygons in viewBox coordinates.
 * Never throws (4.8).
 */
export function parseMotif(svg: string, colourLimit: number): MotifResult<Motif> {
  try {
    return parseUnchecked(svg, colourLimit);
  } catch {
    return invalid("internal");
  }
}
