// Generators and test-only models for the motif-input property tests (wave 2).
//
// Motif tests build Motif_SVG from a generated shape list with the serializer below, so the parser
// is checked against an independent model of what was drawn (design.md, "Correctness
// Properties"). Nothing here imports from `src`: the expected palette (rule 4.6), the expected
// polygons and the request model are computed from the generated shapes alone.
import * as fc from "fast-check";
import type { MotifRequest, Symmetry } from "../src/index.js";

// ---------------------------------------------------------------------------------------------
// Shape model

/** One step of a `transform` attribute. Only translate and scale, with exactly representable values. */
export type TransformOp =
  | { readonly op: "translate"; readonly tx: number; readonly ty: number; readonly oneArg: boolean }
  | { readonly op: "scale"; readonly sx: number; readonly sy: number; readonly oneArg: boolean };

/** A path segment. Upper case is absolute, lower case relative. */
export type PathSegment =
  | { readonly cmd: "L" | "l"; readonly x: number; readonly y: number }
  | { readonly cmd: "H" | "h"; readonly x: number }
  | { readonly cmd: "V" | "v"; readonly y: number };

export interface Subpath {
  readonly move: "M" | "m";
  readonly x: number;
  readonly y: number;
  readonly segments: readonly PathSegment[];
  readonly close: "Z" | "z" | "";
}

interface ShapeBase {
  /** The fill exactly as written, or undefined for no `fill` attribute. */
  readonly fill: string | undefined;
  readonly transform: readonly TransformOp[] | undefined;
}

export type ShapeNode =
  | (ShapeBase & { readonly kind: "rect"; readonly x: number; readonly y: number; readonly width: number; readonly height: number })
  | (ShapeBase & { readonly kind: "circle"; readonly cx: number; readonly cy: number; readonly r: number })
  | (ShapeBase & { readonly kind: "ellipse"; readonly cx: number; readonly cy: number; readonly rx: number; readonly ry: number })
  | (ShapeBase & { readonly kind: "polygon"; readonly points: readonly (readonly [number, number])[] })
  | (ShapeBase & { readonly kind: "path"; readonly subpaths: readonly Subpath[] });

export interface GroupNode extends ShapeBase {
  readonly kind: "g";
  readonly children: readonly DocNode[];
}

export type DocNode = ShapeNode | GroupNode;

export interface MotifDoc {
  readonly viewBox: readonly [number, number, number, number];
  readonly nodes: readonly DocNode[];
  readonly xmlDeclaration: boolean;
  readonly title: string | undefined;
  readonly comment: boolean;
  readonly quote: '"' | "'";
}

// ---------------------------------------------------------------------------------------------
// Colours

/** Colours written in several forms; several can be written as `#rgb`. */
const COLOUR_POOL: readonly string[] = [
  "#ffffff",
  "#000000",
  "#aa0000",
  "#00bb00",
  "#112233",
  "#ccddee",
  "#123456",
  "#a1b2c3",
];

/** A hex colour from the pool, written in lower, upper or mixed case and short form when possible. */
export const hexColourArb: fc.Arbitrary<string> = fc
  .record({ colour: fc.constantFrom(...COLOUR_POOL), short: fc.boolean(), upper: fc.nat({ max: 2 }) })
  .map(({ colour, short, upper }) => {
    const digits = colour.slice(1);
    const canShort = digits[0] === digits[1] && digits[2] === digits[3] && digits[4] === digits[5];
    let written = short && canShort ? `${digits[0]}${digits[2]}${digits[4]}` : digits;
    if (upper === 1) written = written.toUpperCase();
    if (upper === 2) written = [...written].map((c, i) => (i % 2 === 0 ? c.toUpperCase() : c)).join("");
    return `#${written}`;
  });

/** A `fill` attribute value: absent, a hex colour, or sometimes `none`. */
const fillArb: fc.Arbitrary<string | undefined> = fc.oneof(
  { weight: 2, arbitrary: fc.constant(undefined) },
  { weight: 6, arbitrary: hexColourArb },
  { weight: 1, arbitrary: fc.constant("none") },
);

