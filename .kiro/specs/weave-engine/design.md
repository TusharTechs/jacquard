# Design Document: weave-engine

Traces to `requirements.md` draft 3. Acceptance criteria are cited as `N.M` (criterion M of Requirement N). Correctness properties are cited as Property N.

## Overview

`@jacquard/engine` is a pure TypeScript library. It turns a design (a grid of region indices), a weave assignment and a loom profile into a lift plan, checks the lift plan for floats, repairs floats, and encodes and decodes punch cards. It has no runtime dependencies and no I/O.

```
design + weaves + profile + options
        │ validateInput (1.5, 1.7, Requirement 3)
        ▼
  buildLiftPlan ──► { plan, idleHooks, warnings }      (2.1–2.6, 2.12)
        │
        ├─► checkFloats(plan, profile) ──► Violation[]  (Requirement 4)
        ├─► autoFix(plan, profile)     ──► { plan, flips } | error   (Requirement 5)
        └─► buildCards(plan, profile)  ──► CardSet      (2.7–2.9)
                    decodeCards(cardSet, profile) ──► plan   (2.10, 2.11)
```

Every public function returns an `EngineResult<T>`, which is `Result<T, EngineError>`. `result.ts` defines the generic `Result<T, E>` with no default for `E`; `errors.ts` defines `EngineResult<T>`. Expected failures are values, never thrown. A thrown exception means an engine bug.

## Architecture

### Package layout

```
packages/engine/
├── package.json            "@jacquard/engine", type module, sideEffects false, no "dependencies"
├── tsconfig.json           src only; strict; lib ES2022; "types": [] (no Node or DOM types)
├── tsconfig.test.json      src + test; adds vitest and node types
├── vitest.config.ts
├── src/
│   ├── index.ts            public exports only
│   ├── types.ts            Design, Weave, LoomProfile, LiftPlan, Card, CardSet, Violation, Warning
│   ├── result.ts           Result<T, E>, ok(), err()
│   ├── errors.ts           EngineError union, EngineResult<T> = Result<T, EngineError>, constructors
│   ├── profiles.ts         built-in profiles, defineProfile(), validateProfile()
│   ├── weaves.ts           validateWeave(), weavePeriod(), evaluateWeave()
│   ├── validate.ts         validateInput() in 3.7 order
│   ├── lift-plan.ts        buildLiftPlan(), validatePlan() (2.13)
│   ├── cards.ts            buildCards(), decodeCards(), cardRows()
│   ├── runs.ts             ring and linear run extraction
│   ├── floats.ts           checkFloats(), violation ordering
│   └── auto-fix.ts         autoFix()
└── test/
    ├── arbitraries.ts      fast-check generators
    ├── oracle.ts           naive float checker used by Property 18
    ├── fixtures/           golden fixtures (read-only)
    ├── *.test.ts           example tests
    └── *.property.test.ts  property tests
```

Workspace root gets `package.json`, `pnpm-workspace.yaml` (`packages/*`, `apps/*`) and `tsconfig.base.json`.

`"types": []` in the src tsconfig makes any use of `process`, `Buffer`, `window` or `document` a type error, which enforces 6.2 and the steering rule "no Node-only APIs".

### Determinism constraints (Requirement 6)

- No `Date`, `Math.random`, `Intl`, `toLocale*`, `process`, `globalThis` lookups or `fetch` in `src/`. The src tsconfig has `"types": []`, and an example test scans `src/` for these names (6.2).
- All iteration is over arrays or integer-keyed records in ascending order. There is no `Set` or `Map` iteration in output paths.
- Inputs are read only. Outputs are fresh arrays (6.3).

## Components and Interfaces

### Profiles (1.2–1.5)

`profiles.ts` exports `PROFILE_120`, `PROFILE_240`, `PROFILE_400` (frozen objects) and `defineProfile(fields)`, which fills `maxWarpFloat` and `maxWeftFloat` from `maxFloat` when they are omitted and fills the other defaults from 1.2. When `hookCount` is 120, 240 or 400, the other defaults come from that built-in profile, so a custom 400-hook profile gets the sourced 16 spare hooks unless the caller overrides them. Any other `hookCount` gets the fallback defaults (`hooksPerCardRow` 8, `spareHookCount` 0, and so on), labelled `[to verify]`.

Each default carries its label in a comment, for example:

