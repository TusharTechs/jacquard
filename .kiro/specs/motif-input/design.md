# Design Document: motif-input

Traces to `requirements.md`. Acceptance criteria are cited as `N.M`. Correctness properties are cited as Property N.

## Overview

```
apps/web  ──POST /api/motif──►  backend (Lambda or local dev server)
   │                               │ validateRequest ─► 400 REQUEST_INVALID
   │                               │ generator.generate(request, signal)   (Bedrock or Stand_In)
   │                               │ parseMotif(svg, colourCount) ─► 502 MOTIF_SVG_INVALID / MOTIF_TOO_MANY_COLOURS
   │◄── { svg, palette, source } ──┘ timeout 25 s ─► 504 MODEL_TIMEOUT; provider refusal ─► 503 MODEL_UNAVAILABLE
   │
   │ motifToDesign(svg, setup)      @jacquard/motif: parseMotif → rasterizeMotif → applySymmetry → removeSpecks → applySymmetry
   ▼
 Editor_State (pure reducer) ──► point paper (canvas) ──► @jacquard/engine buildLiftPlan + checkFloats (+ autoFix on request)
```

The web app rasterizes the SVG itself with `@jacquard/motif`, so the backend only returns validated SVG and the palette. The backend runs `parseMotif` on every output so no invalid SVG crosses the boundary (13.4).

## Architecture

### Packages

| Package | Folder | Runtime dependencies | Purpose |
|---|---|---|---|
| `@jacquard/motif` | `packages/motif` | none | `parseMotif`, `rasterizeMotif`, `applySymmetry`, `removeSpecks`, `motifToDesign`, `standInMotif`, request types |
| `@jacquard/backend` | `backend` | `@jacquard/motif` (workspace), `@aws-sdk/client-bedrock-runtime` 3.1169.0 | `handleMotifRequest`, Lambda `handler`, Bedrock generator, local dev server |
| `@jacquard/web` | `apps/web` | `@jacquard/engine`, `@jacquard/motif` (workspace), `react` 19.3.1, `react-dom` 19.3.1 | SPA |

All three packages are ESM TypeScript with `strict` (the base tsconfig). `@jacquard/motif` follows the engine's package shape (`main`, `types`, `exports` pointing at `./src/index.ts`, no `dependencies`). The web app is built by Vite, which compiles the workspace TypeScript sources directly. The backend is bundled by esbuild into `backend/dist/handler.js` for Lambda, with the AWS SDK left external (the Node.js Lambda runtime ships it).

Dev dependencies follow the versions already in the workspace: `typescript` 7.0.2, `vitest` 5.1.0, `fast-check` 4.10.2, `@types/node` 22.20.5, `esbuild` 0.28.2. Web adds `vite` 8.3.8, `@vitejs/plugin-react` 6.3.0, `@types/react` 19.3.0, `@types/react-dom` 19.3.0, `@testing-library/react` 16.3.3, `jsdom` 31.0.1. Backend adds `@types/aws-lambda` 8.10.164. All pinned exactly.

### Local development

`pnpm --filter @jacquard/backend dev` starts `backend/src/dev-server.ts` on `127.0.0.1:8787` with the Stand_In generator, unless `MOTIF_GENERATOR=bedrock` is set. `pnpm --filter @jacquard/web dev` starts Vite, which proxies `/api` to `127.0.0.1:8787`. In production the SPA and the API share an origin through CloudFront, or the build sets `VITE_API_BASE` (2.1). Deployment is out of scope for this phase.

## Components and Interfaces

### `@jacquard/motif`