/** Lower-case `#rrggbb` form of a written hex colour (test model of the 4.6 comparison rule). */
export function normaliseColour(written: string): string {
  const lower = written.toLowerCase();
  if (lower.length === 4) return `#${lower[1]}${lower[1]}${lower[2]}${lower[2]}${lower[3]}${lower[3]}`;
  return lower;
}

// ---------------------------------------------------------------------------------------------
// Shape generators

const coord = fc.integer({ min: -20, max: 120 });
const size = fc.integer({ min: 0, max: 60 });

const transformOpArb: fc.Arbitrary<TransformOp> = fc.oneof(
  fc.record({
    op: fc.constant("translate" as const),
    tx: fc.integer({ min: -30, max: 30 }),
    ty: fc.integer({ min: -30, max: 30 }),
    oneArg: fc.boolean(),
  }).map((t) => (t.oneArg ? { ...t, ty: 0 } : t)),
  fc.record({
    op: fc.constant("scale" as const),
    sx: fc.constantFrom(0.5, 1, 1.5, 2, -1, -0.5),
    sy: fc.constantFrom(0.5, 1, 1.5, 2, -1, -0.5),
    oneArg: fc.boolean(),
  }).map((t) => (t.oneArg ? { ...t, sy: t.sx } : t)),
);

const transformArb: fc.Arbitrary<readonly TransformOp[] | undefined> = fc.option(
  fc.array(transformOpArb, { minLength: 1, maxLength: 3 }),
  { nil: undefined, freq: 2 },
);

const base = { fill: fillArb, transform: transformArb };

const rectArb = fc.record({ kind: fc.constant("rect" as const), x: coord, y: coord, width: size, height: size, ...base });
const circleArb = fc.record({ kind: fc.constant("circle" as const), cx: coord, cy: coord, r: fc.integer({ min: 1, max: 50 }), ...base });
const ellipseArb = fc.record({
  kind: fc.constant("ellipse" as const),
  cx: coord,
  cy: coord,
  rx: fc.integer({ min: 1, max: 50 }),
  ry: fc.integer({ min: 1, max: 50 }),
  ...base,
});
const polygonArb = fc.record({
  kind: fc.constant("polygon" as const),
  points: fc.array(fc.tuple(coord, coord), { minLength: 3, maxLength: 6 }),
  ...base,
});
const segmentArb: fc.Arbitrary<PathSegment> = fc.oneof(
  fc.record({ cmd: fc.constantFrom("L" as const, "l" as const), x: coord, y: coord }),
  fc.record({ cmd: fc.constantFrom("H" as const, "h" as const), x: coord }),
  fc.record({ cmd: fc.constantFrom("V" as const, "v" as const), y: coord }),
);
const subpathArb: fc.Arbitrary<Subpath> = fc.record({
  move: fc.constantFrom("M" as const, "m" as const),
  x: coord,
  y: coord,
  segments: fc.array(segmentArb, { minLength: 1, maxLength: 4 }),
  close: fc.constantFrom("Z" as const, "z" as const, "" as const),
});
const pathArb = fc.record({ kind: fc.constant("path" as const), subpaths: fc.array(subpathArb, { minLength: 1, maxLength: 3 }), ...base });

export const shapeArb: fc.Arbitrary<ShapeNode> = fc.oneof(rectArb, rectArb, circleArb, ellipseArb, polygonArb, pathArb);

function nodeArb(depth: number): fc.Arbitrary<DocNode> {
  if (depth === 0) return shapeArb;
  return fc.oneof(
    { weight: 4, arbitrary: shapeArb },
    {
      weight: 1,
      arbitrary: fc.record({
        kind: fc.constant("g" as const),
        children: fc.array(nodeArb(depth - 1), { minLength: 0, maxLength: 4 }),
        ...base,
      }),
    },
  );
}

const viewBoxArb: fc.Arbitrary<readonly [number, number, number, number]> = fc.tuple(
  fc.integer({ min: -10, max: 10 }),
  fc.integer({ min: -10, max: 10 }),
  fc.integer({ min: 1, max: 100 }),
  fc.integer({ min: 1, max: 100 }),
);

/**
 * A Motif_SVG document model. About half of the documents start with a full-viewBox background
 * rect (sometimes inside a group, sometimes with a covering transform) so rule 4.6 takes both
 * branches.
 */
