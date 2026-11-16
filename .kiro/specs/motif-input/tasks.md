# Implementation Plan: motif-input

## Overview

Build `@jacquard/motif`, the motif proxy in `backend`, and the first version of `apps/web` (loom setup, motif input, point-paper editor, float panel), following `requirements.md` and `design.md`. The order is: scaffolding, the pure motif package and its properties, then the backend and the editor state, then the UI, then component tests, a checkpoint and a visual check.

All 14 correctness properties have their own property test task. Every property test task is required. There are no optional tasks.

## Task rules

- **Finish.** Run `pnpm typecheck; echo "EXIT_CODE=$?"` and `pnpm test; echo "EXIT_CODE=$?"`. A task is complete only if both show `EXIT_CODE=0` and every vitest summary line shows a non-zero passed count and no failures.
- **Property tests.** fast-check with `{ seed, numRuns: 100 }` from constants at the top of the file, `verbose: 1`, tag `Feature: motif-input, Property N: <title>`, file names ending `.property.test.ts`.
- **Failures.** A property failure is reported in full (property number and title, shrunk counterexample verbatim, seed, requirement) before it is fixed. Never weaken, skip or delete a test to make it pass.
- **Boundaries.** `@jacquard/motif` has no runtime dependencies and no DOM, Node or network use. No weaving logic in `apps/web` or `backend`. No file under `packages/engine/test/fixtures` is touched. No AWS resource is created, changed or deleted, and no test calls AWS.
- **No journal, no git inside tasks.** The main session writes one journal entry per wave, then commits and pushes.

## Tasks

- [x] 1. Scaffolding
  - [x] 1.1 Create `packages/motif`, `backend` and `apps/web` package skeletons with exact pins (design, Packages), add `backend` to `pnpm-workspace.yaml`, install, and add a package smoke test to each (pins, scripts, no runtime dependencies in motif, engine `dependencies` still empty)
    - _Requirements: 13.1, 13.2, 13.3, 13.5_
  - [x] 1.2 Update `.kiro/steering/structure.md` to list `packages/motif` and `@jacquard/motif`
    - _Requirements: 13.1_

- [x] 2. Motif package
  - [x] 2.1 Implement `parse-motif.ts` (tokenizer, allow lists, fills, transforms, shapes to polygons, palette rule, size limits; never throws)
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8_
  - [x] 2.2 Implement `rasterize.ts`, `symmetry.ts`, `specks.ts`
    - _Requirements: 5.1 to 5.5, 6.1 to 6.6, 7.1 to 7.5_
  - [x] 2.3 Implement `motif-to-design.ts`, `request.ts` (`validateMotifRequest`, request and response types) and `stand-in.ts`; export everything from `src/index.ts`
    - _Requirements: 1.1, 1.3, 7.6, 8.1 to 8.4_

- [ ] 3. Motif properties and examples
  - [ ] 3.1 Write property test: **Property 1: parseMotif is total and deterministic** — **Validates: Requirements 4.8**
  - [ ] 3.2 Write property test: **Property 2: Forbidden constructs are rejected** — **Validates: Requirements 4.1, 4.2, 4.3**
  - [ ] 3.3 Write property test: **Property 3: Parse matches the drawn shapes** — **Validates: Requirements 4.5, 4.6, 4.7**
  - [ ] 3.4 Write property test: **Property 4: Size limits** — **Validates: Requirements 4.4**
  - [ ] 3.5 Write property test: **Property 5: Raster shape and range** — **Validates: Requirements 5.1, 5.5**
  - [ ] 3.6 Write property test: **Property 6: Raster matches an independent oracle** — **Validates: Requirements 5.2, 5.3, 5.4**
  - [ ] 3.7 Write property test: **Property 7: Speck removal postconditions** — **Validates: Requirements 6.1, 6.2, 6.4, 6.5, 6.6**
  - [ ] 3.8 Write property test: **Property 8: Speck merge choice** — **Validates: Requirements 6.3**
  - [ ] 3.9 Write property test: **Property 9: Symmetry** — **Validates: Requirements 7.1 to 7.5**
  - [ ] 3.10 Write property test: **Property 10: Pipeline output** — **Validates: Requirements 5.1, 7.6, 10.5, 11.1** (uses `@jacquard/engine` as a dev dependency of the motif tests only)
  - [ ] 3.11 Write property test: **Property 11: Stand_In** — **Validates: Requirements 8.1 to 8.4**
  - [ ] 3.12 Write property test: **Property 12: Request validation** — **Validates: Requirements 1.1, 1.3**
  - [ ] 3.13 Write example tests (hand-drawn motif with known cells, each forbidden construct by name, a 400-end repeat) and the source scan (no DOM, Node or network globals in `src`)
    - _Requirements: 4.3, 5.2, 13.1_