```ts
export type Symmetry = "none" | "mirrorEnds" | "mirrorPicks" | "mirrorBoth";
export interface Repeat { readonly ends: number; readonly picks: number }
export type Point = readonly [x: number, y: number];
export interface MotifShape { readonly paletteIndex: number; readonly polygons: readonly (readonly Point[])[] }
export interface Motif {
  readonly viewBox: readonly [minX: number, minY: number, width: number, height: number];
  readonly palette: readonly string[];          // lower-case #rrggbb, entry 0 is the background
  readonly shapes: readonly MotifShape[];      // document order
}
export type MotifError =
  | { code: "MOTIF_SVG_INVALID"; reason: string; message: string }
  | { code: "MOTIF_TOO_MANY_COLOURS"; count: number; limit: number; message: string };
export type MotifResult<T> = { ok: true; value: T } | { ok: false; error: MotifError };

export function parseMotif(svg: string, colourLimit: number): MotifResult<Motif>;
export function rasterizeMotif(motif: Motif, repeat: Repeat): number[][];          // design[pick][end]
export function applySymmetry(design: readonly (readonly number[])[], symmetry: Symmetry): number[][];
export function removeSpecks(design: readonly (readonly number[])[], minFeature: number): number[][];
export interface MotifSetup { readonly colourCount: number; readonly symmetry: Symmetry; readonly repeat: Repeat; readonly minFeature: number }
export function motifToDesign(svg: string, setup: MotifSetup): MotifResult<{ design: number[][]; palette: string[] }>;

// Request contract shared by backend and web (Requirement 1)
export type MotifInput = { kind: "text"; prompt: string } | { kind: "sketch"; mediaType: "image/png" | "image/jpeg"; data: string };
export interface MotifRequest { input: MotifInput; colourCount: number; symmetry: Symmetry; repeat: Repeat }
export interface MotifResponse { svg: string; palette: string[]; source: "model" | "standIn" }
export type MotifErrorCode = "REQUEST_INVALID" | "MODEL_TIMEOUT" | "MOTIF_SVG_INVALID" | "MOTIF_TOO_MANY_COLOURS" | "MODEL_UNAVAILABLE" | "INTERNAL_ERROR";
export interface MotifErrorBody { code: MotifErrorCode; message: string; field?: string }
export function validateMotifRequest(body: unknown): { ok: true; value: MotifRequest } | { ok: false; error: MotifErrorBody };

export function standInMotif(request: MotifRequest): string;   // Motif_SVG text
export const STAND_IN_FAMILIES: readonly string[];             // ["lozenge", "stripe", "chevron", "star", ...]
```

`validateMotifRequest` lives in `@jacquard/motif` so the web app can check its own request before sending, and the backend checks it again (1.3).

#### Parser (`parse-motif.ts`, Requirement 4)

A small hand-written XML tokenizer that understands only what Motif_SVG needs: an optional XML declaration, comments (skipped), start tags, end tags, self-closing tags, double- or single-quoted attributes, whitespace text. Any other markup (`<!DOCTYPE`, `<!ENTITY`, `<![CDATA[`, processing instructions other than `<?xml ...?>`, non-whitespace text outside `title` and `desc`) is rejected with a reason. Entity references other than the five XML built-ins are rejected. The tokenizer never uses a regular expression with nested quantifiers on the whole input, so its run time is linear in the input length.

Checks in order: size (65,536 characters, `tooLarge`); markup; root is `svg` with a valid `viewBox`; element allow list; attribute allow list per element (`id`, `fill`, `transform` on all shapes and `g`; geometry: `rect` x y width height; `circle` cx cy r; `ellipse` cx cy rx ry; `polygon` points; `path` d; `svg` also accepts `xmlns`, `viewBox`, `width`, `height`, `version`); forbidden attribute rules (any `on*`, `href`, `xlink:href`, `style`); fill syntax; transform syntax; path command set; shape count (2,000, `tooLarge`). `fill` is inherited from the nearest `g` ancestor that sets it; a shape with no fill anywhere is black `#000000`, as in SVG. `fill="none"` shapes are dropped. Transforms compose from the outermost `g` inward, as 2D affine matrices.

Shapes become polygons in viewBox coordinates: `rect` four corners; `circle` and `ellipse` 64-gon approximations (the vertex count is fixed so output is deterministic); `polygon` its points; `path` one polygon per subpath (`M` starts a new one, `Z` closes it; an unclosed subpath is closed implicitly, as fill does in SVG).

Palette rule (4.6): if the first shape in document order is a `rect` whose transformed corners cover the whole viewBox, its colour is entry 0; otherwise entry 0 is `#ffffff`. Other colours follow in first-appearance order. Colours compare after normalising `#abc` to `#aabbcc` and lowering case. A non-background shape whose colour equals the background shares index 0.