export const motifDocArb: fc.Arbitrary<MotifDoc> = fc
  .record({
    viewBox: viewBoxArb,
    nodes: fc.array(nodeArb(2), { minLength: 0, maxLength: 8 }),
    background: fc.option(hexColourArb, { nil: undefined }),
    backgroundStyle: fc.nat({ max: 2 }),
    xmlDeclaration: fc.boolean(),
    title: fc.option(fc.constantFrom("Motif", "Lozenge &amp; star", "a"), { nil: undefined }),
    comment: fc.boolean(),
    quote: fc.constantFrom('"' as const, "'" as const),
  })
  .map(({ viewBox, nodes, background, backgroundStyle, ...rest }) => {
    if (background === undefined) return { viewBox, nodes, ...rest };
    const [minX, minY, width, height] = viewBox;
    let first: DocNode;
    if (backgroundStyle === 0) {
      first = { kind: "rect", x: minX, y: minY, width, height, fill: background, transform: undefined };
    } else if (backgroundStyle === 1) {
      // Same rect, fill inherited from a group.
      first = {
        kind: "g",
        fill: background,
        transform: undefined,
        children: [{ kind: "rect", x: minX, y: minY, width, height, fill: undefined, transform: undefined }],
      };
    } else {
      // A rect at the origin, scaled by 2 and moved, that covers more than the viewBox.
      first = {
        kind: "rect",
        x: 0,
        y: 0,
        width: width,
        height: height,
        fill: background,
        transform: [
          { op: "translate", tx: minX - width / 2, ty: minY - height / 2, oneArg: false },
          { op: "scale", sx: 2, sy: 2, oneArg: true },
        ],
      };
    }
    return { viewBox, nodes: [first, ...nodes], ...rest };
  });

// ---------------------------------------------------------------------------------------------
// Serializer (test only)

/** Insertions used by the forbidden-construct property. Element indices are pre-order, root = 0. */
export interface Injection {
  /** Raw markup placed immediately before the start tag of element `index` (or before `</svg>` when index is past the last element). Index 0 is not used. */
  readonly beforeElement?: { readonly index: number; readonly text: string };
  /** Raw attribute text appended to the start tag of element `index`. */
  readonly attribute?: { readonly index: number; readonly text: string };
  /** Replaces the fill of element `index` (index 1 or more). */
  readonly fill?: { readonly index: number; readonly value: string };
  /** Raw markup placed after the XML declaration and before the root element. */
  readonly prolog?: string;
}

function num(value: number): string {
  return String(value);
}

function transformText(ops: readonly TransformOp[]): string {
  return ops
    .map((op) => {
      if (op.op === "translate") return op.oneArg ? `translate(${num(op.tx)})` : `translate(${num(op.tx)},${num(op.ty)})`;
      return op.oneArg ? `scale(${num(op.sx)})` : `scale(${num(op.sx)} ${num(op.sy)})`;
    })
    .join(" ");
}

function pathText(subpaths: readonly Subpath[]): string {
  return subpaths
    .map((sub) => {
      const parts = [`${sub.move}${num(sub.x)} ${num(sub.y)}`];
      for (const seg of sub.segments) {
        switch (seg.cmd) {
          case "L":
          case "l":
            parts.push(`${seg.cmd}${num(seg.x)},${num(seg.y)}`);
            break;
          case "H":
          case "h":
            parts.push(`${seg.cmd}${num(seg.x)}`);
            break;
          case "V":
          case "v":
            parts.push(`${seg.cmd} ${num(seg.y)}`);
            break;
        }
      }
      if (sub.close !== "") parts.push(sub.close);
      return parts.join(" ");
    })
    .join(" ");
}

function countElements(nodes: readonly DocNode[]): number {
  let count = 0;
  for (const node of nodes) {
    count += 1;
    if (node.kind === "g") count += countElements(node.children);
  }
  return count;
}

/** Number of elements in the document, including the root `svg`. */
export function elementCount(doc: MotifDoc): number {
  return 1 + countElements(doc.nodes);
}