- [ ] 4. Backend
  - [ ] 4.1 Implement `core.ts` (`handleMotifRequest`, `Generator`, `GeneratorUnavailable`), `prompt.ts`, `bedrock-generator.ts`, `handler.ts`, `dev-server.ts`, and the esbuild bundle script
    - _Requirements: 1.1 to 1.5, 2.2, 2.3, 3.1 to 3.5, 13.4_
  - [ ] 4.2 Write property test: **Property 13: Backend outcomes** — **Validates: Requirements 1.2, 1.3, 1.4, 1.5, 2.3, 3.1 to 3.5, 13.4**
  - [ ] 4.3 Write example tests for the Lambda adapter and for the Bedrock generator with a fake client (SVG extraction, error mapping)
    - _Requirements: 2.2, 3.4_

- [ ] 5. Web state and libraries
  - [ ] 5.1 Implement `state/editor-state.ts`, `state/setup-state.ts`, `lib/default-weaves.ts`, `lib/palette.ts`, `lib/engine-check.ts`, `lib/motif-client.ts`
    - _Requirements: 3.6, 3.7, 9.2, 9.3, 9.7, 9.8, 10.1, 10.3, 10.5, 10.6_
  - [ ] 5.2 Write property test: **Property 14: Editor state** — **Validates: Requirements 9.2, 9.3, 9.7, 9.8**

- [ ] 6. Web UI
  - [ ] 6.1 Shared components (Button, Field, Panel, Dialog, Toast, Tabs) and `styles.css` per `design-language.md`
    - _Requirements: 12.1_
  - [ ] 6.2 `loom-setup-panel.tsx`, `motif-panel.tsx`, `weave-panel.tsx`, `float-panel.tsx`, `region-legend.tsx`, `term.tsx`, `app.tsx`
    - _Requirements: 3.6, 3.7, 8.5, 10.1 to 10.5, 11.1 to 11.3, 12.1 to 12.4_
  - [ ] 6.3 `point-paper.tsx` and `editor-toolbar.tsx` (vibe mode for the interaction feel: drag painting, zoom, pinch, cursor)
    - _Requirements: 9.1 to 9.6, 10.2, 10.4_

- [ ] 7. Web tests
  - [ ] 7.1 Component tests: motif panel states, float panel states, loom-setup untested-format note, stand-in label
    - _Requirements: 3.6, 3.7, 8.5, 10.3, 11.3, 12.1, 12.2_
  - [ ] 7.2 Scans: no model endpoint in `apps/web/src`; no credentials in the built `dist`; imports only through package names; repository contains no AWS key pattern
    - _Requirements: 2.1, 2.4, 13.3_

- [ ] 8. Checkpoint and visual check
  - Run `pnpm typecheck` and `pnpm test`; start the backend dev server and Vite, load the app with the Chrome DevTools MCP server at 360 px and 1280 px widths, request a stand-in motif, paint, undo, run auto-fix, and record what was seen in the journey. Stop both servers afterwards.
  - _Requirements: 9.4, 12.1, 12.4_

## Notes

- Property-to-task mapping: P1 3.1, P2 3.2, P3 3.3, P4 3.4, P5 3.5, P6 3.6, P7 3.7, P8 3.8, P9 3.9, P10 3.10, P11 3.11, P12 3.12, P13 4.2, P14 5.2.
- Bedrock is never called in this phase. `MOTIF_GENERATOR=bedrock` is only exercised with a fake client.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["2.1", "2.2", "2.3"] },
    { "id": 2, "tasks": ["3.1", "3.2", "3.3", "3.4", "3.5", "3.6", "3.7", "3.8", "3.9", "3.10", "3.11", "3.12", "3.13"] },
    { "id": 3, "tasks": ["4.1", "4.2", "4.3", "5.1", "5.2"] },
    { "id": 4, "tasks": ["6.1", "6.2", "6.3"] },
    { "id": 5, "tasks": ["7.1", "7.2"] },
    { "id": 6, "tasks": ["8"] }
  ]
}
```
