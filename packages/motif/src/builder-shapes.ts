// Shapes for the motif builder (motif-builder Requirement 2). See motif-builder design.md,
// "src/motif-builder.ts and src/builder-shapes.ts".
//
// Figures are drawn in a unit box [-1, 1] by [-1, 1] with SVG's y axis (down); pattern subjects are
// drawn straight into the 0 0 100 100 viewBox. A layer is a set of polygons of one colour role:
// 1 the main figure colour, 2 the second, 3 the third, 0 the ground (a cut-out). Every figure and
// pattern has layers for roles 1, 2 and 3, so the palette is always the plan's colours.
//
// Feature sizes are chosen so that, in the smallest slot (radius 14) on a 48-pick repeat, each role
// keeps a part at least one cell across and is not lost as a speck [decision].
import type { BuilderSubject } from "./describe.js";

export type Pt = readonly [x: number, y: number];
export type Role = 0 | 1 | 2 | 3;

export interface Layer {
  readonly role: Role;
  readonly polygons: readonly (readonly Pt[])[];
  /**
   * Roles tried in order when this role has no colour of its own; the first one that has a colour
   * is used. Without one (or when none has a colour): role 3 → 1, role 2 → 0 (design).
   */
  readonly fallback?: Role | readonly Role[];
}

/** Steps per disc outline and per petal side: fixed, so output is deterministic. */
const DISC_STEPS = 16;
const PETAL_STEPS = 12;

export function disc(cx: number, cy: number, r: number, steps = DISC_STEPS): Pt[] {
  const points: Pt[] = [];
  for (let index = 0; index < steps; index += 1) {
    const angle = (2 * Math.PI * index) / steps;
    points.push([cx + r * Math.cos(angle), cy + r * Math.sin(angle)]);
  }
  return points;
}

export function ellipse(cx: number, cy: number, rx: number, ry: number, steps = 20): Pt[] {
  const points: Pt[] = [];
  for (let index = 0; index < steps; index += 1) {
    const angle = (2 * Math.PI * index) / steps;
    points.push([cx + rx * Math.cos(angle), cy + ry * Math.sin(angle)]);
  }
  return points;
}

export function box(x0: number, y0: number, x1: number, y1: number): Pt[] {
  return [
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1],
  ];
}

export function lozenge(cx: number, cy: number, half: number): Pt[] {
  return [
    [cx, cy - half],
    [cx + half, cy],
    [cx, cy + half],
    [cx - half, cy],
  ];
}

/**
 * A petal along direction `angle` from radius `s0` to `s1`. `shape(t)` is the half-width profile
 * (0 at both ends for a pointed petal); the half-width is capped at `cap · s` so neighbours keep apart.
 */
function petal(angle: number, s0: number, s1: number, width: number, shape: (t: number) => number, cap: number): Pt[] {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const left: Pt[] = [];
  const right: Pt[] = [];
  for (let index = 0; index <= PETAL_STEPS; index += 1) {
    const t = index / PETAL_STEPS;
    const s = s0 + (s1 - s0) * t;
    const w = Math.min(width * shape(t), cap * s);
    left.push([s * dx - w * dy, s * dy + w * dx]);
    right.push([s * dx + w * dy, s * dy - w * dx]);
  }
  return [...left, ...right.reverse().slice(1, -1)];
}

const pointed = (t: number): number => Math.pow(Math.sin(Math.PI * Math.pow(t, 0.8)), 0.85);
const rounded = (t: number): number => Math.sqrt(Math.max(0, 1 - (2 * t - 1) * (2 * t - 1)));

/** Discs along a quadratic curve with radius `radius(t)`: a tapering stroke as a union of discs. */
function stroke(p0: Pt, p1: Pt, p2: Pt, radius: (t: number) => number, count: number, until = 1): Pt[][] {
  const discs: Pt[][] = [];
  for (let index = 0; index < count; index += 1) {
    const t = (index / (count - 1)) * until;
    const a = (1 - t) * (1 - t);
    const b = 2 * (1 - t) * t;
    const c = t * t;
    const x = a * p0[0] + b * p1[0] + c * p2[0];
    const y = a * p0[1] + b * p1[1] + c * p2[1];
    const r = radius(t);
    if (r > 0) discs.push(disc(x, y, r));
  }
  return discs;
}

