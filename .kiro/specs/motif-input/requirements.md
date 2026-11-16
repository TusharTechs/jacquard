# Requirements Document

## Introduction

Scope: the motif step and the point-paper editor. A designer types a description or uploads a sketch. A small AWS backend asks a language model for a clean vector motif (SVG) limited to the loom profile's colour count, with the chosen symmetry and repeat size. The app turns the SVG into a design grid at hook resolution, removes specks smaller than a minimum feature size, and passes the grid to `@jacquard/engine`. The designer then edits cells by hand on a point-paper grid and sees the float check update. No model key reaches the browser.

Three code locations are involved:

- `packages/motif` (`@jacquard/motif`, new): pure TypeScript with no runtime dependencies. It validates model output (the motif SVG subset), rasterizes it to a design grid, removes specks and applies symmetry. It also holds the deterministic stand-in generator.
- `backend` (`@jacquard/backend`, new): the model-call proxy, written as an AWS Lambda handler with a local development server. It never returns SVG that `@jacquard/motif` rejects.
- `apps/web` (`@jacquard/web`, new): the React single-page app with the loom setup, the motif input, the point-paper editor and the float check panel.

The card format has not been tested on a working loom. This spec adds no loom facts; every loom value comes from a loom profile in the engine.

Acceptance criteria are cited as `N.M`: criterion M of Requirement N.

## Glossary

- **Motif**: a clean, limited-colour vector drawing for one repeat of the design, written in the Motif_SVG subset.
- **Motif_SVG**: the SVG subset accepted by `parseMotif` (Requirement 4).
- **Palette**: the ordered list of distinct fill colours of a Motif. Palette index `i` becomes region index `i` in the design.
- **Background**: the colour of palette index 0. Cells that no shape covers get region 0.
- **Design**: the engine type `Design`, `design[pick][end]`, one non-negative region index per cell.
- **Repeat**: the size of one design unit in ends and picks. The design grid has exactly this size.
- **Minimum_Feature**: the smallest number of cells a connected same-region area may have after speck removal.
- **Speck**: a 4-connected area of cells with the same region index whose cell count is below Minimum_Feature.
- **Symmetry**: one of `none`, `mirrorEnds` (left-right mirror), `mirrorPicks` (mirror between first and last pick), `mirrorBoth`.
- **Motif_Request**: the JSON body the app sends to the backend: a text prompt or a sketch image, the colour count, the symmetry and the repeat.
- **Motif_Response**: the JSON body the backend returns on success: the Motif_SVG text, the Palette and the source (`model` or `standIn`).
- **Motif_Error**: the JSON body the backend returns on failure, with a stable `code` and a `message`.
- **Generator**: the backend component that produces Motif_SVG from a Motif_Request. Two exist: the Bedrock generator and the Stand_In generator.
- **Stand_In**: the deterministic Generator in `@jacquard/motif` used when model access is not available. Its output is labelled as a stand-in.
- **Editor**: the point-paper editor in `apps/web`.
- **Editor_State**: the pure state of the Editor: the design grid, the current region, the undo and redo stacks.
- **Engine**: `@jacquard/engine`.

## Requirements

### Requirement 1: Motif request and response contract

**User Story:** As a designer, I want to describe a motif in words or upload a sketch and get a clean motif back, so that I can start a design without drawing every cell.

#### Acceptance Criteria

1. THE backend SHALL accept `POST /api/motif` with a JSON Motif_Request that has `input` (either `{ "kind": "text", "prompt": string }` or `{ "kind": "sketch", "mediaType": "image/png" | "image/jpeg", "data": base64 string }`), `colourCount` (integer 2 to 8), `symmetry` (one of the four Symmetry values) and `repeat` (`{ "ends": integer 8 to 400, "picks": integer 8 to 400 }`).
2. WHEN a valid Motif_Request is processed successfully, THE backend SHALL return HTTP 200 with a Motif_Response `{ "svg": string, "palette": string[], "source": "model" | "standIn" }`, where `palette` has between 2 and `colourCount` entries.
3. IF the Motif_Request is not valid JSON, has a missing or wrongly typed field, an empty or whitespace-only prompt, a prompt longer than 500 characters (counted as Unicode code points), or a sketch whose decoded size is over 1,500,000 bytes, THEN THE backend SHALL return HTTP 400 with a Motif_Error whose `code` is `REQUEST_INVALID` and whose message names the field, and SHALL NOT call a Generator.
4. THE backend SHALL return the same Motif_Response shape for the Bedrock generator and the Stand_In, differing only in `source`, `svg` and `palette`.
5. WHEN the Stand_In is used, THE backend SHALL set `source` to `standIn`.

