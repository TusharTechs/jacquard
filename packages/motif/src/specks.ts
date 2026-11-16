// Speck removal (Requirement 6). See design.md, "Speck removal".
//
// A speck is a 4-connected area of one region with fewer than `minFeature` cells. Each step takes
// the smallest speck (the one whose first cell comes first in pick-major order on a tie) and
// relabels it to the neighbouring region that shares the most cell edges with it, the lowest region
// index on a tie (6.3). It stops when no speck remains or the design is a single component (6.2).
//
// The design describes the loop as "label the components, take one speck, repeat". Relabelling the
// whole grid every step is quadratic on a noisy 400 by 400 design, so the components are kept up to
// date instead: relabelling speck S to region t joins S with exactly the region-t components that
// touch it, and leaves every other component as it was. The components, and so the speck chosen at
// every step, are the same as with full relabelling. Each step lowers the component count by at
// least one, so there are at most `ends * picks` steps.
//
// 4-connectivity, because cells that touch only at a corner do not interlace on point paper.

type Grid = readonly (readonly number[])[];

interface Component {
  region: number;
  /** Lowest cell index (`pick * ends + end`) in the component. */
  first: number;
  /** Member cells, in no particular order. */
  cells: number[];
}

/** Min-heap of speck candidates ordered by (size, first cell). Entries may be stale. */
class SpeckQueue {
  private readonly items: [size: number, first: number, id: number][] = [];

  push(size: number, first: number, id: number): void {
    const items = this.items;
    items.push([size, first, id]);
    let index = items.length - 1;
    while (index > 0) {
      const parent = (index - 1) >> 1;
      if (!SpeckQueue.less(items[index]!, items[parent]!)) break;
      [items[index], items[parent]] = [items[parent]!, items[index]!];
      index = parent;
    }
  }

  pop(): [number, number, number] | undefined {
    const items = this.items;
    const top = items[0];
    const last = items.pop();
    if (top === undefined || last === undefined) return undefined;
    if (items.length > 0) {
      items[0] = last;
      let index = 0;
      for (;;) {
        const left = 2 * index + 1;
        const right = left + 1;
        let smallest = index;
        if (left < items.length && SpeckQueue.less(items[left]!, items[smallest]!)) smallest = left;
        if (right < items.length && SpeckQueue.less(items[right]!, items[smallest]!)) smallest = right;
        if (smallest === index) break;
        [items[index], items[smallest]] = [items[smallest]!, items[index]!];
        index = smallest;
      }
    }
    return top;
  }

  private static less(a: readonly [number, number, number], b: readonly [number, number, number]): boolean {
    return a[0] < b[0] || (a[0] === b[0] && a[1] < b[1]);
  }
}

/** The up-to-four 4-neighbours of `cell`; -1 marks a side outside the grid. */
function neighbours(cell: number, ends: number, picks: number): [number, number, number, number] {
  const end = cell % ends;
  const pick = (cell - end) / ends;
  return [
    end > 0 ? cell - 1 : -1,
    end < ends - 1 ? cell + 1 : -1,
    pick > 0 ? cell - ends : -1,
    pick < picks - 1 ? cell + ends : -1,
  ];
}

/**
 * Returns a design of the same size with no speck smaller than `minFeature`, unless the whole
 * design is one component (6.1, 6.2). `minFeature` 1 (or less) returns an equal copy (6.6).
 */
export function removeSpecks(design: Grid, minFeature: number): number[][] {
  const picks = design.length;
  const ends = design[0]?.length ?? 0;
  if (picks === 0 || ends === 0 || !(minFeature > 1)) return design.map((cells) => [...cells]);

  const cells: number[] = [];
  for (const row of design) for (let end = 0; end < ends; end += 1) cells.push(row[end] ?? 0);

  // Label the 4-connected components once. `owner[cell]` is the id of the cell's component.
  const owner = new Int32Array(cells.length).fill(-1);
  const components: (Component | undefined)[] = [];
  for (let start = 0; start < cells.length; start += 1) {
    if (owner[start] !== -1) continue;
    const id = components.length;
    const region = cells[start]!;
    const members: number[] = [start];
    owner[start] = id;
    for (let head = 0; head < members.length; head += 1) {
      for (const next of neighbours(members[head]!, ends, picks)) {
        if (next !== -1 && owner[next] === -1 && cells[next] === region) {
          owner[next] = id;
          members.push(next);
        }
      }
    }
    components.push({ region, first: start, cells: members });
  }

  let componentCount = components.length;
  const queue = new SpeckQueue();
  components.forEach((component, id) => {
    if (component !== undefined && component.cells.length < minFeature) {
      queue.push(component.cells.length, component.first, id);
    }
  });

  while (componentCount > 1) {
    const entry = queue.pop();
    if (entry === undefined) break;
    const [size, first, speckId] = entry;
    const speck = components[speckId];
    // Skip stale entries: merged away, or grown since they were queued.
    if (speck === undefined || speck.cells.length !== size || speck.first !== first) continue;

    // Shared edges per neighbouring region, and the neighbouring components of each region.
    const shared = new Map<number, number>();
    const touching = new Map<number, Set<number>>();
    for (const cell of speck.cells) {
      for (const next of neighbours(cell, ends, picks)) {
        if (next === -1 || owner[next] === speckId) continue;
        const region = cells[next]!;
        shared.set(region, (shared.get(region) ?? 0) + 1);
        let ids = touching.get(region);
        if (ids === undefined) touching.set(region, (ids = new Set()));
        ids.add(owner[next]!);
      }
    }
    let target = -1;
    let best = 0;
    for (const [region, count] of shared) {
      if (count > best || (count === best && region < target)) {
        target = region;
        best = count;
      }
    }
    // Unreachable with two or more components, but never loop forever.
    if (target === -1) break;

    // Relabel the speck and join it with every region-target component it touches. The largest
    // member keeps its id and cell list; the others are appended to it.
    for (const cell of speck.cells) cells[cell] = target;
    const ids = [speckId, ...touching.get(target)!];
    let keeperId = speckId;
    for (const id of ids) if (components[id]!.cells.length > components[keeperId]!.cells.length) keeperId = id;
    const keeper = components[keeperId]!;
    keeper.region = target;
    for (const id of ids) {
      if (id === keeperId) continue;
      const joined = components[id]!;
      for (const cell of joined.cells) {
        owner[cell] = keeperId;
        keeper.cells.push(cell);
      }
      if (joined.first < keeper.first) keeper.first = joined.first;
      components[id] = undefined;
      componentCount -= 1;
    }
    if (keeper.cells.length < minFeature) queue.push(keeper.cells.length, keeper.first, keeperId);
  }

  const result: number[][] = [];
  for (let pick = 0; pick < picks; pick += 1) result.push(cells.slice(pick * ends, (pick + 1) * ends));
  return result;
}
