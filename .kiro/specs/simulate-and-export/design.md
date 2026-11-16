# Design Document: simulate-and-export

Traces to `requirements.md`. Acceptance criteria are cited as `N.M`. Correctness properties are cited as Property N.

## Overview

```
apps/web  ── plan (fixed plan if current, else design plan), profile, yarns, design, palette
   │
   ├─ simulator-panel.tsx ──► clothModel(plan, profile, yarns, side) ──► canvas
   └─ export-panel.tsx    ──► writeWif / cardSheetSvg / cardSheetPdf / pointPaperSvg ──► Blob download
                                   │
                         @jacquard/export (pure; depends on @jacquard/engine: validatePlan, buildCards, cardRows)
```

## Architecture

`packages/export` has the engine's package shape (`main`, `types`, `exports` at `./src/index.ts`), `dependencies: { "@jacquard/engine": "workspace:*" }`, dev dependencies at the workspace versions. Files:

| File | Exports |
|---|---|
| `src/types.ts` | `YarnColours`, `ClothCell`, `ExportError`, `ExportResult<T>` |
| `src/cloth.ts` | `clothModel(plan, profile, yarns, side)` |
| `src/wif.ts` | `writeWif(plan, profile, yarns, options?)`, `readWif(text)` |
| `src/card-sheet.ts` | `cardSheetLayout(cardSet, profile)` (shared geometry), `cardSheetSvg(plan, profile, options?)` |
| `src/pdf.ts` | `PdfWriter` (minimal object writer) and `cardSheetPdf(plan, profile, options?)` |
| `src/point-paper.ts` | `pointPaperSvg(design, palette, options?)` |
| `src/text.ts` | `escapeXml`, `pdfString`, `formatNumber` (fixed decimals, no locale) |
| `src/index.ts` | public exports |

`ExportError` is `{ code: "YARN_INVALID" | "WIF_INVALID" | "DESIGN_INVALID"; message: string; detail?: string }` or the engine's `EngineError` unchanged (4.8). All functions return `ExportResult<T> = { ok: true, value: T } | { ok: false, error }`.

### Cloth model (Requirement 1)

`validatePlan(plan, profile)` first. `upSide = lifts[pick][hook] ? "warp" : "weft"`. With `side === "face"`, `top = wovenFaceDown ? opposite(upSide) : upSide`; with `"back"`, the opposite of that. Colour per 1.3.

### WIF (Requirement 3)

Written in this order, `\r\n` endings, keys as below, no `Date`:

```
[WIF]
Version=1.1
Developers=JACQUARD
Source Program=JACQUARD
Source Version=0.1
[CONTENTS]
COLOR PALETTE=true
TEXT=true
WEAVING=true
WARP=true
WEFT=true
COLOR TABLE=true
THREADING=true
LIFTPLAN=true
WARP COLORS=true
WEFT COLORS=true
[TEXT]
Title=<title, escaped of newlines and brackets>
[WEAVING]
Shafts=<hookCount>
Treadles=0
Rising Shed=true
[WARP]
Threads=<hookCount>
Color=1
[WEFT]
Threads=<pickCount>
Color=<1 + warp.length>
[COLOR PALETTE]
Entries=<warp.length + weft.length>
Form=RGB
Range=0,255
[COLOR TABLE]
1=r,g,b ...
[WARP COLORS]
1=<1 + (0 mod warp.length)> ...
[WEFT COLORS]
1=<1 + warp.length + (0 mod weft.length)> ...
[THREADING]
1=1
2=2 ...
[LIFTPLAN]
1=<lifted shafts, ascending, comma-separated; empty when none>
```

`readWif` parses sections and keys (case-insensitive section and key names, `;` comment lines ignored), checks `[THREADING]` maps end i to shaft i for every end, builds `lifts[pick][hook]` from `[LIFTPLAN]`, and returns a Lift_Plan with `pickCount` from `[WEFT] Threads`, `hookCount` from `[WEAVING] Shafts`, and `designWidth` and `repeatAcross` taken from a private `[JACQUARD]` section that `writeWif` adds (`DesignWidth=`, `RepeatAcross=`). WIF 1.1 allows private sections; readers ignore unknown ones. Without `[JACQUARD]`, `designWidth` is `hookCount` and `repeatAcross` is false.

