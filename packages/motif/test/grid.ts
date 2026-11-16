// Grid helpers for the motif property tests. Written independently of `src`.

export type Grid = readonly (readonly number[])[];

export interface TestComponent {
  readonly region: number;
  /** Cells as [pick, end], in pick-major order. */
  readonly cells: readonly (readonly [number, number])[];
}

const STEPS: readonly (readonly [number, number])[] = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

/** 4-connected components, listed in pick-major order of their first cell (depth-first flood fill). */
export function componentsOf(design: Grid): TestComponent[] {
  const picks = design.length;
  const ends = design[0]?.length ?? 0;
  const seen = design.map((row) => row.map(() => false));
  const result: TestComponent[] = [];
  for (let pick = 0; pick < picks; pick += 1) {
    for (let end = 0; end < ends; end += 1) {
      if (seen[pick]![end]) continue;
      const region = design[pick]![end]!;
      const cells: [number, number][] = [];
      const stack: [number, number][] = [[pick, end]];
      seen[pick]![end] = true;
      while (stack.length > 0) {
        const [p, e] = stack.pop()!;
        cells.push([p, e]);
        for (const [dp, de] of STEPS) {
          const np = p + dp;
          const ne = e + de;
          if (np < 0 || np >= picks || ne < 0 || ne >= ends) continue;
          if (seen[np]![ne] || design[np]![ne] !== region) continue;
          seen[np]![ne] = true;
          stack.push([np, ne]);
        }
      }
      cells.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      result.push({ region, cells });
    }
  }
  return result;
}

/** For each region bordering the component, the number of cell edges it shares with it. */
export function sharedEdges(design: Grid, component: TestComponent): Map<number, number> {
  const inside = new Set(component.cells.map(([p, e]) => `${p},${e}`));
  const counts = new Map<number, number>();
  for (const [p, e] of component.cells) {
    for (const [dp, de] of STEPS) {
      const np = p + dp;
      const ne = e + de;
      const value = design[np]?.[ne];
      if (value === undefined || inside.has(`${np},${ne}`)) continue;
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
  }
  return counts;
}

/** The region with the most shared edges, lowest index on a tie; undefined when there is no neighbour. */
export function mergeTarget(counts: ReadonlyMap<number, number>): number | undefined {
  let best: number | undefined;
  for (const [region, count] of [...counts].sort((a, b) => a[0] - b[0])) {
    if (best === undefined || count > counts.get(best)!) best = region;
  }
  return best;
}

export function isSymmetric(design: Grid, symmetry: "none" | "mirrorEnds" | "mirrorPicks" | "mirrorBoth"): boolean {
  const picks = design.length;
  for (let pick = 0; pick < picks; pick += 1) {
    const row = design[pick]!;
    const ends = row.length;
    for (let end = 0; end < ends; end += 1) {
      if ((symmetry === "mirrorEnds" || symmetry === "mirrorBoth") && row[end] !== row[ends - 1 - end]) return false;
      if ((symmetry === "mirrorPicks" || symmetry === "mirrorBoth") && row[end] !== design[picks - 1 - pick]![end]) return false;
    }
  }
  return true;
}

export function copyGrid(design: Grid): number[][] {
  return design.map((row) => [...row]);
}
