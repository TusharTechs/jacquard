# Requirements Document

## Introduction

Scope: the fabric simulator and the three exports. From a lift plan and yarn colours the app shows a simulation of the woven cloth. It exports the punch-card set as SVG and PDF, numbered and in lacing order, laid out by the loom profile; a classic point-paper sheet; and a WIF file. The card format is a configurable loom profile and has not been tested on a working loom; every exported card sheet says so.

Code locations:

- `packages/export` (`@jacquard/export`, new): pure TypeScript. Its only runtime dependency is `@jacquard/engine` (workspace). It holds the cloth model, the WIF writer and reader, the card-set SVG and PDF writers, and the point-paper SVG writer. No DOM, no Node-only APIs, no network, deterministic output.
- `apps/web`: a simulator panel (canvas) and an export panel that call `@jacquard/export` and download the files.

Acceptance criteria are cited as `N.M`.

## Glossary

- **Lift_Plan, Card_Set, Loom_Profile, Design**: the engine types `LiftPlan`, `CardSet`, `LoomProfile`, `Design`.
- **Yarn_Colours**: `{ warp: string[]; weft: string[] }`, hex colours `#rrggbb`, indexed by end (warp, repeating over the list) and by pick (weft, repeating).
- **Cloth_Model**: `cells[pick][hook]`, each `{ top: "warp" | "weft"; colour: string }` for the chosen side.
- **WIF**: Weaving Information File, version 1.1, an INI-style text format with sections such as `[WIF]`, `[CONTENTS]`, `[WEAVING]`, `[WARP]`, `[WEFT]`, `[COLOR PALETTE]`, `[COLOR TABLE]`, `[THREADING]`, `[LIFTPLAN]`.
- **Card_Sheet**: the exported card set, as one SVG document or one PDF document.
- **Point_Paper_Sheet**: the exported SVG of the design on point paper.
- **Export_Error**: a typed error from `@jacquard/export` with a stable `code`.

## Requirements

### Requirement 1: Cloth model

**User Story:** As a designer, I want to see how the cloth would look, so that I can judge the design before cards are cut.

#### Acceptance Criteria

1. WHEN `clothModel` is given a valid Lift_Plan, a Loom_Profile, Yarn_Colours and a side (`face` or `back`), THE function SHALL return `pickCount` rows of `hookCount` cells.
2. ON the side facing up on the loom, THE cell (pick, hook) SHALL show the warp end when `lifts[pick][hook]` is true and the weft when it is false; on the other side the reverse. Which side is the face follows the profile's `wovenFaceDown` field: with `wovenFaceDown` false the face is the side facing up, as in the engine.
3. THE colour of a warp cell SHALL be `warp[hook mod warp.length]` and the colour of a weft cell SHALL be `weft[pick mod weft.length]`.
4. IF the Lift_Plan fails the engine's `validatePlan`, or a Yarn_Colours list is empty or holds a value that is not `#rrggbb` hex, THEN `clothModel` SHALL return an Export_Error and no cells.
5. THE `clothModel` function SHALL be deterministic and SHALL NOT modify its inputs.

### Requirement 2: Simulator view

**User Story:** As a designer, I want the simulated cloth on screen, face and back, so that I can see floats and colour areas as cloth rather than as cells.

#### Acceptance Criteria

1. THE web app SHALL draw the Cloth_Model on a canvas, one cell per end-pick crossing, with warp cells drawn as vertical thread segments and weft cells as horizontal segments, so that floats read as long runs.
2. THE simulator SHALL offer face and back, a zoom from 1 to 16 pixels per cell, and the repeat tiled across the full hook count when "repeat across" is on.
3. THE simulator SHALL let the user set the warp yarn colour and the weft yarn colour (defaults in the Decision log), and SHALL redraw when the lift plan or the colours change.
4. THE simulator SHALL show the fixed lift plan when an auto-fix result is current, and the design's lift plan otherwise, and SHALL say which one it shows.
5. THE simulator SHALL state that it is a simulation from the lift plan, not a photograph of woven cloth, and SHALL define empty, loading and error states and work at 360 pixels wide.

