// Deterministic stand-in motif generator (Requirement 8). See design.md, "Stand_In".
//
// Used when model access is not available. It never traces a sketch: an FNV-1a 32-bit hash of the
// prompt text or the sketch data, combined with the colour count, symmetry and repeat, picks a
// motif family and a starting point in a fixed list of yarn-like colours. Output is Motif_SVG in a
// `0 0 100 100` viewBox with a full-size background rect first and exactly `colourCount` colours
// in total (8.3, 8.4). All coordinates are integers written with `String`, so the text does not
// depend on locale (8.2). No network (8.1).
import type { MotifRequest } from "./request.js";

export const STAND_IN_FAMILIES: readonly string[] = ["lozenge", "stripe", "chevron", "star", "check"];

/**
 * Yarn-like colours, ordered so that neighbours (including last to first) alternate light and
 * dark. A palette is a run of consecutive entries, so neighbouring regions contrast.
 */
const YARN_COLOURS: readonly string[] = [
  "#f2e8d5", // undyed cream
  "#7a1f2b", // madder red
  "#e2a72e", // turmeric
  "#1e3a5f", // indigo
  "#9cc5a1", // sage
  "#4a2c2a", // walnut
  "#e8b4a0", // rose clay
  "#2f5d50", // forest green
  "#d9c86a", // saffron
  "#5b3f7a", // aubergine
  "#a8c8e0", // sky
  "#b4442c", // rust
];

/** Unit directions at multiples of 22.5 degrees, as fixed constants so no trig runs. */
const DIRECTIONS: readonly (readonly [number, number])[] = (() => {
  const c1 = 0.9238795325112867;
  const c2 = 0.7071067811865476;
  const c3 = 0.3826834323650898;
  const quarter: [number, number][] = [
    [1, 0],
    [c1, c3],
    [c2, c2],
    [c3, c1],
  ];
  const all: [number, number][] = [];
  for (let turn = 0; turn < 4; turn += 1) {
    for (const [x, y] of quarter) {
      // Rotate by 90 degrees per turn.
      if (turn === 0) all.push([x, y]);
      else if (turn === 1) all.push([-y, x]);
      else if (turn === 2) all.push([-x, -y]);
      else all.push([y, -x]);
    }
  }
  return all;
})();

/** FNV-1a 32-bit over the UTF-16 code units of `text`. */
function fnv1a(text: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

function points(list: readonly (readonly [number, number])[]): string {
  return list.map(([x, y]) => `${String(x)},${String(y)}`).join(" ");
}

function polygon(list: readonly (readonly [number, number])[], fill: string): string {
  return `<polygon points="${points(list)}" fill="${fill}"/>`;
}

function rect(x: number, y: number, width: number, height: number, fill: string): string {
  return `<rect x="${String(x)}" y="${String(y)}" width="${String(width)}" height="${String(height)}" fill="${fill}"/>`;
}

/** Shapes for one family. `colours` excludes the background; every entry is used at least once. */
function familyShapes(family: string, colours: readonly string[]): string[] {
  const k = colours.length;
  const shapes: string[] = [];
  const colour = (index: number): string => colours[index % k] as string;
  switch (family) {
    case "lozenge":
      // Nested diamonds, largest first.
      for (let i = 0; i < k; i += 1) {
        const r = Math.round((50 * (k - i)) / k);
        shapes.push(polygon([[50, 50 - r], [50 + r, 50], [50, 50 + r], [50 - r, 50]], colour(i)));
      }
      break;
    case "stripe":
      // Nested full-width bands centred on the middle pick, widest first.
      for (let i = 0; i < k; i += 1) {
        const half = Math.round((50 * (k - i)) / (k + 1));
        shapes.push(rect(0, 50 - half, 100, 2 * half, colour(i)));
      }
      break;
    case "chevron": {
      // Contiguous chevron bands, apex up, each `step` units thick.
      const step = Math.round(100 / (k + 1));
      for (let i = 1; i <= k; i += 1) {
        const top = i * step;
        const bottom = top + step;
        shapes.push(
          polygon(
            [[0, top], [50, top - 20], [100, top], [100, bottom], [50, bottom - 20], [0, bottom]],
            colour(i - 1),
          ),
        );
      }
      break;
    }
    case "star":
      // Nested eight-point stars centred in the viewBox, largest first.
      for (let i = 0; i < k; i += 1) {
        const outer = (48 * (k - i)) / k;
        const inner = outer * 0.5;
        const vertices = DIRECTIONS.map(([x, y], index): [number, number] => {
          const radius = index % 2 === 0 ? outer : inner;
          return [Math.round(50 + radius * x), Math.round(50 + radius * y)];
        });
        shapes.push(polygon(vertices, colour(i)));
      }
      break;
    default: {
      // check: a 4 by 4 board of 25-unit squares; the dark squares cycle through the colours.
      let used = 0;
      for (let row = 0; row < 4; row += 1) {
        for (let column = 0; column < 4; column += 1) {
          if ((row + column) % 2 === 0) continue;
          shapes.push(rect(column * 25, row * 25, 25, 25, colour(used)));
          used += 1;
        }
      }
      break;
    }
  }
  return shapes;
}

/** Deterministic Motif_SVG for a valid Motif_Request (Requirement 8). */
export function standInMotif(request: MotifRequest): string {
  const source = request.input.kind === "text" ? `text:${request.input.prompt}` : `sketch:${request.input.data}`;
  const key = `${source}|${String(request.colourCount)}|${request.symmetry}|${String(request.repeat.ends)}x${String(request.repeat.picks)}`;
  const hash = fnv1a(key);
  const family = STAND_IN_FAMILIES[hash % STAND_IN_FAMILIES.length] as string;
  const offset = (hash >>> 8) % YARN_COLOURS.length;
  const palette: string[] = [];
  for (let index = 0; index < request.colourCount; index += 1) {
    palette.push(YARN_COLOURS[(offset + index) % YARN_COLOURS.length] as string);
  }
  const [background, ...others] = palette;
  const body = [rect(0, 0, 100, 100, background as string), ...familyShapes(family, others)];
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">',
    `<title>Stand-in motif: ${family}</title>`,
    ...body,
    "</svg>",
  ].join("");
}