Every failure is returned as a value; the whole function body is wrapped so that an unexpected exception becomes `MOTIF_SVG_INVALID` with reason `internal` (4.8).

#### Rasterizer (`rasterize.ts`, Requirement 5)

For cell (end, pick), the centre in viewBox coordinates is `x = minX + (end + 0.5) * width / ends`, `y = minY + height - (pick + 0.5) * height / picks` (pick 0 at the bottom, 5.3). For each shape from last to first, the first one with a polygon set that contains the point gives the cell's palette index (5.2). Containment uses the non-zero winding number summed over the shape's polygons; a point on an edge (distance below `1e-9` times the viewBox diagonal) counts as inside (5.4).

#### Symmetry (`symmetry.ts`, Requirement 7)

`mirrorEnds` copies the left half including the middle column onto the right; `mirrorPicks` copies the lower half (low pick numbers) onto the upper half. Pure; returns new arrays.

#### Speck removal (`specks.ts`, Requirement 6)

Rule: label 4-connected components; collect components smaller than `minFeature`; if none, or the design is a single component, stop. Order specks by size, then by the pick-major index of their first cell. Take the first speck only, count shared edges with each neighbouring region, relabel the speck to the region with the most shared edges (lowest index on a tie), and repeat. One speck per step keeps the rule simple to state (6.3). Each step reduces the component count by at least one, so the loop ends after at most `ends * picks` steps. A speck always has a neighbour unless it is the whole design.

Implementation (finding from task 2.2): relabelling the whole grid after every merge took 6.5 s on a noisy 120 by 120 grid. The implementation keeps the components and a min-heap ordered by (size, first cell) and updates only the components a merge touches. It makes the same choice at every step as the literal rule; this was checked against a literal implementation on 5,000 random grids during the task, and Properties 7 and 8 check the rule itself.

#### Pipeline (`motif-to-design.ts`, 7.6)

`parseMotif(svg, colourCount)` → `rasterizeMotif(motif, repeat)` → `applySymmetry` → `removeSpecks(minFeature)` → `applySymmetry`. Returns the design and the palette.

#### Stand_In (`stand-in.ts`, Requirement 8)

FNV-1a 32-bit hash of `prompt` (text) or `data` (sketch), combined with `colourCount`, `symmetry`, `repeat.ends` and `repeat.picks`. The hash picks a family (`lozenge`, `stripe`, `chevron`, `star`, `check`) and a palette from a fixed list of yarn-like colours. Output is a Motif_SVG with a full-size background `rect` first and exactly `colourCount - 1` further colours. Coordinates are integers in a `0 0 100 100` viewBox, written with no locale formatting (8.2). No network (8.1).

### Backend

```ts
export interface Generator {
  readonly source: "model" | "standIn";
  generate(request: MotifRequest, signal: AbortSignal): Promise<string>;   // raw SVG text
}
export class GeneratorUnavailable extends Error {}   // provider refused, throttled or unreachable (3.4)
export interface HandlerDeps { generator: Generator; timeoutMs: number }   // timeoutMs 25000 in production
export interface HttpResult { status: number; body: MotifResponse | MotifErrorBody }
export async function handleMotifRequest(rawBody: string | undefined, deps: HandlerDeps): Promise<HttpResult>;
```

`handleMotifRequest` order: JSON parse and `validateMotifRequest` (400); race `generator.generate` against the timeout, aborting the signal on timeout (504); `GeneratorUnavailable` (503); any other exception (500, fixed message `"Internal error."`); `parseMotif` (502 with `MOTIF_SVG_INVALID` or `MOTIF_TOO_MANY_COLOURS`); success 200. The error body never contains the generator's message text, the request headers or `process.env` values (2.3, 3.5).

`handler.ts` adapts API Gateway HTTP API (payload 2.0) events: `POST /api/motif` only (otherwise 404 `REQUEST_INVALID`), JSON response with `content-type: application/json` and `cache-control: no-store`. The generator is chosen once at cold start from `MOTIF_GENERATOR` (`bedrock`, the default in Lambda, or `standIn`).