### Requirement 2: No model key in the browser

**User Story:** As the project owner, I want model credentials to stay on the server, so that no visitor can take them.

#### Acceptance Criteria

1. THE web app SHALL send motif requests only to the backend path `/api/motif` on its own origin or a configured backend base URL, and SHALL NOT call a model provider endpoint directly.
2. THE backend SHALL obtain model access only from the Lambda execution role or from the standard AWS credential chain, and SHALL NOT read a model key from the request.
3. THE backend SHALL NOT include any credential, authorization header, AWS account identifier or environment variable value in a Motif_Response or Motif_Error.
4. THE repository SHALL contain no model key, AWS access key or secret, and the web build output SHALL contain no AWS credential or model endpoint URL.

### Requirement 3: Model failure cases

**User Story:** As a designer, I want a clear message when the model step fails, so that I know whether to retry, change the prompt or draw by hand.

#### Acceptance Criteria

1. IF the Generator does not finish within 25 seconds, THEN THE backend SHALL return HTTP 504 with a Motif_Error whose `code` is `MODEL_TIMEOUT`.
2. IF the Generator output is not Motif_SVG (Requirement 4), THEN THE backend SHALL return HTTP 502 with a Motif_Error whose `code` is `MOTIF_SVG_INVALID` and whose message states the first problem found, and SHALL NOT return the rejected SVG.
3. IF the Generator output has more distinct fill colours than `colourCount`, THEN THE backend SHALL return HTTP 502 with a Motif_Error whose `code` is `MOTIF_TOO_MANY_COLOURS` and whose message gives the count found and the limit.
4. IF the model provider refuses the call because model access is not enabled, the call is throttled, or the provider is unreachable, THEN THE backend SHALL return HTTP 503 with a Motif_Error whose `code` is `MODEL_UNAVAILABLE`.
5. IF any other exception occurs in the backend, THEN THE backend SHALL return HTTP 500 with a Motif_Error whose `code` is `INTERNAL_ERROR` and a fixed message, with no stack trace or file path.
6. WHEN the web app receives a Motif_Error or cannot reach the backend, THE web app SHALL show a message that distinguishes a model failure, an invalid motif and a network failure, keep the current design editable, and offer a retry.
7. WHILE a motif request is in progress, THE web app SHALL show progress and a cancel action, and WHEN the user cancels, THE web app SHALL abort the request and keep the previous design.

### Requirement 4: Motif SVG validation

**User Story:** As the project owner, I want every model output checked before it reaches the engine, so that malformed or unsafe SVG never becomes a design.

#### Acceptance Criteria

1. THE `parseMotif` function SHALL accept a document whose root element is `svg` with a `viewBox` of four finite numbers with positive width and height, and whose descendants are only `g`, `rect`, `circle`, `ellipse`, `polygon` and `path` elements, plus an optional `title` and `desc`.
2. THE `parseMotif` function SHALL accept on shapes only the geometry attributes of that shape, `fill`, `transform` limited to `translate`, `scale` and `matrix`, and `id`, and SHALL accept `fill` only as `#rgb` or `#rrggbb` hex colours. `path` data SHALL be limited to the commands `M`, `L`, `H`, `V`, `Z` and their lower-case forms.
3. IF the input contains any other element (including `script`, `foreignObject`, `image`, `use`, `style`, `text`), any attribute starting with `on`, any `href` or `xlink:href`, any CSS `style` attribute, a `<!DOCTYPE` or `<!ENTITY` declaration, a processing instruction other than the XML declaration, or a `fill` that is not a hex colour or `none`, THEN THE `parseMotif` function SHALL return a typed error with the code `MOTIF_SVG_INVALID` and a `reason` naming the first offending element or attribute.
4. IF the input is longer than 65,536 characters or contains more than 2,000 shapes, THEN THE `parseMotif` function SHALL return `MOTIF_SVG_INVALID` with the reason `tooLarge`.
5. WHEN `parseMotif` succeeds, THE result SHALL contain the viewBox, the Palette and the list of shapes in document order, each shape as polygons in viewBox coordinates with its palette index.
6. THE Palette SHALL list the distinct fill colours in lower-case `#rrggbb` form, with the fill of the first drawn shape (shapes with `fill="none"` are not drawn) as entry 0 when that shape is a `rect` covering the whole viewBox, otherwise `#ffffff` as entry 0, followed by the other colours in order of first appearance.
7. IF the Palette has more entries than the given colour limit, THEN THE `parseMotif` function SHALL return a typed error with the code `MOTIF_TOO_MANY_COLOURS`, the `count` found and the `limit`.
8. THE `parseMotif` function SHALL return the same result for the same input text and limit, and SHALL NOT throw for any string input.