/** Writes Motif_SVG text for a document model, with optional forbidden-construct insertions. */
export function serializeMotif(doc: MotifDoc, injection: Injection = {}): string {
  const q = doc.quote;
  const attr = (name: string, value: string): string => ` ${name}=${q}${value}${q}`;
  let index = 0;
  const out: string[] = [];
  const extraAttribute = (at: number): string =>
    injection.attribute !== undefined && injection.attribute.index === at ? ` ${injection.attribute.text}` : "";
  const fillOf = (at: number, fill: string | undefined): string | undefined =>
    injection.fill !== undefined && injection.fill.index === at ? injection.fill.value : fill;
  const before = (at: number): void => {
    if (injection.beforeElement !== undefined && injection.beforeElement.index === at) out.push(injection.beforeElement.text);
  };
  const common = (at: number, node: ShapeBase): string => {
    const fill = fillOf(at, node.fill);
    let text = "";
    if (fill !== undefined) text += attr("fill", fill);
    if (node.transform !== undefined) text += attr("transform", transformText(node.transform));
    return text + extraAttribute(at);
  };
  const write = (node: DocNode): void => {
    index += 1;
    const at = index;
    before(at);
    switch (node.kind) {
      case "g":
        out.push(`<g${common(at, node)}>`);
        for (const child of node.children) write(child);
        out.push("</g>");
        return;
      case "rect":
        out.push(`<rect${attr("x", num(node.x))}${attr("y", num(node.y))}${attr("width", num(node.width))}${attr("height", num(node.height))}${common(at, node)}/>`);
        return;
      case "circle":
        out.push(`<circle${attr("cx", num(node.cx))}${attr("cy", num(node.cy))}${attr("r", num(node.r))}${common(at, node)}/>`);
        return;
      case "ellipse":
        out.push(`<ellipse${attr("cx", num(node.cx))}${attr("cy", num(node.cy))}${attr("rx", num(node.rx))}${attr("ry", num(node.ry))}${common(at, node)}></ellipse>`);
        return;
      case "polygon":
        out.push(`<polygon${attr("points", node.points.map(([x, y]) => `${num(x)},${num(y)}`).join(" "))}${common(at, node)}/>`);
        return;
      case "path":
        out.push(`<path${attr("d", pathText(node.subpaths))}${common(at, node)}/>`);
        return;
    }
  };
  if (doc.xmlDeclaration) out.push('<?xml version="1.0" encoding="UTF-8"?>\n');
  if (injection.prolog !== undefined) out.push(injection.prolog);
  const [minX, minY, width, height] = doc.viewBox;
  out.push(`<svg${attr("xmlns", "http://www.w3.org/2000/svg")}${attr("viewBox", `${num(minX)} ${num(minY)} ${num(width)} ${num(height)}`)}${extraAttribute(0)}>\n`);
  if (doc.title !== undefined) out.push(`<title>${doc.title}</title>`);
  if (doc.comment) out.push("<!-- drawn by the test serializer -->");
  for (const node of doc.nodes) {
    write(node);
    out.push("\n");
  }
  before(index + 1);
  out.push("</svg>\n");
  return out.join("");
}

// ---------------------------------------------------------------------------------------------
// Expected parse result (independent model of 4.5 and 4.6)

type Pt = readonly [number, number];

function applyOps(ops: readonly TransformOp[], point: Pt): Pt {
  // The rightmost operation applies to the point first.
  let [x, y] = point;
  for (let i = ops.length - 1; i >= 0; i -= 1) {
    const op = ops[i]!;
    if (op.op === "translate") {
      x += op.tx;
      y += op.ty;
    } else {
      x *= op.sx;
      y *= op.sy;
    }
  }
  return [x, y];
}

/** Applies the transforms of the shape, then of each enclosing group from the innermost outwards. */
function applyChain(chain: readonly (readonly TransformOp[])[], point: Pt): Pt {
  let p = point;
  for (let i = chain.length - 1; i >= 0; i -= 1) p = applyOps(chain[i]!, p);
  return p;
}

export type ExpectedGeometry =
  | { readonly kind: "rect"; readonly corners: readonly Pt[] }
  | { readonly kind: "ellipse"; readonly centre: Pt; readonly rx: number; readonly ry: number }
  | { readonly kind: "polygon"; readonly polygons: readonly (readonly Pt[])[] };