### Card sheet geometry (Requirement 4)

`cardSheetLayout` calls `buildCards(plan, profile)` and `cardRows(card, profile)` for each card. Units are millimetres, schematic: hole pitch 4 mm, hole diameter 2.4 mm, card margin 6 mm, label band 8 mm on the left with the card number. A card is `rows.length` rows tall and `hooksPerCardRow` slots wide, drawn with slots running top to bottom inside a row (slot 0 at the top, S1) and rows left to right with row 0 nearest the numbered end. `null` slots (past the last position) are not drawn. Lacing marks (two small circles) sit at both ends of each card. The SVG stacks all cards in one column; the PDF fills A4 pages (210 by 297 mm, 10 mm margins) with as many cards as fit, at least one, in card order, with a footer per page carrying the 4.5 text and "page k of n".

### PDF writer

`PdfWriter` collects objects as strings, numbers them from 1, and on `finish()` writes `%PDF-1.4\n%âãÏÓ\n`, each object `n 0 obj ... endobj`, an `xref` table with 20-byte entries computed from UTF-8 byte offsets of each object, a trailer with `/Size` and `/Root`, `startxref` and `%%EOF`. Page content streams use `re`, `m`, `l`, `c` (circle as four Bézier arcs), `f`, `S`, `BT /F1 n Tf x y Td (text) Tj ET`. `/Length` is the byte length of the stream. Font: `/Type /Font /Subtype /Type1 /BaseFont /Helvetica`. Text is ASCII-escaped (`\`, `(`, `)`), non-ASCII replaced with `?`. Numbers via `formatNumber` (at most 3 decimals, trailing zeros trimmed, `-0` as `0`). Output is returned as a `Uint8Array`.

### Point paper (Requirement 5)

Cell 10 units square, margins for axis numbers, `<rect>` per cell (runs of equal colour in a pick are merged into one rect to keep files small), grid lines as one `<path>` per weight, labels in `<text>`, region numbers in cells when the design is at most 64 by 64, a legend below.

### Web (Requirements 2 and 6)

- `components/simulator-panel.tsx`: side toggle, zoom, warp and weft colour inputs, a label saying which plan it shows, the "simulation, not a photograph" note, canvas drawn by `lib/draw-cloth.ts` (thread segments with a 1-cell-wide shade gradient). Tiling across all hooks is already in the plan (the engine fills hooks past the width when `repeatAcross` is on).
- `components/export-panel.tsx`: buttons for Cards PDF, Cards SVG, Point paper SVG, WIF; the violations gate with auto-fix and "Export anyway" (a `Dialog` confirmation); notes; error state with retry. Downloads via `lib/download.ts` (`Blob` and an object URL, revoked after click).
- `app.tsx` passes the current plan (fixed plan if current), profile, design, palette and yarns.

## Correctness Properties

Generators in `packages/export/test/arbitraries.ts` build designs and plans through the engine's public API (`buildLiftPlan`, `autoFix`, `defineProfile`), with small sizes and custom profiles (varied `hooksPerCardRow`, `spareHookCount`, `holeMeans`, `wovenFaceDown`).

### Property 1: Cloth model matches the lift plan

For any valid plan, profile, yarns and side, `clothModel` returns `pickCount` by `hookCount` cells; cell (pick, hook) has `top` warp exactly when `lifts[pick][hook] !== (side === "back") !== profile.wovenFaceDown`; its colour is the warp or weft colour by 1.3; face and back are complementary at every cell; inputs are unchanged.

**Validates: Requirements 1.1, 1.2, 1.3, 1.5**

### Property 2: Cloth model rejects bad yarns

For any valid plan and a yarn list that is empty or contains a non-`#rrggbb` string, `clothModel` returns `YARN_INVALID`; for a corrupted plan it returns the engine's `PLAN_INVALID`.

**Validates: Requirements 1.4**

### Property 3: WIF round trip

For any valid plan, profile and yarns, `readWif(writeWif(plan, profile, yarns))` returns a plan deeply equal to the original.

**Validates: Requirements 3.5, 3.2**

### Property 4: WIF structure

For any valid plan, the WIF text has every required section exactly once, in order; every line ends with `\r\n`; `Shafts` and `[WARP] Threads` equal `hookCount`; `[WEFT] Threads` equals `pickCount`; `[THREADING]` has `hookCount` entries `i=i`; `[LIFTPLAN]` has `pickCount` entries whose shaft lists are ascending, within 1 to `hookCount`, and equal to the lifted hooks plus one; and no line matches a date or time pattern.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

### Property 5: WIF reader rejects broken files

For any written WIF with one fault (the `[LIFTPLAN]` section removed, the `[THREADING]` section removed, one threading entry changed to another shaft, one liftplan shaft set to 0 or to `hookCount + 1`), `readWif` returns `WIF_INVALID`.

**Validates: Requirements 3.6**

### Property 6: Card count, order and positions

For any valid plan and profile, `cardSheetLayout` has exactly `pickCount` cards numbered 1 to `pickCount` in order; card `n` has exactly `hookCount + spareHookCount` drawn positions; the drawn punched count of card `n` equals the punched count of card `n` in `buildCards`; and the positions follow `cardRows` slot by slot.

**Validates: Requirements 4.1, 4.2, 4.3, 4.4**

### Property 7: Card SVG content

For any valid plan and profile, the SVG is well-formed (balanced tags, one root), contains one card group per pick with its number as text, the number of filled hole elements equals the total punched count of `buildCards`, the number of empty hole elements equals total positions minus punched, and the untested-format sentence appears.

**Validates: Requirements 4.1, 4.4, 4.5**

### Property 8: PDF structure

For any valid plan and profile, the PDF bytes start with `%PDF-1.4`, end with `%%EOF` followed by an optional newline, every `xref` offset points at the start of `n 0 obj` for its object number, `startxref` points at `xref`, every stream's `/Length` equals its byte length, the page count equals `ceil(pickCount / cardsPerPage)`, each page carries the untested-format sentence, and the text contains no `/CreationDate`.

**Validates: Requirements 4.6, 4.5, 4.1**

### Property 9: Point-paper sheet

For any design up to 40 by 40 with up to 8 regions and a palette, the SVG is well-formed, the fill colour of each cell (read back by sampling the merged rects) equals the palette colour of its region with pick 0 at the bottom, region numbers appear for each cell, and any title text with `<`, `&` or quotes is escaped.

**Validates: Requirements 5.1, 5.2, 5.3**

### Property 10: Determinism and purity

For any valid inputs, two calls of each of `clothModel`, `writeWif`, `cardSheetSvg`, `cardSheetPdf` and `pointPaperSvg` give byte-identical (or deeply equal) results, and the inputs are deeply equal to copies taken before the call.

**Validates: Requirements 1.5, 3.4, 4.7, 5.3**

### Property 11: Engine errors pass through

For any corrupted plan or invalid custom profile, `writeWif`, `cardSheetSvg` and `cardSheetPdf` return the same engine error as `validatePlan` or `buildCards`, unchanged.

**Validates: Requirements 4.8**

## Error Handling

| Situation | Result |
|---|---|
| Plan or profile rejected by the engine | the engine error, unchanged |
| Bad yarn colour | `YARN_INVALID` |
| Design not a rectangular grid of non-negative integers, or a region without a palette colour | `DESIGN_INVALID` |
| WIF missing a section, bad threading, shaft out of range | `WIF_INVALID` with `detail` |
| Export throws in the web app | export failure message with retry |

## Testing Strategy

- vitest run once, fast-check with `{ seed, numRuns: 100 }` constants, `verbose: 1`, files `*.property.test.ts`, tag `Feature: simulate-and-export, Property N: <title>`.
- A property failure is recorded in full in the journal before the fix; tests are never weakened.
- Example tests: a 2-pick plan's WIF text compared line by line with a hand-written expected file kept in `packages/export/test/expected/` (new file, not an engine fixture); a PDF of one card opened as text and checked; card 1 of the `PROFILE_400` profile has 416 positions in 52 rows of 8.
- Source scan: no DOM, Node, network, `Date` or `Math.random` in `packages/export/src`; only `@jacquard/engine` imported from outside.
- Web: component tests for the simulator (states, which plan it shows) and the export panel (violation gate with confirmation, fixed-plan note, error with retry, notes present).

### Not automated

- Opening the WIF in a weaving tool we did not write (manual step for the user, `BUILD_PLAYBOOK.md` Phase D).
- Printing and punching cards (Phase E, the user's).