```ts
hooksPerCardRow: 8, // [sourced] S1: "There are four hundred hooks and four hundred needles in the machine which are in rows of eight hooks and eight needles."
spareHookCount: 16, // [sourced] S1: "A needle board or plate for a 400-machine, has 416 holes, arranged in 52 rows with 8 holes in a row."
maxFloat: 8,        // [decision] working default; depends on thread density
```

For 120 and 240, `hooksPerCardRow: 8` and `spareHookCount: 0` carry `// to verify`.

`validateProfile` checks fields in the order they appear in the 1.2 table and returns the first failure as `PROFILE_INVALID`.

### Weaves (1.6, 1.7, 2.3)

`evaluateWeave(weave, end, pick): boolean` takes any non-negative integers and implements 2.3 exactly. `mod` is the non-negative remainder `((a % n) + n) % n`.

`weavePeriod(weave)`: plain 2, twill `up + down`, satin `size`.

Allowed satin moves are a table, `{ 5: [2, 3], 8: [3, 5] }`, not a computed coprimality test, so the rule in 1.6 is visible in one line.

`validateWeave(region, weave)` checks `kind`, then the parameters in declaration order, and returns `WEAVE_INVALID` with the first bad parameter.

### Lift plan builder (2.1–2.6, 2.12, 2.13)

`buildLiftPlan(input: BuildInput): Result<BuildOutput>` first runs `validateInput` (see Error Handling, Validation order).

#### Evaluation

For each pick `p` and hook `h`:
- If `h < width`: `lifts[p][h] = evaluateWeave(weaves[design[p][h]], h, p)`.
- Else if `repeatAcross`: `lifts[p][h] = lifts[p][h mod width]` (2.5).
- Else: `false`, and `h` is in `idleHooks` (2.4).

`idleHooks` is `[width, …, hookCount − 1]` when repeat is off, otherwise `[]`.

#### Warnings (2.12)

For each used region `r` in ascending order, with `P = weavePeriod(weaves[r])`:
- if `pickCount mod P ≠ 0`: warning `{ region: r, period: P, dimension: "picks", size: pickCount }`;
- then, if `repeatAcross` and `width mod P ≠ 0`: warning `{ …, dimension: "ends", size: width }`.

#### Plan validation (2.13)

`validatePlan(plan, profile)` is called first by `checkFloats`, `autoFix` and `buildCards`. Its checks are listed under Error Handling, Plan validation order.

### Cards (2.7–2.11)

#### Positions and layout

`positionCount = hookCount + spareHookCount`. Figuring hook `h` is position `h`. Spare hook `s` is position `hookCount + s` (the only placement in version 1).

`cardRows(card, profile): (boolean | null)[][]` returns `ceil(positionCount / hooksPerCardRow)` rows of `hooksPerCardRow` slots. Slot `k` of row `r` is position `r × hooksPerCardRow + k`, or `null` when that index is `≥ positionCount`. Slot 0 is the top needle of the row [sourced]. Row 0 nearest the numbered end of the card is [to verify]; the export spec owns the physical orientation.

#### Encoding

`down = (holeMeans === "noLift")` is the punched state that keeps a hook down. For pick `p`, `cards[p] = { index: p, number: p + 1, punched }` where:
- figuring position `h`: `punched[h] = lifts[p][h] !== down` (lifted XOR noLift);
- spare position: `punched = down`;
- idle hooks follow from `lifts[p][h] === false`, so they get `punched = down` too.

The card array is in pick order. The chain successor of card `i` is card `(i + 1) mod pickCount` (2.9); the engine exposes this as `nextCard(index, pickCount)`, not as a stored pointer, so the data stays acyclic and serialisable.

#### Decoding

`decodeCards(cardSet, profile)` checks, in order: `cards.length ≥ 1` (`CARDS_EMPTY`); each card, in given order, has `positionCount` entries (`CARD_SIZE_MISMATCH`); the lowest duplicated number (`CARD_NUMBER_DUPLICATE`); the lowest number in `1..cards.length` that is absent (`CARD_NUMBER_MISSING`). It then sorts cards by number and reads `lift = punched XOR down`. A spare position in the lift state gives `CARD_SPARE_LIFTED` (lowest card number, then lowest position). An idle position in the lift state gives `CARD_IDLE_LIFTED` (confirmed; consistent with the "lifted idle hook" case of 2.13). Finally it runs `validatePlan` on the result, which catches a card set marked `repeatAcross` whose tiles differ.