function ring(n: number, offset: number): number[] {
  return Array.from({ length: n }, (_, index) => -Math.PI / 2 + offset + (2 * Math.PI * index) / n);
}

/** Petal cap factor: few petals stay well apart (the four-petal lotus), many may nearly touch. */
function capFor(n: number, few: number, many: number): number {
  return (n <= 5 ? few : many) * Math.tan(Math.PI / n);
}

function lotus(n: number): Layer[] {
  const cap = capFor(n, 0.6, 0.9);
  return [
    { role: 2, polygons: ring(n, Math.PI / n).map((angle) => petal(angle, 0.15, 0.64, 0.24, pointed, cap)) },
    { role: 1, polygons: ring(n, 0).map((angle) => petal(angle, 0.24, 0.98, 0.32, pointed, cap)) },
    { role: 3, fallback: 2, polygons: [disc(0, 0, 0.24)] },
  ];
}

function rosette(n: number): Layer[] {
  const cap = capFor(n, 0.8, 0.95);
  return [
    { role: 1, polygons: ring(n, 0).map((angle) => petal(angle, 0.22, 0.97, 0.3, rounded, cap)) },
    { role: 2, polygons: [disc(0, 0, 0.36)] },
    { role: 3, polygons: [disc(0, 0, 0.2)] },
  ];
}

function starPolygon(n: number, outer: number, inner: number): Pt[] {
  const points: Pt[] = [];
  for (let index = 0; index < 2 * n; index += 1) {
    const angle = -Math.PI / 2 + (Math.PI * index) / n;
    const r = index % 2 === 0 ? outer : inner;
    points.push([r * Math.cos(angle), r * Math.sin(angle)]);
  }
  return points;
}

function star(n: number): Layer[] {
  const inner = n <= 5 ? 0.42 : 0.5;
  return [
    { role: 1, polygons: [starPolygon(n, 0.98, 0.98 * inner)] },
    { role: 2, polygons: [starPolygon(n, 0.6, 0.6 * inner)] },
    { role: 3, polygons: [disc(0, 0, 0.22)] },
  ];
}

function diamond(): Layer[] {
  return [
    { role: 1, polygons: [lozenge(0, 0, 0.98)] },
    { role: 2, polygons: [lozenge(0, 0, 0.64)] },
    { role: 3, polygons: [lozenge(0, 0, 0.32)] },
  ];
}

/** Faces +x: the tail curls to the right. */
function paisley(): Layer[] {
  const p0: Pt = [-0.12, 0.36];
  const p1: Pt = [-0.42, -0.62];
  const p2: Pt = [0.5, -0.86];
  const radius = (t: number): number => 0.56 * Math.pow(1 - t, 1.3) + 0.04;
  return [
    { role: 1, polygons: stroke(p0, p1, p2, radius, 12) },
    { role: 2, polygons: stroke(p0, p1, p2, (t) => 0.62 * radius(t) - 0.02, 10, 0.8) },
    // A ground-coloured core inside the inner drop, so the three layers read as outlines.
    { role: 3, fallback: 0, polygons: stroke(p0, p1, p2, (t) => 0.18 - 0.2 * t, 4, 0.4) },
  ];
}