export interface ExpectedShape {
  readonly kind: ShapeNode["kind"];
  readonly colour: string;
  readonly geometry: ExpectedGeometry;
}

function localPathPolygons(subpaths: readonly Subpath[]): Pt[][] {
  const polygons: Pt[][] = [];
  let x = 0;
  let y = 0;
  for (const sub of subpaths) {
    x = sub.move === "M" ? sub.x : x + sub.x;
    y = sub.move === "M" ? sub.y : y + sub.y;
    const start: Pt = [x, y];
    const points: Pt[] = [start];
    for (const seg of sub.segments) {
      switch (seg.cmd) {
        case "L": x = seg.x; y = seg.y; break;
        case "l": x += seg.x; y += seg.y; break;
        case "H": x = seg.x; break;
        case "h": x += seg.x; break;
        case "V": y = seg.y; break;
        case "v": y += seg.y; break;
      }
      points.push([x, y]);
    }
    polygons.push(points);
    if (sub.close !== "") {
      x = start[0];
      y = start[1];
    }
  }
  return polygons;
}

/** Drawn shapes with a non-`none` fill, in document order, with resolved colour and transformed geometry. */
export function expectedShapes(doc: MotifDoc): ExpectedShape[] {
  const shapes: ExpectedShape[] = [];
  const visit = (node: DocNode, inherited: string | undefined, chain: readonly (readonly TransformOp[])[]): void => {
    const fill = node.fill ?? inherited;
    const nextChain = node.transform === undefined ? chain : [...chain, node.transform];
    if (node.kind === "g") {
      for (const child of node.children) visit(child, fill, nextChain);
      return;
    }
    const resolved = fill ?? "#000000";
    if (resolved === "none") return;
    const t = (p: Pt): Pt => applyChain(nextChain, p);
    let geometry: ExpectedGeometry;
    switch (node.kind) {
      case "rect": {
        const { x, y, width: w, height: h } = node;
        geometry = { kind: "rect", corners: [t([x, y]), t([x + w, y]), t([x + w, y + h]), t([x, y + h])] };
        break;
      }
      case "circle":
      case "ellipse": {
        const rx = node.kind === "circle" ? node.r : node.rx;
        const ry = node.kind === "circle" ? node.r : node.ry;
        const centre = t([node.cx, node.cy]);
        const xEdge = t([node.cx + rx, node.cy]);
        const yEdge = t([node.cx, node.cy + ry]);
        geometry = { kind: "ellipse", centre, rx: Math.abs(xEdge[0] - centre[0]), ry: Math.abs(yEdge[1] - centre[1]) };
        break;
      }
      case "polygon":
        geometry = { kind: "polygon", polygons: [node.points.map((p) => t(p))] };
        break;
      case "path":
        geometry = { kind: "polygon", polygons: localPathPolygons(node.subpaths).map((poly) => poly.map(t)) };
        break;
    }
    shapes.push({ kind: node.kind, colour: normaliseColour(resolved), geometry });
  };
  for (const node of doc.nodes) visit(node, undefined, []);
  return shapes;
}

/** True when the rect's transformed corners span the whole viewBox (translate and scale keep it axis-aligned). */
function rectCovers(corners: readonly Pt[], viewBox: readonly [number, number, number, number]): boolean {
  const xs = corners.map((p) => p[0]);
  const ys = corners.map((p) => p[1]);
  const [minX, minY, width, height] = viewBox;
  return Math.min(...xs) <= minX && Math.max(...xs) >= minX + width && Math.min(...ys) <= minY && Math.max(...ys) >= minY + height;
}

/**
 * Expected palette by rule 4.6 (design, Parser): if the first drawn shape is a rect covering the
 * viewBox, its colour is entry 0, else `#ffffff`; other colours follow in first-appearance order.
 * Also returns each shape's expected palette index.
 */
export function expectedPalette(doc: MotifDoc): { palette: string[]; indices: number[] } {
  const shapes = expectedShapes(doc);
  const first = shapes[0];
  const background =
    first !== undefined && first.geometry.kind === "rect" && rectCovers(first.geometry.corners, doc.viewBox)
      ? first.colour
      : "#ffffff";
  const palette = [background];
  const indices = shapes.map((shape) => {
    let index = palette.indexOf(shape.colour);
    if (index === -1) {
      index = palette.length;
      palette.push(shape.colour);
    }
    return index;
  });
  return { palette, indices };
}