`bedrock-generator.ts` builds a Converse API call (`ConverseCommand`) with model ID from `MOTIF_MODEL_ID` (default `us.anthropic.claude-sonnet-5-5`), a system prompt from `prompt.ts`, and the user's text or image. It extracts the first ```` ```svg ```` block or the first `<svg ...>...</svg>` span from the reply. `AccessDeniedException`, `ThrottlingException`, `ServiceUnavailableException`, `ModelNotReadyException` and network errors become `GeneratorUnavailable`. It is unit-tested with an injected fake client only; no test calls Bedrock.

`prompt.ts` states the Motif_SVG rules: one `svg` root with `viewBox="0 0 100 100"`, a full background `rect` first, only the allowed elements, flat hex fills, at most `colourCount` colours in total including the background, no text, gradients, strokes or opacity, bold shapes no thinner than about 100 / (repeat size) × minimum feature units, and the requested symmetry.

`dev-server.ts` is a `node:http` server for local use only: it serves `POST /api/motif` through `handleMotifRequest` with the Stand_In unless `MOTIF_GENERATOR=bedrock`.

### Web app

```
apps/web/src/
  main.tsx, app.tsx, styles.css
  components/ui/      button.tsx field.tsx panel.tsx dialog.tsx toast.tsx tabs.tsx  (shared set, design-language.md)
  components/         loom-setup-panel.tsx motif-panel.tsx point-paper.tsx editor-toolbar.tsx
                      weave-panel.tsx float-panel.tsx region-legend.tsx term.tsx (plain-language tooltip)
  state/              editor-state.ts (pure reducer), setup-state.ts
  lib/                motif-client.ts (fetch + AbortController), engine-check.ts (calls the engine, no logic),
                      default-weaves.ts, palette.ts (region colours for display)
```

`editor-state.ts` (pure, Property 13): `{ design, region, undo: Design[], redo: Design[] }` with actions `beginStroke`, `paint(end, pick)`, `endStroke`, `undo`, `redo`, `replace(design)`, `setRegion`. A stroke collects cells and commits one undo entry at `endStroke` (9.2). `replace` pushes one undo entry (9.8). The undo stack keeps 200 entries (9.3).

`point-paper.tsx` draws on a `<canvas>`: cells in region colours, 1 px light lines, a heavier line every 8 cells, violations as a coloured cell outline plus a small triangle marker (colour is not the only signal), the cursor as a 2 px focus ring. Pick 0 is the bottom row (9.1). Pointer Events cover mouse, pen and touch (9.2). `touch-action: none` on the canvas during a stroke; pinch zoom maps to the cell size (9.4). The canvas has `role="grid"` semantics through an `aria-label` and a live region announcing "end E, pick P, region R" for the cursor (9.5, 9.6).

`engine-check.ts` calls `buildLiftPlan`, then `checkFloats`, and `autoFix` on request. It holds no weaving logic (10.6). Results are memoised by design reference so a repaint does not rerun the engine.

`motif-client.ts` sends `validateMotifRequest`-checked requests with `fetch` to `${import.meta.env.VITE_API_BASE ?? ""}/api/motif`, an `AbortController` for cancel (3.7), and a client-side 30-second timeout. It maps failures to `{ kind: "model" | "invalidMotif" | "network" | "offline", message }` (3.6).

## Data Models

Request, response and error bodies are as in `@jacquard/motif` above. The Design is the engine's `design[pick][end]`. The palette maps region index to a display colour. The app keeps the palette next to the design, never inside it.

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system: a formal statement about what the system should do. Properties are the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

Generators live in each package's `test/arbitraries.ts`. Motif tests build Motif_SVG from a generated shape list with a test-only serializer, so the parser is checked against an independent model of what was drawn.

### Property 1: parseMotif is total and deterministic

For any string and any limit from 1 to 8, `parseMotif` returns a value (never throws), and two calls return deeply equal results.

**Validates: Requirements 4.8**

### Property 2: Forbidden constructs are rejected