function tree(): Layer[] {
  const canopy: Pt[][] = [
    disc(0, -0.32, 0.46, 20),
    disc(-0.4, -0.08, 0.3),
    disc(0.4, -0.08, 0.3),
    disc(0, -0.72, 0.26),
    disc(-0.3, -0.56, 0.28),
    disc(0.3, -0.56, 0.28),
  ];
  const fruit: Pt[][] = [
    disc(-0.22, -0.38, 0.1, 12),
    disc(0.22, -0.38, 0.1, 12),
    disc(0, -0.68, 0.1, 12),
    disc(-0.42, -0.08, 0.1, 12),
    disc(0.42, -0.08, 0.1, 12),
  ];
  return [
    { role: 2, fallback: 1, polygons: [box(-0.11, -0.05, 0.11, 0.8)] },
    { role: 1, polygons: canopy },
    { role: 3, fallback: 2, polygons: fruit },
    {
      role: 3,
      fallback: [2, 1],
      polygons: [
        [
          [-0.44, 0.7],
          [0.44, 0.7],
          [0.32, 0.98],
          [-0.32, 0.98],
        ],
      ],
    },
  ];
}

/** Side view, facing +x: crested head on a curved neck, the train sweeping behind and down. */
function peacock(): Layer[] {
  const neck = stroke([0.24, 0], [0.46, -0.12], [0.38, -0.36], (t) => 0.14 - 0.05 * t, 6);
  const train: Pt[] = [
    [-0.12, -0.12],
    [-0.5, -0.12],
    [-0.82, 0.04],
    [-0.98, 0.32],
    [-0.96, 0.62],
    [-0.8, 0.8],
    [-0.52, 0.72],
    [-0.28, 0.5],
    [-0.08, 0.3],
  ];
  const eyes: Pt[] = [
    [-0.42, 0.06],
    [-0.72, 0.2],
    [-0.84, 0.5],
    [-0.6, 0.48],
    [-0.36, 0.34],
  ];
  return [
    { role: 1, polygons: [train] },
    { role: 2, polygons: eyes.map(([x, y]) => disc(x, y, 0.12)) },
    { role: 3, fallback: 0, polygons: eyes.map(([x, y]) => disc(x, y, 0.05, 10)) },
    // Body, neck and head; the beak.
    {
      role: 2,
      fallback: 1,
      polygons: [
        ellipse(0.04, 0.12, 0.38, 0.26, 24),
        ...neck,
        disc(0.4, -0.46, 0.14),
        [
          [0.5, -0.52],
          [0.68, -0.44],
          [0.5, -0.38],
        ],
      ],
    },
    // The wing on the body, the crest and the legs.
    {
      role: 3,
      fallback: 1,
      polygons: [
        ellipse(-0.02, 0.12, 0.2, 0.13, 20),
        disc(0.28, -0.72, 0.06, 10),
        disc(0.4, -0.78, 0.06, 10),
        disc(0.52, -0.72, 0.06, 10),
        box(0.37, -0.74, 0.43, -0.58),
        box(0, 0.32, 0.06, 0.9),
        box(0.16, 0.32, 0.22, 0.9),
        box(0, 0.86, 0.14, 0.92),
        box(0.16, 0.86, 0.3, 0.92),
      ],
    },
  ];
}

/** Side view, facing +x, with a saddle cloth. */
function elephant(): Layer[] {
  const trunk = stroke([0.66, -0.06], [0.98, 0.32], [0.78, 0.8], (t) => 0.13 - 0.06 * t, 8);
  return [
    {
      role: 1,
      polygons: [
        ellipse(-0.12, 0, 0.58, 0.4, 24),
        disc(0.44, -0.18, 0.3, 20),
        box(-0.62, 0.15, -0.42, 0.92),
        box(-0.32, 0.15, -0.12, 0.92),
        box(0.06, 0.15, 0.26, 0.92),
        box(0.3, 0.1, 0.48, 0.92),
        [
          [-0.68, -0.08],
          [-0.62, -0.1],
          [-0.78, 0.4],
          [-0.84, 0.38],
        ],
        ...trunk,
      ],
    },
    // Saddle cloth on the back, with a band along its lower edge.
    {
      role: 2,
      fallback: 0,
      polygons: [
        [
          [-0.5, -0.34],
          [0.02, -0.38],
          [0.04, 0.14],
          [-0.52, 0.14],
        ],
      ],
    },
    { role: 3, fallback: 1, polygons: [box(-0.52, -0.04, 0.04, 0.14)] },
    // The ear, set off from the head by a ground-coloured outline; the tusk and the eye.
    { role: 0, polygons: [ellipse(0.31, -0.12, 0.2, 0.27, 20)] },
    { role: 1, polygons: [ellipse(0.31, -0.12, 0.15, 0.22, 20)] },
    {
      role: 0,
      polygons: [
        [
          [0.6, 0.08],
          [0.68, 0.06],
          [0.9, 0.2],
          [0.86, 0.26],
        ],
        disc(0.56, -0.28, 0.045, 8),
      ],
    },
  ];
}