Card `index` is ignored when decoding. Only `number` orders the cards, so the result does not depend on the order the cards arrive in (2.10).

### Float checker (Requirement 4)

#### Lines and rings

The analysed unit is picks `0..pickCount−1` by ends `0..designWidth−1`. Idle hooks are never read. With `repeatAcross`, the other tiles are copies of the unit (guaranteed by `validatePlan`), so analysing the unit is enough.

| Line | Cells | Ring? | Limit |
|---|---|---|---|
| warp line `e` | `lifts[0..P−1][e]` | always (4.2) | `maxWarpFloat` |
| weft line `p` | `lifts[p][0..W−1]` | only with `repeatAcross` | `maxWeftFloat` |

#### Runs

`runs.ts` exports `extractRuns(cells, ring)`, which returns either `{ kind: "constant", state, length }` or `{ kind: "runs", runs }`, where each run is `{ start, length, state }`:
- **Constant line** (every cell equal): `kind: "constant"`, which the checker reports as unbound. This covers warp lines, and weft lines with or without repeat (4.4).
- **Linear line**: maximal runs from index 0.
- **Ring line, not constant**: a run starts at index `i` when `cell[i] ≠ cell[(i − 1) mod L]`. Runs are listed from the lowest such `i`, and the last run may wrap past the end.

The start of a ring run is the cell whose ring predecessor differs. It does not depend on where index 0 is. This is what makes Property 19 (ring invariance) hold, and it is the precise meaning of "first cell of the run in ring order" in 4.3.

#### Sides

Up-side labels follow 4.1: warp-lifted and weft-unlifted runs are `face`; warp-unlifted and weft-lifted runs are `back`. `wovenFaceDown` swaps the two labels on output.

#### Violations and order

- A non-unbound run with `length > limit` → kind `"float"`, with `pick`/`end` at its start cell.
- A constant line → kind `"unbound"`, `line` = the end (warp) or the pick (weft), `length` = line length. It is never also a float.

Order (4.6), confirmed: kind (`unbound` before `float`), side (`face` before `back`), direction (`warp` before `weft`), then the row key, then the column key. A float's row key is `pick` and its column key is `end`. An unbound warp line uses row key 0 and column key `line`. An unbound weft line uses row key `line` and column key 0.

### Auto-fix (Requirement 5)

#### Badness

For a plan, define the badness `B` as the sum over every line of:
- for each float run: `length − limit` when the run is longer than the limit, else 0;
- for an unbound line: `max(1, L − limit)`, where `L` is the line length.

`B = 0` exactly when `checkFloats` returns no violations. The unbound term is chosen so that one flip in an unbound line always lowers that line's term. After the flip the line's longest run is `L − 1`, whose excess is below `L − limit`.

#### Candidates and safe flips

Every cell of a violating run (or unbound line) is a candidate for that violation. Flipping candidate `c` from state X to Y is **safe** when, after the flip:
1. in both lines through `c`, the run containing `c` (now Y, merged with any Y neighbours) is within that line's limit, and
2. neither line through `c` is constant.

A safe flip lowers `B` by at least 1. It splits or shortens the target run, which strictly lowers that line's term. It can only split or shorten the X run through `c` in the other line. It creates no over-limit Y run and no unbound line. Each iteration therefore makes progress, and the safe phase ends within `B₀` flips.

#### Choosing a cell (5.7)

Within one violation's safe candidates, the rank is, in order:
1. **On the satin lattice** first. For limit `k`, let `n` be the largest integer `≤ k + 1` that has a satin step, meaning an `s` in `[2, n − 2]` coprime with `n` (so `n ∈ {5, 7, 8, 9, …}`). Take the smallest such `s`. If `k + 1 < 5`, use `n = k + 1` and `s = 1`. With the default limit of 8, this gives `n = 9` and `s = 2`. A cell `(e, p)` is on the lattice when `(p − s·e) mod n = 0`. The same single lattice is used for warp and weft violations, so one area never gets two interleaved lattices. `k` is the limit of the line being fixed, so if `maxWarpFloat` and `maxWeftFloat` differ, warp and weft fixes use different lattices.
2. Smaller longest remaining piece of the target run.
3. Lower offset from the run start in ring order.