// ---------------------------------------------------------------------------------------------
// Designs

/** A design of `picks` by `ends` cells with values below `regions`. */
export function designOf(picks: number, ends: number, regions: number): fc.Arbitrary<number[][]> {
  return fc.array(fc.array(fc.integer({ min: 0, max: regions - 1 }), { minLength: ends, maxLength: ends }), {
    minLength: picks,
    maxLength: picks,
  });
}

/** Noise designs and blocky (upscaled) designs, up to `maxSize` by `maxSize`, with up to `maxRegions` regions. */
export function designArb(maxSize: number, maxRegions: number): fc.Arbitrary<number[][]> {
  const noise = fc
    .record({ picks: fc.integer({ min: 1, max: maxSize }), ends: fc.integer({ min: 1, max: maxSize }), regions: fc.integer({ min: 1, max: maxRegions }) })
    .chain(({ picks, ends, regions }) => designOf(picks, ends, regions));
  const blocky = fc
    .record({
      picks: fc.integer({ min: 1, max: maxSize }),
      ends: fc.integer({ min: 1, max: maxSize }),
      regions: fc.integer({ min: 1, max: maxRegions }),
      scale: fc.integer({ min: 2, max: 5 }),
    })
    .chain(({ picks, ends, regions, scale }) =>
      designOf(Math.ceil(picks / scale), Math.ceil(ends / scale), regions).map((coarse) =>
        Array.from({ length: picks }, (_, p) => Array.from({ length: ends }, (_, e) => coarse[Math.floor(p / scale)]![Math.floor(e / scale)]!)),
      ),
    );
  return fc.oneof(noise, blocky);
}

export const symmetryArb: fc.Arbitrary<Symmetry> = fc.constantFrom("none", "mirrorEnds", "mirrorPicks", "mirrorBoth");

// ---------------------------------------------------------------------------------------------
// Requests

/** Standard padded base64 of `bytes`, written here so the request tests do not rely on src. */
export function toBase64(bytes: readonly number[]): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i]!;
    const b = bytes[i + 1];
    const c = bytes[i + 2];
    const n = (a << 16) | ((b ?? 0) << 8) | (c ?? 0);
    out += alphabet[(n >> 18) & 63]! + alphabet[(n >> 12) & 63]!;
    out += b === undefined ? "=" : alphabet[(n >> 6) & 63]!;
    out += c === undefined ? "=" : alphabet[n & 63]!;
  }
  return out;
}

/** A prompt of 1 to 500 code points with at least one non-whitespace character. */
export const promptArb: fc.Arbitrary<string> = fc
  .oneof(
    fc.string({ minLength: 1, maxLength: 60 }),
    fc.string({ minLength: 1, maxLength: 500, unit: "binary" }),
    fc.constantFrom("a lozenge border", "peacock", "  chevron  ", "मोर", "🦚 star"),
  )
  .filter((prompt) => prompt.trim().length > 0 && Array.from(prompt).length <= 500);

export const sketchDataArb: fc.Arbitrary<string> = fc
  .array(fc.integer({ min: 0, max: 255 }), { minLength: 1, maxLength: 64 })
  .map(toBase64);

export const motifInputArb = fc.oneof(
  { weight: 3, arbitrary: promptArb.map((prompt) => ({ kind: "text" as const, prompt })) },
  {
    weight: 1,
    arbitrary: fc.record({
      kind: fc.constant("sketch" as const),
      mediaType: fc.constantFrom("image/png" as const, "image/jpeg" as const),
      data: sketchDataArb,
    }),
  },
);

/** A valid Motif_Request (1.1, 1.3). */
export const motifRequestArb: fc.Arbitrary<MotifRequest> = fc.record({
  input: motifInputArb,
  colourCount: fc.integer({ min: 2, max: 8 }),
  symmetry: symmetryArb,
  repeat: fc.record({ ends: fc.integer({ min: 8, max: 400 }), picks: fc.integer({ min: 8, max: 400 }) }),
});