For any valid generated Motif_SVG and any one forbidden construct inserted at a generated position (a forbidden element, an `on*` attribute, `href`, `xlink:href`, `style`, a DOCTYPE or ENTITY declaration, a non-hex fill, a path command outside `MLHVZ`), `parseMotif` returns `MOTIF_SVG_INVALID`.

**Validates: Requirements 4.1, 4.2, 4.3**

### Property 3: Parse matches the drawn shapes

For any generated list of shapes (rect, circle, ellipse, polygon, path; with and without `g` groups, inherited fills and `translate`/`scale` transforms) serialised to Motif_SVG, `parseMotif` returns the same viewBox, a palette equal to the expected palette from the 4.6 rule, one shape per drawn shape with a non-`none` fill in document order with the expected palette index, and rect polygons equal to the transformed corners. When the expected palette is longer than the limit, the result is `MOTIF_TOO_MANY_COLOURS` with that `count` and `limit`.

**Validates: Requirements 4.5, 4.6, 4.7**

### Property 4: Size limits

For any input longer than 65,536 characters, or any otherwise valid Motif_SVG with more than 2,000 shapes, `parseMotif` returns `MOTIF_SVG_INVALID` with reason `tooLarge`.

**Validates: Requirements 4.4**

### Property 5: Raster shape and range

For any parsed motif and repeat (ends and picks 1 to 64), `rasterizeMotif` returns `picks` rows of `ends` cells, every value is an integer from 0 to palette length minus 1, and two calls are deeply equal.

**Validates: Requirements 5.1, 5.5**

### Property 6: Raster matches an independent oracle

For any motif made only of axis-aligned rects with integer coordinates in a viewBox whose size is a multiple of the repeat, each cell equals the oracle: the palette index of the last rect that contains the cell centre (closed intervals), or 0, with pick 0 taken from the bottom of the viewBox.

**Validates: Requirements 5.2, 5.3, 5.4**

### Property 7: Speck removal postconditions

For any design up to 24 by 24 with up to 6 regions and any Minimum_Feature from 1 to 10, the result of `removeSpecks` has the same size, uses only region indices present in the input, contains no 4-connected component smaller than Minimum_Feature unless it is a single component, leaves every cell of every input component of size at least Minimum_Feature unchanged, and is idempotent. With Minimum_Feature 1 it equals the input.

**Validates: Requirements 6.1, 6.2, 6.4, 6.5, 6.6**

### Property 8: Speck merge choice

For any design containing exactly one speck component that is smaller than Minimum_Feature, while all other components are at least Minimum_Feature, `removeSpecks` relabels exactly that component, to the neighbouring region with the most shared edges, lowest index on a tie. And for any design up to 12 by 12 with up to 5 regions and any Minimum_Feature from 1 to 12, `removeSpecks` equals a literal, relabel-everything-each-step implementation of 6.3 kept in `test/` (added after the task 2.2 finding).

**Validates: Requirements 6.3**

### Property 9: Symmetry

For any design and Symmetry, `applySymmetry` returns a design of the same size that is symmetric for that Symmetry, equal to `applySymmetry` of itself, with the source half (low ends for `mirrorEnds`, low picks for `mirrorPicks`) unchanged; `none` returns an equal design; `mirrorBoth` equals `mirrorPicks` of `mirrorEnds`.

**Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5**

### Property 10: Pipeline output

For any Stand_In request and any Minimum_Feature 1 to 8, `motifToDesign(standInMotif(request), setup)` succeeds with a design of exactly the repeat size, symmetric for the request's Symmetry, using region indices below `colourCount`, and the engine's `buildLiftPlan` accepts it with the web app's default weaves and a profile whose `regionLimit` is at least `colourCount` and whose hook count is at least the repeat width.

**Validates: Requirements 5.1, 7.6, 10.5, 11.1**

### Property 11: Stand_In

For any valid Motif_Request, `standInMotif` returns the same text on two calls, the text passes `parseMotif` with `colourCount` as the limit, and the palette has exactly `colourCount` entries. Over generated prompts, at least four families appear.

**Validates: Requirements 8.1, 8.2, 8.3, 8.4**