Along an end (fixed `e`), lattice points are `n` picks apart. Along a pick (fixed `p`), they are `n` ends apart, because `s` is coprime with `n` and so `s·e ≡ p (mod n)` has exactly one solution in every `n` consecutive ends. In a solid area the flips therefore cut floats in both directions into pieces of at most `n − 1 ≤ k`. On adjacent ends the points are offset by `s` picks. On adjacent picks they are offset by `s⁻¹ mod n` ends, which is never ±1 because `s` is not ±1 mod `n`. Neither direction lines up into a 1-step diagonal. With `n = 9` and `s = 2`, the offsets are 2 picks and 5 ends.

#### Algorithm

```
autoFix(plan, profile, { maxIterations = 4 × pickCount × designWidth }):
  validatePlan
  work on a private copy of the analysed unit
  flips = []
  loop:
    V = violations of the unit (incrementally maintained)
    if V is empty: expand the unit to all tiles; return ok({ plan, flips })
    if flips.length === maxIterations: return AUTOFIX_FAILED(iterationLimit, V)
    for v in V in 4.6 order:
      if v has a safe candidate: flip the best-ranked one; continue loop
    // no safe flip anywhere: fallback
    pick the candidate (over all violations) with the lowest ΔB;
      ties by violation order, then rank
    if that ΔB < 0: flip it; continue loop
    return AUTOFIX_FAILED(stuck, V)
```

- 5.2 holds because `V` is checked before any flip. 5.3 follows from 5.1 together with 5.2.
- 5.4 holds because every candidate lies in a current violation.
- 5.5 holds because only the private unit copy is written and idle hooks are not in the unit. With `repeatAcross`, expanding the unit writes each unit cell to every tile, which gives 5.6.
- 5.8 holds because the failure path returns only an error, with `remaining` set to the violations at the moment of failure.
- Every flip lowers `B` (checked by Property 33), so the loop ends within `B₀` flips. `B₀ ≤ 2·P·W + P + W ≤ 4·P·W`, so the default `maxIterations` is never the reason for failure. The cap is a guard against bugs.

A design that is 1 pick tall can never be fixed, because every warp line has length 1 and is unbound. A design that is 1 end wide has the same problem with its weft lines. Auto-fix returns `stuck` for both. This is correct for the cloth, since such threads never interlace.

#### Cost

After a flip at `(e, p)`, only warp line `e` and weft line `p` are recomputed, at `O(P + W)`. A safe check and a `ΔB` are `O(1)` given the run tables. Target: a 400 × 400 unit fixed in under 2 s in Node on a laptop. This is a performance goal, not a requirement.

## Data Models

```ts
type Design = readonly (readonly number[])[];           // design[pick][end]

type Weave =
  | { kind: "plain" }
  | { kind: "twill"; up: number; down: number; direction: "S" | "Z" }
  | { kind: "satin"; size: 5 | 8; move: number; facing: "warp" | "weft" };

type WeaveAssignment = Readonly<Record<number, Weave>>;  // region index → weave

interface LoomProfile {
  hookCount: number;
  hooksPerCardRow: number;
  spareHookCount: number;
  spareHookPlacement: "afterFiguring";
  maxFloat: number;
  maxWarpFloat: number;
  maxWeftFloat: number;
  regionLimit: number;
  holeMeans: "lift" | "noLift";
  cardFillOrder: "ascending";
  wovenFaceDown: boolean;
}

interface BuildInput {
  design: Design;
  weaves: WeaveAssignment;
  profile: LoomProfile;
  repeatAcross?: boolean;                                 // default false
}

interface LiftPlan {
  pickCount: number;
  hookCount: number;
  designWidth: number;
  repeatAcross: boolean;
  lifts: readonly (readonly boolean[])[];                 // lifts[pick][hook], true = lifts
}

interface BuildOutput { plan: LiftPlan; idleHooks: number[]; warnings: Warning[] }

interface Card { index: number; number: number; punched: readonly boolean[] }  // punched[position]
interface CardSet { designWidth: number; repeatAcross: boolean; cards: readonly Card[] }

type Side = "face" | "back";
type Direction = "warp" | "weft";
type Violation =
  | { kind: "float"; direction: Direction; side: Side; pick: number; end: number; length: number }
  | { kind: "unbound"; direction: Direction; side: Side; line: number; length: number };

interface Warning {
  code: "WEAVE_PERIOD_SEAM";
  region: number; period: number; dimension: "picks" | "ends"; size: number;
}

interface Flip { pick: number; end: number }              // design coordinates
interface AutoFixOutput { plan: LiftPlan; flips: Flip[] }
```