/** Layers of a figure in the unit box. `count` is the petal or point count where there is one. */
export function figureLayers(subject: BuilderSubject, count: number | null): Layer[] {
  switch (subject) {
    case "lotus":
      return lotus(count ?? 8);
    case "rosette":
      return rosette(count ?? 8);
    case "star":
      return star(count ?? 8);
    case "diamond":
      return diamond();
    case "paisley":
      return paisley();
    case "tree":
      return tree();
    case "peacock":
      return peacock();
    case "elephant":
      return elephant();
    default:
      return rosette(count ?? 8);
  }
}

// ---------------------------------------------------------------------------------------------
// Pattern subjects, in viewBox units (0 to 100), symmetric about x = 50 and y = 50.

/** Sutherland–Hodgman clip of a convex polygon to the viewBox. */
function clipToBox(polygon: readonly Pt[]): Pt[] {
  const edges: ((p: Pt) => number)[] = [(p) => p[0], (p) => 100 - p[0], (p) => p[1], (p) => 100 - p[1]];
  let output: Pt[] = [...polygon];
  for (const inside of edges) {
    const input = output;
    output = [];
    for (let index = 0; index < input.length; index += 1) {
      const current = input[index] as Pt;
      const previous = input[(index + input.length - 1) % input.length] as Pt;
      const a = inside(previous);
      const b = inside(current);
      if (b >= 0) {
        if (a < 0) output.push(cross(previous, current, a, b));
        output.push(current);
      } else if (a >= 0) {
        output.push(cross(previous, current, a, b));
      }
    }
    if (output.length === 0) break;
  }
  return output;
}

