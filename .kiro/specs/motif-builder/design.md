# Design Document: motif-builder

## Overview

Description → `describeMotif` → Motif_Plan (+ understood words, unused words, notes) → `buildMotif` → Motif_SVG → the existing `motifToDesign` pipeline with the plan's colour count and symmetry and the loom setup's repeat and minimum feature. Everything before `motifToDesign` is new code in `packages/motif`; nothing in the existing modules changes.

## @jacquard/motif: new files

### `src/describe.ts`

```ts
export type BuilderSubject = "lotus" | "peacock" | "star" | "diamond" | "paisley" | "rosette" | "tree" | "elephant" | "border" | "stripe" | "check" | "lattice";
export type BuilderLayout = "single" | "border" | "allOver";
export type BuilderSize = "small" | "medium" | "large";
export interface BuilderColour { readonly name: string; readonly hex: string }
export interface MotifPlan {
  readonly subject: BuilderSubject;
  readonly count: number | null;        // petals, points, stripes, bands, teeth or cells; null when the subject has none
  readonly layout: BuilderLayout;
  readonly size: BuilderSize;
  readonly symmetry: Symmetry;
  readonly colours: readonly BuilderColour[]; // 2 to 4, distinct hex, ground first
}
export interface PlanOverrides { subject?; count?; layout?; size?; symmetry?; ground?: string /* colour name */; colourCount? }
export interface MotifDescription {
  readonly plan: MotifPlan;
  readonly understood: readonly string[]; // phrases in text order: "lotus", "four petals", "plain ground"
  readonly unused: readonly string[];     // words that changed nothing and are not filler
  readonly fellBack: boolean;             // no subject word: rosette
  readonly notes: readonly string[];      // clamps and dropped colours, in plain words
}
export function describeMotif(text: string, options: { colourCount: number; maxColours?: number; overrides?: PlanOverrides }): MotifDescription;
export const BUILDER_SUBJECTS, BUILDER_COLOURS, COUNT_RANGES, SUBJECT_SYMMETRY;
```

Tokens: lower case, split on anything that is not `a` to `z` or `0` to `9` (so "eight-point" is "eight point", "all-over" is "all over"); at most 200 tokens are read [decision], so the work is linear and bounded. A scan from left to right tries three-word, then two-word, then one-word phrases against the tables (subject names, counts, symmetry, size, layout, ground, colours). A plural is matched by dropping a final "es" or "s" when the bare word is in a table ("lotuses", "peacocks", "stripes"). The first subject wins; a later different subject is listed as unused with the note "One subject at a time". "border" is both a layout and, when no Figure_Subject is named, the subject.

Counts: a number (word or digits, 1 to 12) followed within two tokens by a count noun. The noun must fit the subject (petals: lotus, rosette; points: star; stripes or bands: stripe, check; teeth: border; cells: lattice); a count for another subject is unused. Ranges [decision]: lotus 3–12 (default 8), rosette 4–12 (8), star 4–12 (8), stripe 1–6 (3), check 1–4 (2), border 2–12 (4), lattice 1–4 (2); out of range is clamped with a note.

Colours: about twenty yarn-like names with fixed hex values (cream, white, black, grey, red, maroon, pink, orange, saffron, yellow, gold, green, sage, olive, teal, blue, indigo, sky, purple, brown) and their other names (ivory, crimson, rose, turmeric, mustard, navy, violet, walnut …). A colour directly before "ground", "background" or "base", or after "on", is the ground; other colours are figure colours in text order. Duplicates collapse. Count = named distinct colours when at least 2, else the setup's count; kept to 2..min(4, maxColours). The ground defaults to cream (or white when cream is a figure colour); missing figure colours come from the subject's own list [decision]: lotus pink, madder, turmeric; peacock teal, indigo, gold; star indigo, gold, red; diamond madder, indigo, gold; paisley madder, gold, indigo; rosette madder, gold, green; tree green, brown, red; elephant grey, madder, gold; border madder, gold, indigo; stripe indigo, madder, gold; check indigo, madder, gold; lattice green, madder, gold. Defaults skip colours already used.

Overrides replace the parsed value after parsing; the subject override resets an unfitting count to the new subject's default; a ground override replaces colour 0.

### `src/motif-builder.ts` and `src/builder-shapes.ts`