Notes:
- `WeaveAssignment` uses integer keys, so iteration order is ascending and JSON round-trips (6.1).
- `LiftPlan` carries `designWidth` and `repeatAcross` so the checker, auto-fix and card builder know the analysed width and the idle hooks without the design.
- `Violation` for kind `"unbound"` has `line` (the end for a warp line, the pick for a weft line) instead of a start cell, because an unbound ring has no start.

## Correctness Properties

Every property is a required fast-check test in `test/*.property.test.ts`, with at least 200 runs. When a property fails, the shrunk counterexample and the seed are copied into `KIRO_JOURNEY.md`. The test is never weakened.

Properties 1–6 cover weaves, 7–11 the lift plan, 12–15 cards, 16–17 validation, 18–23 floats, 24–30 and 33 auto-fix, 31–32 determinism, and 34 custom profiles.

### Property 1: Weave periodicity

For every valid weave `w` with period `P`, and all `e, p ≥ 0`: `eval(w, e, p) = eval(w, e + P, p) = eval(w, e, p + P)`.

**Validates: Requirements 2.3, 2.12**

### Property 2: Plain weave alternates

Plain: `eval(e, p) ≠ eval(e + 1, p)` and `eval(e, p) ≠ eval(e, p + 1)`; `eval(0, 0)` is lifted.

**Validates: Requirements 2.3**

### Property 3: Twill ratio and slope

Twill: in any `up + down` consecutive ends of one pick, exactly `up` are lifted. Z: `eval(e + 1, p + 1) = eval(e, p)`. S: `eval(e, p + 1) = eval(e + 1, p)`. `eval(0, 0)` is lifted.

**Validates: Requirements 1.6, 2.3**

### Property 4: Satin has one binding cell per line in every window

Satin, size `n`: in any `n × n` window at any offset, each pick and each end has exactly one binding cell.

**Validates: Requirements 1.6, 2.3**

### Property 5: Satin is never a twill

Satin: binding cells on consecutive picks are never neighbouring ends mod `n`, so a satin is never a twill.

**Validates: Requirements 1.6, 1.7**

### Property 6: Satin facings are complements

Satin: the warp-faced and weft-faced versions with the same size and move are complements at every cell.

**Validates: Requirements 2.3**

### Property 7: Lift plan follows region weaves

For valid input, `buildLiftPlan` succeeds, and every analysed cell equals `eval(weaves[design[p][e]], e, p)`. Changing the weave of region `r` changes only cells whose region is `r`.

**Validates: Requirements 2.1, 2.2**

### Property 8: Idle hooks never lift

With repeat off, `idleHooks = [W .. hookCount − 1]` and every idle hook is unlifted on every pick.

**Validates: Requirements 2.4**

### Property 9: Repeat across tiles the design

With repeat on, `lifts[p][h] = lifts[p][h mod W]` for every hook, and `idleHooks` is empty. With repeat on and `hookCount mod W ≠ 0`, the result is `REPEAT_NOT_DIVISIBLE`.

**Validates: Requirements 2.5, 2.6**

### Property 10: Seam warnings are exact and non-blocking

The warnings equal the list computed from the region periods by 2.12 (same items, same order), and the plan is the same as it would be with no warnings.

**Validates: Requirements 2.12**

### Property 11: Plan validation accepts built plans and rejects corruptions