### Requirement 5: Rasterize to the design grid

**User Story:** As a designer, I want the motif turned into point-paper cells at the loom's resolution, so that each cell is one end and one pick.

#### Acceptance Criteria

1. WHEN `rasterizeMotif` is given a parsed Motif and a Repeat, THE function SHALL return a Design with exactly `repeat.picks` rows of exactly `repeat.ends` cells.
2. THE `rasterizeMotif` function SHALL give each cell (end, pick) the palette index of the last shape in document order that contains the cell's centre point, and palette index 0 if no shape contains it.
3. THE `rasterizeMotif` function SHALL map the viewBox so that end 0 is the left edge and pick 0 is the bottom edge of the motif, following the point-paper convention that pick 0 is drawn at the bottom.
4. THE `rasterizeMotif` function SHALL decide containment with the non-zero winding rule for polygons and paths, and SHALL treat a centre point exactly on a shape edge as inside.
5. THE `rasterizeMotif` function SHALL return only region indices from 0 to Palette length minus 1, and SHALL return the same Design for the same inputs.

### Requirement 6: Speck removal

**User Story:** As a designer, I want tiny isolated cells removed, so that the cloth has no features too small to weave cleanly.

#### Acceptance Criteria

1. WHEN `removeSpecks` is given a Design and a Minimum_Feature of at least 1, THE function SHALL return a Design of the same size.
2. AFTER `removeSpecks`, THE Design SHALL contain no Speck, unless the whole Design is a single 4-connected area.
3. THE `removeSpecks` function SHALL merge each Speck into the neighbouring region that shares the most cell edges with it, choosing the lowest region index on a tie, and SHALL process Specks from the smallest to the largest, the lowest first cell in pick-major order first on a tie, repeating until no Speck remains.
4. THE `removeSpecks` function SHALL NOT introduce a region index that was not in the input, and SHALL leave every cell that is not part of a merged Speck unchanged.
5. THE `removeSpecks` function SHALL be idempotent: applying it twice with the same Minimum_Feature gives the same Design as applying it once.
6. WHEN Minimum_Feature is 1, THE `removeSpecks` function SHALL return a Design equal to its input.

### Requirement 7: Symmetry

**User Story:** As a designer, I want to choose a mirror symmetry, so that the motif is balanced exactly, cell for cell.

#### Acceptance Criteria

1. WHEN `applySymmetry` is given `mirrorEnds`, THE function SHALL copy each cell (end, pick) with `end < ceil(ends / 2)` to `(ends - 1 - end, pick)`.
2. WHEN `applySymmetry` is given `mirrorPicks`, THE function SHALL copy each cell (end, pick) with `pick < ceil(picks / 2)` to `(end, picks - 1 - pick)`.
3. WHEN `applySymmetry` is given `mirrorBoth`, THE function SHALL apply `mirrorEnds` then `mirrorPicks`.
4. WHEN `applySymmetry` is given `none`, THE function SHALL return a Design equal to its input.
5. THE result of `applySymmetry` SHALL be symmetric for the chosen Symmetry, SHALL be idempotent, and SHALL leave the source half unchanged.
6. THE motif pipeline SHALL apply symmetry after rasterizing and before speck removal, then apply symmetry again after speck removal, so that the final Design is symmetric.

### Requirement 8: Stand-in generator

**User Story:** As the project owner, I want the motif step to work without model access, so that the app can be built and demonstrated before Bedrock is enabled.

#### Acceptance Criteria

1. THE Stand_In SHALL produce Motif_SVG for any valid Motif_Request without network access.
2. WHEN the Stand_In receives the same Motif_Request twice, THE Stand_In SHALL return byte-identical SVG.
3. THE Stand_In output SHALL pass `parseMotif` with the request's `colourCount` as the limit.
4. THE Stand_In SHALL choose among at least four motif families (for example lozenge, stripe, chevron, star) from a hash of the prompt text or the sketch bytes, and SHALL use exactly `colourCount` colours.
5. THE web app SHALL label a motif from the Stand_In as a stand-in, distinct from a model suggestion.