`buildMotif(plan): string` writes `<svg xmlns viewBox="0 0 100 100"><title>Motif builder: <subject></title><rect ground/>…</svg>`. Shapes are layers `{ role: 1 | 2 | 3 | 0, polygons, fallback? }`. The colour of a role: role < count of colours → that colour; role 3 falls back to role 1 (or to the layer's `fallback`), role 2 falls back to the ground (0) as a cut-out. Every subject has layers for roles 1, 2 and 3, so the palette is always exactly the plan's colours. Numbers: `String(Math.round(v * 100) / 100)`.

Figure_Subjects are drawn in a unit box `[-1, 1]²` (SVG y down) and placed into slots `{ cx, cy, r }`:

| Layout | Slots (large / medium / small) |
|---|---|
| single | one at (50, 50), r 46 / 38 / 26 |
| allOver | 2 by 2 at 25 and 75, r 24 / 20 / 14 |
| border | edge lines y 3–9 and 91–97 (role 1); a row at y 50 of 2 (r 22) / 3 (r 15) / 4 (r 11) slots |

For an Asymmetric_Subject with a symmetry, each slot box is clipped to the Kept_Part (x ≤ 50 for ends, y ≥ 50 for picks) and the figure is placed in the largest square inside the clipped box; a slot wholly outside is dropped. Both asymmetric figures face +x, so the left figure faces the centre and the mirror makes a facing pair.

Figures (unit box):
- lotus: n outer pointed petals (role 1) from radius 0.24 to 0.98, the first pointing up; n inner petals (role 2) rotated half a step, radius 0.15 to 0.62, drawn first; centre disc r 0.24 (role 3, falls back to 2). Petal half-width is capped at 0.6 · s · tan(π/n), so neighbouring outer petals never touch.
- rosette: n round-tipped petals (role 1) from 0.25 to 0.95, cap 0.8 · s · tan(π/n); centre disc 0.32 (role 2); inner dot 0.14 (role 3).
- star: n-point star (role 1), outer 0.98, inner 0.42–0.5; inner star 0.55 scale (role 2); centre disc 0.18 (role 3).
- diamond: |u|+|v| ≤ 0.98 (role 1), ≤ 0.62 (role 2), ≤ 0.28 (role 3).
- paisley: a union of discs along a quadratic curve from (−0.05, 0.3) through (−0.3, −0.6) to (0.45, −0.85), radius 0.55·(1−t)^1.3 + 0.03 (role 1); the same at 0.62 of the radius (role 2); a drop at 0.28 for t ≤ 0.55 (role 3).
- tree: canopy of six discs (role 1), trunk (role 3), pot and fruit (role 2).
- peacock: tail fan, an elliptic sector (role 1); eyes on two arcs (role 2) with centres (role 3); body, neck and head (role 2); legs and crest (role 3).
- elephant: body, head, legs, trunk and tail (role 1); ear and saddle cloth (role 2); cloth band and eye (role 3); tusk in the ground colour.

Pattern_Subjects fill the repeat, symmetric about both centre lines:
- stripe: n horizontal bands of pitch 100/n, width 0.6 pitch, role 1 or 3 alternating outward from the middle; a centre stripe 0.25 pitch (role 2); for n ≤ 2, edge lines (role 3) at the top and bottom.
- check: n vertical and n horizontal bands of width 0.36 pitch (role 1), crossings (role 2), crossing centres 0.14 pitch (role 3).
- lattice: diagonal bars of half-width 3 along x ± y = k·100/n (role 1), each a strip clipped to the box; diamonds at crossings (role 2) and at cell centres (role 3).
- border: edge lines (role 2); n teeth (role 1) pointing up from the bottom line and down from the top line; diamonds (role 3) between the teeth on the middle line.

Curves use `Math.sin` and `Math.cos` with a fixed number of steps (12 per petal side, 16 per disc).

## Correctness properties

Each property test lives in `packages/motif/test` (1 to 3) or `apps/web/test` (4), runs 100 cases with a fixed seed, and starts with `// Feature: motif-builder, Property N: <title>`.

Generators: descriptions are random sequences of words drawn from every table above, filler words, number words, digits, random unicode strings and the empty string; overrides are random partial plans.

### Property 1: Describer totality and determinism
For any text, options and overrides, `describeMotif` does not throw, returns a plan whose subject, layout, size and symmetry are known values, whose count is in the subject's range (or null exactly when the subject has none), whose colours are 2 to min(4, maxColours) distinct lower-case `#rrggbb` values, and whose every understood phrase is a run of words of the text (lower case, split on anything but letters and digits); a second call with structural copies returns a deep-equal result; every override given is reflected in the plan.
**Validates: Requirements 1.3, 1.4, 1.6, 1.7**

### Property 2: Builder output
For any plan from Property 1's generators, `buildMotif` returns the same text twice; `parseMotif(svg, colours.length)` succeeds with a palette equal to the plan's colours as a set and of the same length; and `motifToDesign` on repeats of 48 to 96 ends and picks with minimum feature 2 gives a design that uses every palette index.
**Validates: Requirements 2.1, 2.2, 2.3, 2.6**

### Property 3: Every builder motif weaves within the float limit after auto-fix
For any description, the design from `motifToDesign(buildMotif(plan))` on the Default_Setup (with the plan's colour count and symmetry) is accepted by `buildLiftPlan` with the default weaves, PROFILE_240 and repeat across on, `autoFix` succeeds, and `checkFloats` on the fixed plan reports no violation.
**Validates: Requirements 2.7**

### Property 4: Saved design round trip
For any valid Saved_Design (random setups within limits, designs of the setup's size with region indices below the colour count, palettes, weaves from the offered list, Steps, yarns), saving into a fake storage and loading returns a deep-equal value; for any stored string that is not a valid Saved_Design (random JSON, wrong version, wrong sizes, region out of range, oversize), loading returns null, removes the key and never throws; a storage whose every call throws gives null and never throws.
**Validates: Requirements 5.3, 5.4, 5.6**

Example tests: the lotus example (2.8); the six verification descriptions parse to lotus/4 petals/plain ground/3 colours, peacock/mirror, star/8 points, paisley/border layout, diamond/small/all-over, elephant/none; "a blue thing" falls back to a rosette with "blue" understood; an elephant with "mirror" is drawn only in the left half.

## Web app

- `lib/motif-builder.ts` (lazy chunk): `buildFromDescription(text, { colourCount, maxColours, overrides })` → `{ description, svg, palette }`, checking the SVG with `parseMotif`.
- `lib/use-motif-builder.ts`: loads the chunk on idle when local, or at once on first focus of the Description; returns the module or null.
- `components/motif-chips.tsx`: the Chips as native `select` elements in a labelled group "Understood"; option text names its kind ("4 petals", "plain ground", "3 colours", "single butta", "four-way mirror", "large"). Count, layout and size chips show only where they apply. Below: "Understood: …", the fallback line and "Not used: …".
- `use-motif-request.ts`: new `place(response, request)` for a motif made in the browser: aborts any request in flight, applies, and sets success with `source: "builder"`. The web type `PlacedMotif` is `MotifResponse` with `source` widened to include `"builder"` and an optional `plan`.
- `motif-panel.tsx`: prop `localStandIn` keeps its name (the static build). When local, Describe builds; labels and notes without "model": empty state "Describe a motif and the motif builder draws it, or upload a sketch for a pattern from the file. Edit either by hand."; sketch note "Sketches are not traced here: you get a pattern made from the file instead."; builder label "Motif builder, not AI — edit it freely"; sketch label "Pattern from your file, not a tracing — edit it freely"; hint "Symmetry and colours follow the description; the repeat comes from the loom setup."
- `app.tsx` `applyMotif`: for a builder motif, the pipeline uses the plan's symmetry and the larger of the setup's and the plan's colour count; the setup is replaced with that symmetry and count, and the open is recorded like a gallery open (before and after Surroundings), so Undo restores grid, setup and palette.

### Persistence (`lib/saved-design.ts`)

`{ version: 1, design, setup, palette, weaves, yarns, step }` under `jacquard.design`. `loadSavedDesign(storage)` parses inside try/catch and validates: setup through `setupReducer(replace)` and must equal the stored setup; design rows equal to the setup's repeat, integers from 0 to colourCount − 1; palette null or at most 8 `#rrggbb`; weaves an object of keys 0..7 that each match an offered weave; step a known Step; yarns `#rrggbb` (weft may be null). Anything else: remove the key, return null. `saveDesign` refuses JSON over 1,000,000 characters (and removes the old value so a stale design does not come back). `App` takes `persist` (set in `main.tsx`), reads once in its state initialisers, saves 400 ms after a change and on `pagehide`, clears on Start from a blank grid and when the grid is all region 0.

## Headers

`scripts/amplify-custom-headers.yml`:

```yaml
customHeaders:
  - pattern: '**'
    headers: [CSP, HSTS max-age=31536000; includeSubDomains, nosniff, strict-origin-when-cross-origin, camera=(), microphone=(), geolocation=()]
  - pattern: '/'           → Cache-Control: no-cache
  - pattern: '/index.html' → Cache-Control: no-cache
  - pattern: '/assets/*'   → Cache-Control: public, max-age=31536000, immutable
```

CSP starts from `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' blob:; font-src 'self'; connect-src 'self'; worker-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'` and adds only what a local check with the same header shows the built app needs (Tone's blob worker, injected `<style>` elements). `deploy-web.sh` runs `aws amplify update-app --custom-headers "$(cat …)" --query 'app.name'` before each deployment, so the new deployment carries the headers.