### Requirement 3: WIF export

**User Story:** As a designer, I want a WIF file, so that I can open the draft in other weaving software and check it there.

#### Acceptance Criteria

1. WHEN `writeWif` is given a valid Lift_Plan, a Loom_Profile and Yarn_Colours, THE function SHALL return WIF 1.1 text with the sections `[WIF]`, `[CONTENTS]`, `[WEAVING]`, `[WARP]`, `[WEFT]`, `[COLOR PALETTE]`, `[COLOR TABLE]`, `[WARP COLORS]`, `[WEFT COLORS]`, `[THREADING]` and `[LIFTPLAN]`.
2. THE WIF SHALL map the Jacquard lift plan to a liftplan draft with one shaft per figuring hook: `Shafts` equals `hookCount`, warp end `h` (1-based `h + 1`) is threaded on shaft `h + 1`, and the `[LIFTPLAN]` line for pick `p` (1-based `p + 1`) lists the shafts of the hooks lifted on that pick in ascending order, comma-separated.
3. THE WIF SHALL set `Rising Shed=true`, `Treadles=0`, `Threads` in `[WARP]` to `hookCount` and in `[WEFT]` to `pickCount`, and `Form=RGB` with `Range=0,255` in `[COLOR PALETTE]`.
4. THE WIF SHALL contain no date, time or other value that changes between runs, and SHALL use `\r\n` line endings.
5. WHEN `readWif` is given text written by `writeWif`, THE function SHALL return a Lift_Plan equal to the original (round trip).
6. IF `readWif` is given text without a `[LIFTPLAN]` or `[THREADING]` section, with a threading that is not one shaft per end in order, or with a shaft number out of range, THEN it SHALL return an Export_Error naming the problem.
7. THE WIF mapping (one shaft per hook, liftplan form) SHALL be labelled `[to verify]` in code and in the export panel until a weaving tool we did not write has opened an exported file correctly.

### Requirement 4: Card set export

**User Story:** As a card puncher, I want the card set as printable sheets, numbered and in lacing order, so that I can punch it.

#### Acceptance Criteria

1. WHEN `cardSheetSvg` or `cardSheetPdf` is given a valid Lift_Plan and a Loom_Profile, THE function SHALL draw one card per pick, so that the number of cards equals `pickCount`.
2. THE cards SHALL appear in lacing order, card 1 first, each labelled with its number, with card `n` encoding pick `n - 1`.
3. EACH card SHALL have exactly `hookCount + spareHookCount` hole positions, laid out with the engine's `cardRows`: rows of `hooksPerCardRow` slots, slot 0 at the top of a row [sourced, S1], row 0 nearest the numbered end [to verify].
4. EACH punched position SHALL be drawn as a filled hole and each unpunched position as an empty outline, so that the punched count drawn equals the punched count in the engine's `buildCards` output.
5. EVERY page or sheet SHALL carry the text "Schematic, not to scale. The card format is a configurable loom profile and has not been tested on a working loom." and the profile summary (hook count, spare hooks, hooks per row, hole meaning).
6. THE PDF SHALL be a valid PDF 1.4 document: a header, objects with a correct cross-reference table whose offsets point at each object, a trailer and `%%EOF`; A4 pages; vector drawing only; no compression; no creation date.
7. THE SVG and PDF output SHALL be byte-identical for identical inputs.
8. IF the Lift_Plan or profile is rejected by the engine, THEN the function SHALL return the engine error unchanged.

### Requirement 5: Point-paper sheet

**User Story:** As a designer, I want a classic point-paper sheet, so that I can print the design or share it.

#### Acceptance Criteria

1. WHEN `pointPaperSvg` is given a Design and a region palette, THE function SHALL draw one square per cell in the region colour, pick 0 at the bottom, end 0 at the left, a light line between cells and a heavier line every 8 cells, with end numbers along the bottom and pick numbers along the left every 8 cells.
2. THE sheet SHALL include a legend of region colours and region numbers, and SHALL mark each cell with its region number when the design is at most 64 by 64, so that colour is not the only signal.
3. THE output SHALL be deterministic and SHALL escape any text it includes.