### Requirement 9: Point-paper editor

**User Story:** As a designer, I want to touch up the design cell by cell on point paper, so that I keep control of the final design.

#### Acceptance Criteria

1. THE Editor SHALL draw the Design as point paper with pick 0 at the bottom, end 0 at the left, a light line between cells and a heavier line every 8 cells.
2. WHEN the user presses on a cell or drags across cells with a pointer (mouse, pen or touch), THE Editor SHALL set every cell the pointer passes over to the current region, as one undoable edit per press-drag-release.
3. THE Editor SHALL offer undo and redo of at least 100 edits, with the keyboard shortcuts Ctrl+Z or Cmd+Z for undo and Ctrl+Shift+Z, Cmd+Shift+Z or Ctrl+Y for redo, and visible buttons.
4. THE Editor SHALL let the user change the cell size between 4 and 32 pixels, with a default that fits a 360-pixel-wide viewport without horizontal page scroll.
5. THE Editor SHALL be usable from the keyboard: arrow keys move a visible cell cursor, Space or Enter paints the cursor cell, and the number keys 1 to 8 choose the current region.
6. THE Editor SHALL show the hovered or cursor cell's end and pick numbers in the monospace font.
7. AN edit SHALL never change the size of the Design.
8. WHEN a new motif replaces the Design, THE Editor SHALL record it as one undoable edit.

### Requirement 10: Engine check after every change

**User Story:** As a designer, I want to see float problems while I edit, so that I never export a weak cloth by accident.

#### Acceptance Criteria

1. WHEN the Design, the weave assignment or the loom setup changes, THE web app SHALL call the Engine `buildLiftPlan` and `checkFloats` and show the violation count.
2. THE web app SHALL show each float violation on the point paper with colour and a marker shape, and list it with its direction, side, pick, end and length.
3. WHEN violations exist, THE web app SHALL offer auto-fix, which calls the Engine `autoFix` and shows the number of flipped cells, and SHALL show `AUTOFIX_FAILED` with the violations that remain.
4. IF the Engine returns a typed error, THEN THE web app SHALL show its message in plain words and highlight the offending cells when the error names a pick and an end.
5. THE web app SHALL assign a default weave to each region (region 0 plain; other regions a 1/3 twill or a satin, in a fixed order) and let the user change it.
6. THE web app SHALL NOT contain weaving logic of its own; every lift plan, float list and fix comes from the Engine.

### Requirement 11: Loom setup

**User Story:** As a designer, I want to choose the loom profile, colour count and repeat size, so that the motif fits my loom.

#### Acceptance Criteria

1. THE web app SHALL offer the built-in profiles 120, 240 and 400 hooks, a colour count from 2 to the profile's region limit, a repeat size in ends (at most the hook count) and picks, a Minimum_Feature from 1 to 16 cells, a Symmetry, and a "repeat across" switch.
2. IF "repeat across" is on and the repeat width does not divide the hook count, THEN THE web app SHALL show the Engine's `REPEAT_NOT_DIVISIBLE` message next to the switch.
3. THE web app SHALL show, next to the loom setup, that the card format is a configurable profile and has not been tested on a working loom.

### Requirement 12: Required states and framing

**User Story:** As a visitor, I want every panel to tell me what to do, so that I am never stuck.

#### Acceptance Criteria

1. THE motif panel, the point paper and the float panel SHALL each define an empty state, a loading state, an error state and a layout that works at 360 pixels wide.
2. THE web app SHALL label every motif from the model as a suggestion the designer can edit.
3. THE web app copy SHALL say the tool assists the designer and the card puncher, SHALL NOT say it replaces them, and SHALL state no unsourced statistic.
4. WHEN the network is offline, THE web app SHALL say so, keep the Editor usable and offer a retry when the network returns.

### Requirement 13: Package boundaries

**User Story:** As a maintainer, I want the new code to keep the layering, so that weaving logic stays in one place.

#### Acceptance Criteria