function cross(p: Pt, q: Pt, a: number, b: number): Pt {
  const t = a / (a - b);
  return [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
}

/** The strip |(x ∓ y) − d| ≤ half·√2 along a diagonal, clipped to the viewBox. */
function diagonalBar(d: number, rising: boolean, half: number): Pt[] {
  const offset = half * Math.SQRT2;
  // Falling bars follow x − y = d; rising bars follow x + y = d.
  const polygon: Pt[] = rising
    ? [
        [d - offset - 200, 200],
        [d + offset - 200, 200],
        [d + offset + 200, -200],
        [d - offset + 200, -200],
      ]
    : [
        [d - offset - 200, -200],
        [d + offset - 200, -200],
        [d + offset + 200, 200],
        [d - offset + 200, 200],
      ];
  return clipToBox(polygon);
}

function stripes(n: number): Layer[] {
  const pitch = 100 / n;
  const bands: Pt[][] = [];
  const outerBands: Pt[][] = [];
  const centres: Pt[][] = [];
  for (let index = 0; index < n; index += 1) {
    const centre = (index + 0.5) * pitch;
    const half = 0.3 * pitch;
    const ring = Math.min(index, n - 1 - index);
    (ring % 2 === 0 ? bands : outerBands).push(box(0, centre - half, 100, centre + half));
    centres.push(box(0, centre - 0.125 * pitch, 100, centre + 0.125 * pitch));
  }
  if (n <= 2) {
    outerBands.push(box(0, 0, 100, 6), box(0, 94, 100, 100));
  }
  return [
    { role: 1, polygons: bands },
    { role: 3, polygons: outerBands },
    { role: 2, polygons: centres },
  ];
}

function checks(n: number): Layer[] {
  const pitch = 100 / n;
  const half = 0.18 * pitch;
  const bands: Pt[][] = [];
  const crossings: Pt[][] = [];
  const centres: Pt[][] = [];
  for (let index = 0; index < n; index += 1) {
    const c = (index + 0.5) * pitch;
    bands.push(box(c - half, 0, c + half, 100), box(0, c - half, 100, c + half));
    for (let other = 0; other < n; other += 1) {
      const d = (other + 0.5) * pitch;
      crossings.push(box(c - half, d - half, c + half, d + half));
      centres.push(box(c - 0.07 * pitch, d - 0.07 * pitch, c + 0.07 * pitch, d + 0.07 * pitch));
    }
  }
  return [
    { role: 1, polygons: bands },
    { role: 2, polygons: crossings },
    { role: 3, polygons: centres },
  ];
}

function lattice(n: number): Layer[] {
  const spacing = 100 / n;
  const bars: Pt[][] = [];
  for (let k = -n; k <= 2 * n; k += 1) {
    const falling = diagonalBar(k * spacing, false, 3);
    if (falling.length >= 3) bars.push(falling);
    const rising = diagonalBar(k * spacing, true, 3);
    if (rising.length >= 3) bars.push(rising);
  }
  const crossings: Pt[][] = [];
  const cells: Pt[][] = [];
  // Bars run along x − y = a·spacing and x + y = b·spacing. With a and b doubled (a2, b2), both
  // even is a crossing and both odd is the centre of a diamond cell.
  for (let a2 = -4 * n; a2 <= 4 * n; a2 += 1) {
    for (let b2 = 0; b2 <= 4 * n; b2 += 1) {
      const evenA = Math.abs(a2) % 2 === 0;
      const evenB = b2 % 2 === 0;
      if (evenA !== evenB) continue;
      const x = ((a2 + b2) * spacing) / 4;
      const y = ((b2 - a2) * spacing) / 4;
      if (x < -0.01 || x > 100.01 || y < -0.01 || y > 100.01) continue;
      const shape = evenA ? clipToBox(lozenge(x, y, 0.2 * spacing + 2)) : clipToBox(lozenge(x, y, 0.16 * spacing + 1));
      if (shape.length >= 3) (evenA ? crossings : cells).push(shape);
    }
  }
  return [
    { role: 1, polygons: bars },
    { role: 2, polygons: crossings },
    { role: 3, fallback: 1, polygons: cells },
  ];
}

function borderBand(n: number): Layer[] {
  const pitch = 100 / n;
  const teeth: Pt[][] = [];
  const diamonds: Pt[][] = [];
  for (let index = 0; index < n; index += 1) {
    const c = (index + 0.5) * pitch;
    const half = 0.42 * pitch;
    teeth.push(
      [
        [c - half, 92],
        [c + half, 92],
        [c, 58],
      ],
      [
        [c - half, 8],
        [c + half, 8],
        [c, 42],
      ],
    );
  }
  for (let index = 0; index <= n; index += 1) {
    const shape = clipToBox(lozenge(index * pitch, 50, Math.min(0.4 * pitch, 10)));
    if (shape.length >= 3) diamonds.push(shape);
  }
  return [
    { role: 2, fallback: 1, polygons: [box(0, 0, 100, 8), box(0, 92, 100, 100)] },
    { role: 1, polygons: teeth },
    { role: 3, fallback: 2, polygons: diamonds },
  ];
}

/** Layers of a pattern subject in viewBox units. */
export function patternLayers(subject: BuilderSubject, count: number | null): Layer[] {
  switch (subject) {
    case "stripe":
      return stripes(count ?? 3);
    case "check":
      return checks(count ?? 2);
    case "lattice":
      return lattice(count ?? 2);
    default:
      return borderBand(count ?? 4);
  }
}