### Requirement 6: Export panel

**User Story:** As a designer, I want one place to download every file, so that I can hand them to the card puncher.

#### Acceptance Criteria

1. THE web app SHALL offer downloads for the card set (SVG and PDF), the point-paper sheet (SVG) and the WIF file, with file names that include a short design name and the profile, such as `jacquard-240-cards.pdf`.
2. WHILE the float check reports violations and no fixed plan is current, THE web app SHALL NOT export cards or WIF silently: it SHALL show the violation count and offer auto-fix or "Export anyway" with a confirmation.
3. WHEN a fixed plan is current, THE exports SHALL use the fixed plan, and the panel SHALL say so.
4. IF an export function returns an error or throws, THEN THE web app SHALL show an export failure message distinct from model and engine errors, with a retry.
5. THE export panel SHALL show the WIF `[to verify]` note and the untested-card-format note.

### Requirement 7: Package boundaries

**User Story:** As a maintainer, I want export code to stay pure and layered, so that it is testable and the same everywhere.

#### Acceptance Criteria

1. THE `@jacquard/export` package SHALL depend at runtime only on `@jacquard/engine`, and SHALL NOT use the DOM, Node-only APIs, the network, the clock or random values.
2. THE `@jacquard/engine` package SHALL NOT change in this feature, and no file under `packages/engine/test/fixtures` SHALL change.
3. THE `@jacquard/export` package SHALL define `typecheck` and `test` scripts that pass under `pnpm -r typecheck` and `pnpm -r test`.

## Labels

Same labels as the weave-engine spec. New loom facts in this spec: the WIF mapping (one shaft per hook) is `[to verify]`; card dimensions and hole spacing are not sourced, so card sheets are schematics (`weaving-domain.md`, open items). Row 0 nearest the numbered end stays `[to verify]`.

## Decision log

Gap analysis run by the agent under the standing orders in `.kiro/steering/autopilot.md`. No item contradicts `PLAN.md` or a `[sourced]` loom fact.

| Q | Answer | Label |
|---|---|---|
| Where does export code live? | A new pure package `@jacquard/export` that depends on the engine. `weaving-domain.md` says the WIF mapping is part of the export spec, not the engine, so the engine is not changed. | [decision] |
| WIF mapping for a Jacquard | One shaft per figuring hook with a liftplan (no tie-up, no treadling). This is the common way to carry a Jacquard draft in WIF; it has not been confirmed in an independent tool. | [to verify] |
| WIF date field | Left out, so output is byte-identical between runs (Requirement 3.4). If a reader requires `Date`, this is revisited. | [decision] |
| WIF spec source | The published WIF 1.1 text (mhsoft.com) could not be fetched from the build machine (EHOSTUNREACH). Section names come from secondary descriptions of the format. To be checked when an exported file is opened in another tool (playbook Phase D manual step). | [to verify] |
| Spare and idle hooks in WIF | Spare positions are not shafts; idle hooks are threaded and simply never lifted. | [decision] |
| Card sheet scale | Schematic, not to scale; card dimensions are not in S1. | [decision] |
| PDF writer | Hand-written PDF 1.4, uncompressed, Helvetica (a standard PDF font, no embedding), A4 portrait, as many cards per page as fit. No dependency. | [decision] |
| Cards per page | Computed from the card's row count; at least one card per page. | [decision] |
| Simulator rendering | Thread segments per cell, warp vertical and weft horizontal, with a slight shade for the crossing thread. It is a draft view, not photorealistic. | [decision] |
| Yarn colours | Default warp is a dark neutral, default weft is region 0's display colour; the user can change both. Regions are weave structures, not yarns (`weaving-domain.md`), so yarn colours are separate from region colours. | [decision] |
| MCP export tool | Not added in this phase; the weave-mcp spec fixes six tools. Can be added later as its own change. | [decision] |
| Export with violations | Blocked behind a confirmation, as `design-language.md` requires ("never silently export"). | [decision] |