### Property 12: Request validation

For any JSON value, `validateMotifRequest` accepts it exactly when it matches 1.1 and the 1.3 limits; for any valid request with one field corrupted (missing, wrong type, out of range, empty prompt, over-long prompt, oversized sketch), it rejects with `REQUEST_INVALID` naming that field.

**Validates: Requirements 1.1, 1.3**

### Property 13: Backend outcomes

For any raw body and any injected generator behaviour (returns valid Motif_SVG, returns arbitrary text, returns SVG with too many colours, throws `GeneratorUnavailable`, throws any other value, never resolves), `handleMotifRequest` resolves to exactly one of the statuses 200, 400, 502, 503, 504, 500 as specified in Requirements 1 and 3; status 200 only when `parseMotif` accepts the returned SVG with the request's `colourCount`; the generator is not called when the body is invalid; and the serialised body never contains a planted secret string set in `process.env`, the generator's error message, or a stack trace.

**Validates: Requirements 1.2, 1.3, 1.4, 1.5, 2.3, 3.1, 3.2, 3.3, 3.4, 3.5, 13.4**

### Property 14: Editor state

For any design up to 32 by 32 and any sequence of up to 40 editor actions, every design in the state has the original size; a stroke sets exactly the visited cells to the current region and leaves all others unchanged; undo after a stroke or replace restores the design before it; redo after undo restores the design after it; a new edit clears the redo stack; and the undo stack never holds more than 200 entries.

**Validates: Requirements 9.2, 9.3, 9.7, 9.8**

## Error Handling

| Situation | Where | Result |
|---|---|---|
| Malformed request | backend, `validateMotifRequest` | 400 `REQUEST_INVALID` with `field` |
| Generator over 25 s | backend | 504 `MODEL_TIMEOUT`; the generator's signal is aborted |
| Provider refusal, throttling, unreachable | backend | 503 `MODEL_UNAVAILABLE` |
| Output not Motif_SVG | backend, `parseMotif` | 502 `MOTIF_SVG_INVALID` with the reason in the message |
| Too many colours | backend, `parseMotif` | 502 `MOTIF_TOO_MANY_COLOURS` |
| Anything else | backend | 500 `INTERNAL_ERROR`, fixed message; details to the log only |
| Network down or offline | web | "You are offline" or "Could not reach the server", design stays editable, retry |
| Engine typed error | web | the engine message, offending cells highlighted when the error names pick and end |

## Testing Strategy

- vitest, run once (`vitest --run`), fast-check with `{ seed, numRuns: 100 }` constants at the top of each property file and `verbose: 1`. Files end in `.property.test.ts`. Each property test carries the tag `Feature: motif-input, Property N: <title>`.
- A property failure is recorded in the journal in full (property, shrunk counterexample, seed, requirement) before the fix. Tests are never weakened.
- `packages/motif/test`: Properties 1 to 12, plus example tests: a hand-written motif with known cells; each forbidden construct by name; a sketch request; a 400-hook repeat.
- `backend/test`: Property 13 with fake generators and short timeouts (`timeoutMs` 20); example tests for the Lambda adapter (404 on other routes, headers); the Bedrock generator with a fake client (SVG extraction, error mapping). No test calls AWS.
- `apps/web/test`: Property 14 on `editor-state.ts`; component tests with Testing Library and jsdom: the motif panel's empty, loading (with cancel), error (three kinds) states; the float panel's empty, violations and auto-fix states; the loom-setup note that the card format is untested; a scan of `apps/web/src` for direct model endpoints (`bedrock`, `amazonaws.com`, `anthropic`), and of the built `dist` for AWS credential patterns (2.1, 2.4).
- Package scans as in weave-mcp: no runtime dependencies in motif; no DOM or Node globals in motif `src`; imports only through package names.
- Each task finishes with `pnpm typecheck` and `pnpm test`, both `EXIT_CODE=0`.

### Not automated

- Real Bedrock calls (needs the user's approval to spend money).
- Feel of the editor (vibe mode) and the visual check at 360 px, done with the Chrome DevTools MCP server and recorded in the journey.