1. THE `@jacquard/motif` package SHALL have no runtime dependencies and SHALL NOT use the DOM, Node-only APIs or the network.
2. THE `@jacquard/engine` package SHALL NOT depend on `@jacquard/motif`, and its `package.json` SHALL keep zero `dependencies`.
3. THE `apps/web` and `backend` packages SHALL import the Engine and `@jacquard/motif` only through their package names.
4. THE backend SHALL validate every Generator output with `parseMotif` before returning it.
5. THE `apps/web`, `backend` and `packages/motif` packages SHALL each define `typecheck` and `test` scripts that pass under `pnpm -r typecheck` and `pnpm -r test`.

## Labels

Same labels as the weave-engine spec. This spec adds no loom facts. The numbers in it (25-second timeout, 500-character prompt, 65,536-character SVG, 2,000 shapes, 1,500,000-byte sketch, repeat 8 to 400) are product limits, not loom facts, and are all `[decision]`.

## Decision log

Gap analysis run by the agent under the standing orders in `.kiro/steering/autopilot.md`, resolved from `PLAN.md`, the steering files and the engine. No item here contradicts `PLAN.md` or a `[sourced]` loom fact.

| Q | Answer | Label |
|---|---|---|
| Where does rasterization live? | In a new pure package `@jacquard/motif`. `weaving-domain.md` rule 9 says reducing an image to regions happens outside the engine and the engine never calls a model. `structure.md` keeps weaving logic out of `apps/web`. A shared package lets the backend validate at the boundary (`tech.md`) and lets the web app rasterize with the same code. `structure.md` is updated to list the package. | [decision] |
| Rasterize SVG without a DOM? | The model is limited to a small SVG subset (Requirement 4), parsed by a hand-written parser. Shapes become polygons; cells are sampled at their centres. This keeps the package dependency-free and deterministic, so it runs the same in the browser, Lambda and tests. | [decision] |
| Background colour | Palette entry 0 is the fill of a first, full-viewBox shape, or white. Uncovered cells are region 0. The model prompt asks for a full background rectangle first. | [decision] |
| Colour count includes the background? | Yes. `colourCount` is the total number of regions, so it maps one to one onto the engine's region limit. | [decision] |
| Pick orientation | SVG y grows downward; point paper draws pick 0 at the bottom (`weaving-domain.md`, [convention]). So the bottom edge of the viewBox is pick 0. | [decision] |
| Speck merge rule | Merge into the neighbour sharing the most edges, lowest index on a tie, smallest speck first. Deterministic and simple to state as properties. 4-connectivity, because diagonal-only contact does not interlace on point paper. | [decision] |
| Symmetry set | `none`, `mirrorEnds`, `mirrorPicks`, `mirrorBoth`. Rotational symmetry is left out of version 1. Symmetry is enforced on the grid after rasterizing, because a model cannot be trusted to be cell-exact. | [decision] |
| Repeat and design size | The design grid is one repeat (ends by picks). Tiling across all hooks is the engine's `repeatAcross`, already specified. | [decision] |
| Sketch input | The sketch goes to the model as an image with the same instructions. The Stand_In hashes the image bytes to pick a motif family; it does not trace the sketch. That is a stand-in limitation, shown in the UI. | [decision] |
| Model and provider | Amazon Bedrock through the AWS SDK (`@aws-sdk/client-bedrock-runtime`, Converse API) in the backend. The model ID is a Lambda environment variable, default `us.anthropic.claude-sonnet-5-5`. Bedrock lists the model in `us-west-2`; invoking it costs money, so it was not called during the build (stop condition). | [decision] |
| Timeout | 25 seconds, under API Gateway's 29-second integration limit. | [decision] |
| Retries | No automatic retry in version 1. The user retries. | [decision] |
| Deployment | The backend is written and tested locally; nothing is deployed in this phase. Creating AWS resources needs the user's approval (stop condition). | [decision] |
| Default weaves per region | Region 0 plain; regions 1 to 7 cycle through twill 1/3 Z, satin 5 move 2 weft-faced, twill 3/1 S, satin 8 move 3 warp-faced. Plain on the ground binds every end and pick. | [decision] |
| Editor interaction details | Spec covers behaviour (paint, undo, zoom, keyboard, touch). Feel (cursor style, colours, drag smoothing) is done in vibe mode, as `BUILD_PLAYBOOK.md` asks, and noted in the journey. | [decision] |
| Undo depth | At least 100 edits; the implementation keeps 200. | [decision] |
| Web test stack | vitest with jsdom and Testing Library for component tests; the editor state is a pure module with property tests. | [decision] |