`validatePlan` accepts every plan made by `buildLiftPlan`. Each single corruption (lifting an idle hook, changing one row's length, breaking periodicity) is rejected with the matching `problem`.

**Validates: Requirements 2.13**

### Property 12: Card count, numbering and layout

`buildCards` returns `pickCount` cards with `index = p` and `number = p + 1`, in pick order. Each card has `hookCount + spareHookCount` positions. `cardRows` has `ceil(positions / hooksPerCardRow)` rows of `hooksPerCardRow` slots, with `null` only after the last position.

**Validates: Requirements 2.7, 2.8, 2.9**

### Property 13: Punching follows holeMeans

Figuring position `h` is punched exactly when `lifts[p][h]` differs from `holeMeans === "noLift"`. Every spare and idle position is in the punched state that keeps the hook down.

**Validates: Requirements 2.7**

### Property 14: Card round trip

`decodeCards(buildCards(plan))` equals `plan`, for both values of `holeMeans`, and for any permutation of the cards.

**Validates: Requirements 2.10**

### Property 15: Bad card sets are rejected

Removing a card gives `CARD_NUMBER_MISSING`. Duplicating one gives `CARD_NUMBER_DUPLICATE`. Changing a card's length gives `CARD_SIZE_MISMATCH`. Setting a spare position to lift gives `CARD_SPARE_LIFTED`. Setting an idle position to lift gives `CARD_IDLE_LIFTED`. Each error names the right card number.

**Validates: Requirements 2.11, 2.13**

### Property 16: First error follows the validation order

Start from a valid input, inject any non-empty subset of the nine faults, and the returned error code is the earliest injected fault in 3.7 order.

**Validates: Requirements 3.7**

### Property 17: Errors carry their named fields

Every error returned in Property 16 has its `code` and all fields named in its criterion, with values matching the injected fault.

**Validates: Requirements 1.5, 1.7, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.8**

### Property 18: Float checker agrees with a naive oracle

For any valid plan, `checkFloats` equals the naive checker. The naive checker tiles the unit 3 times along the picks (and 3 times along the ends when repeat is on). It scans every line linearly with no modular arithmetic, and keeps runs whose start lies in the middle tile, mapped back. A run as long as the whole tiled line (or as the whole line, for weft lines with repeat off) becomes one unbound violation.

**Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5**

### Property 19: Ring invariance along the picks

Rotating the lift rows by `k` picks maps every float's `pick` to `(pick + k) mod P` and every unbound weft line to `(line + k) mod P`. It leaves unbound warp lines and all other fields unchanged. Compared as sorted lists.

**Validates: Requirements 4.2, 4.3**

### Property 20: Ring invariance across the ends

With repeat on, rotating the unit by `k` ends, applied to every tile, maps `end` to `(end + k) mod W` in the same way.

**Validates: Requirements 4.2**

### Property 21: Complement swaps face and back

Inverting every analysed cell swaps `face` and `back` in every violation and changes nothing else.

**Validates: Requirements 4.1**

### Property 22: wovenFaceDown swaps face and back

Flipping `wovenFaceDown` swaps `face` and `back` in every violation and changes nothing else.

**Validates: Requirements 1.2, 4.1**

### Property 23: Violations are over the limit, exclusive and sorted

Every float violation has `length > limit` for its direction. No line appears as both float and unbound. The output is sorted by the 4.6 key.

**Validates: Requirements 4.3, 4.4, 4.6**

### Property 24: Auto-fix success leaves no violations

On success, `checkFloats(result.plan)` is empty.

**Validates: Requirements 5.1**

### Property 25: Clean plans are returned unchanged

A plan with no violations is returned unchanged, with `flips = []`.

**Validates: Requirements 5.2**

### Property 26: Auto-fix is idempotent

`autoFix(autoFix(x).plan)` returns the same plan with `flips = []`.

**Validates: Requirements 5.3**

### Property 27: Every flip lies in a current violation

Replaying `flips` one at a time from the input, every flipped cell lies, before its flip, inside a float or unbound line reported by `checkFloats` on the current plan.

**Validates: Requirements 5.4**

### Property 28: Only flipped lift cells change

The output plan differs from the input only at cells flipped an odd number of times (and their tile copies). Idle hooks stay unlifted. The design, the weave assignment and the input plan are unchanged.

**Validates: Requirements 5.5, 6.3**

### Property 29: Auto-fix keeps repeat-across plans periodic

With repeat on, the output satisfies `lifts[p][h] = lifts[p][h mod W]`.

**Validates: Requirements 5.6**

### Property 30: Never partly fixed

For any plan and any `maxIterations` from 0 up, the result is either success with no violations, or `AUTOFIX_FAILED` with a non-empty `remaining` and no plan. With `maxIterations = 0` on a plan that has violations, it is always `AUTOFIX_FAILED`.

**Validates: Requirements 5.8**

### Property 31: Identical input gives identical output

Every public function called twice on deep copies of the same input returns results that are structurally equal and equal as sorted-key JSON.

**Validates: Requirements 6.1**

### Property 32: Inputs are never modified

Every public function given deeply frozen inputs completes without a `TypeError` (strict mode), and its inputs equal a snapshot taken before the call.

**Validates: Requirements 6.3**

### Property 33: Badness strictly decreases with every flip

Replaying the `flips` returned by a successful auto-fix one at a time from the input, the badness `B` strictly decreases after every flip. The test computes `B` from `checkFloats` output, not from auto-fix internals: the sum over float violations of `length − limit` for their direction, plus `max(1, length − limit)` over unbound violations. Failed runs return no flips, because a flip list would let a caller rebuild the partly fixed plan that 5.8 forbids. The failure rule is covered here because strict decrease is what makes the default `maxIterations` unreachable, so the only expected failure reason is `stuck`. The test also checks that every `AUTOFIX_FAILED` under the default bound has reason `stuck`.

**Validates: Requirements 5.1, 5.8**

### Property 34: A custom profile is used in place of a built-in

For any valid custom profile `c` and any valid design and weave assignment, the results depend on `c` alone. The plan has `hookCount = c.hookCount`, with idle hooks from `designWidth` to `c.hookCount − 1`. Every card has `c.hookCount + c.spareHookCount` positions in `ceil(... / c.hooksPerCardRow)` rows, punched according to `c.holeMeans`. Every float reported by `checkFloats` is longer than `c.maxWarpFloat` or `c.maxWeftFloat` for its direction, and every run longer than those limits is reported. `defineProfile` returns exactly the given fields and fills only the omitted ones from the defaults in 1.2. Running the same input with a built-in profile and with a plain-object copy of it gives equal results, so the engine never special-cases a built-in by identity.

**Validates: Requirements 1.4**

## Error Handling

### Error types

```ts
type EngineError =
  | { code: "PROFILE_INVALID"; field: string; value: unknown }                       // 1.5
  | { code: "WEAVE_INVALID"; region: number; parameter: string; value: unknown }     // 1.7
  | { code: "DESIGN_EMPTY" }                                                         // 3.3
  | { code: "DESIGN_ROWS_UNEQUAL"; pick: number; length: number; expected: number }  // 3.4
  | { code: "DESIGN_CELL_INVALID"; pick: number; end: number; value: unknown }       // 3.5
  | { code: "DESIGN_TOO_WIDE"; width: number; hookCount: number }                    // 3.1
  | { code: "REPEAT_NOT_DIVISIBLE"; width: number; hookCount: number }               // 2.6
  | { code: "TOO_MANY_REGIONS"; regionCount: number; regionLimit: number }           // 3.2
  | { code: "WEAVE_MISSING"; region: number }                                        // 3.6
  | { code: "PLAN_INVALID"; problem: PlanProblem; pick?: number; hook?: number }     // 2.13
  | { code: "CARDS_EMPTY" }                                                          // 2.11
  | { code: "CARD_SIZE_MISMATCH"; number: number; positionCount: number; expected: number }
  | { code: "CARD_NUMBER_DUPLICATE"; number: number }
  | { code: "CARD_NUMBER_MISSING"; number: number }
  | { code: "CARD_SPARE_LIFTED"; number: number; position: number }
  | { code: "CARD_IDLE_LIFTED"; number: number; position: number }                   // 2.11, 2.13
  | { code: "AUTOFIX_FAILED"; reason: "stuck" | "iterationLimit";
      maxIterations: number; remaining: Violation[] };                               // 5.8

type PlanProblem =
  | "noPicks" | "pickCountMismatch" | "hookCountMismatch" | "rowLength"
  | "notBoolean" | "designWidth" | "repeatNotDivisible" | "idleLifted" | "notPeriodic";
```

Each error object also has a `message` string built from its fields, in English. The message never contains anything not already in the fields (3.8). Error fields use `pick` and `end`, not row and column, per the steering rule on orientation.

### Validation order (3.7)

`validateInput` runs these steps and returns the first failure:

1. `validateProfile(profile)`.
2. `validateWeave` for every entry in `weaves`, in ascending region order (used or not).
3. `design.length === 0` or `design[0].length === 0` → `DESIGN_EMPTY`.
4. First pick `p ≥ 1` with `design[p].length !== design[0].length` → `DESIGN_ROWS_UNEQUAL`.
5. First cell in pick-major order that is not a non-negative safe integer → `DESIGN_CELL_INVALID`.
6. `width = design[0].length > hookCount` → `DESIGN_TOO_WIDE`.
7. `repeatAcross && hookCount % width !== 0` → `REPEAT_NOT_DIVISIBLE`.
8. Distinct region count `> regionLimit` → `TOO_MANY_REGIONS`.
9. Lowest used region with no weave → `WEAVE_MISSING`.

The design is never copied or normalised before these checks, so the reported positions refer to the caller's array.

### Plan validation order (2.13)

`validatePlan(plan, profile)` checks, in order: `pickCount ≥ 1`; `lifts.length === pickCount`; `plan.hookCount === profile.hookCount`; every row has `hookCount` booleans; `1 ≤ designWidth ≤ hookCount`; divisibility when `repeatAcross`; idle hooks unlifted; and, when `repeatAcross`, `lifts[p][h] === lifts[p][h mod designWidth]`. The first failure is `PLAN_INVALID` with its `problem`, `pick` and `hook`.

### Card decoding and auto-fix failures

The card decoding order is given under Components and Interfaces, Cards, Decoding. Auto-fix fails with `AUTOFIX_FAILED` only, never with a partial plan (5.8); see Auto-fix, Algorithm.

## Testing Strategy

### Property tests

Every property in Correctness Properties is a required fast-check test in `test/*.property.test.ts`, with at least 200 runs. When a property fails, the shrunk counterexample and the seed are copied into `KIRO_JOURNEY.md`. The test is never weakened.

### Example tests (not properties)

- 1.1: a 3-pick by 2-end design with distinct regions and contrasting weaves. `design[pick][end]` maps to `lifts[pick][hook]`, not the transpose.
- 1.3: the three built-in profiles have exactly the defaults in 1.2, and the 400 profile gives 416 positions in 52 rows of 8.
- 1.3: also, each built-in default in `profiles.ts` has a label comment, and each `[sourced]` default quotes S1.
- 1.5: one test per invalid profile field.
- 5.7: a solid 24 × 24 region with limits of 8, run once all lifted and once all unlifted. Each run has long warp and weft floats. In both runs every flip lies on the single lattice `(p − 2e) mod 9 = 0`, and no three flips sit on consecutive ends at consecutive picks.
- 5.1, golden fixtures: a set of small gallery-like designs that auto-fix must fix. These guard the heuristic's success rate, which the properties do not.
- 6.2: a scan of `src/` for the forbidden names listed under Architecture, Determinism constraints.

### Generators (`test/arbitraries.ts`)

- **Profiles:** `hookCount` 1 to 48 (plus the built-ins in example tests), `hooksPerCardRow` 1 to 12, `spareHookCount` 0 to 20, limits 1 to 10, `regionLimit` 1 to 8, both `holeMeans`, both `wovenFaceDown`.
- **Designs:** 1 to 24 picks, width 1 to `hookCount`, region indices below `regionLimit`. One generator gives "repeat-ready" widths that divide `hookCount`.
- **Weaves:** every kind, twill `up` and `down` from 1 to 5, satin from the allowed moves.
- **Lift plans:** either built from a design or random, with a bias toward long runs (solid blocks, stripes) so floats and unbound lines are common.
- **Faults (Property 16):** each injector guarantees its fault, and they are applied from the last 3.7 step to the first so that an earlier fault is never overwritten. The unequal-rows fault appends cells instead of truncating, so it never removes an injected invalid cell.

## Confirmed design decisions

All confirmed by the user on 2026-11-16.

1. **Violation order ranks (Float checker, Violations and order).** Unbound before float, face before back, warp before weft.
2. **`CARD_IDLE_LIFTED` (Cards, Decoding).** Decoding rejects a card whose idle position is in the lift state, the same as for spare positions. Decoding also runs the 2.13 plan check. Covered by Property 15.
3. **Auto-fix stops early (Auto-fix, Algorithm).** It fails with `stuck` as soon as no flip lowers the badness, instead of spending the iteration bound.
4. **1-pick and 1-end designs (Auto-fix, Algorithm).** These always fail the checker as unbound, and auto-fix cannot fix them.
5. **Lattice (Auto-fix, Choosing a cell).** One lattice for both directions, `(p − s·e) mod n = 0`. For limits whose `k + 1` has no satin step (6, or anything below 5), the lattice uses a smaller `n`. That makes pieces shorter than needed, and below 5 it falls back to a twill-like step of 1.
6. **`maxIterations` default (Auto-fix, Algorithm).** `4 × pickCount × designWidth`.
7. **fast-check run count.** At least 200 runs per property, with random seeds. Each failing seed is logged so the case can be replayed.
8. **Property 33** added at the user's request. **Property 34** added for 1.4.
