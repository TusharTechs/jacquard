# Implementation Plan: simulate-and-export

## Overview

Build `@jacquard/export` (cloth model, WIF writer and reader, card sheets in SVG and PDF, point-paper sheet) and the web simulator and export panels, following `requirements.md` and `design.md`.

All 11 correctness properties have their own property test task. Every property test task is required. There are no optional tasks.

## Task rules

- **Finish.** `pnpm typecheck; echo "EXIT_CODE=$?"` and `pnpm test; echo "EXIT_CODE=$?"` both `EXIT_CODE=0`, every vitest summary line with a non-zero passed count and no failures.
- **Property tests.** fast-check with `{ seed, numRuns: 100 }` constants, `verbose: 1`, tag `Feature: simulate-and-export, Property N: <title>`, files ending `.property.test.ts`.
- **Failures.** Report every property failure in full (property, shrunk counterexample verbatim, seed, requirement) before fixing it. Never weaken a test.
- **Boundaries.** `@jacquard/export` depends at runtime only on `@jacquard/engine`. The engine is not changed. No file under `packages/engine/test/fixtures` is touched.
- **No journal, no git inside tasks.**

## Tasks

- [x] 1. Scaffold `packages/export` (package shape as the engine, `@jacquard/engine` workspace dependency, exact dev pins) with a package smoke test; add `@jacquard/export` to `apps/web` dependencies; update `.kiro/steering/structure.md`
  - _Requirements: 7.1, 7.3_

- [x] 2. Export package
  - [x] 2.1 `types.ts`, `text.ts`, `cloth.ts`
    - _Requirements: 1.1 to 1.5_
  - [x] 2.2 `wif.ts` (`writeWif`, `readWif`, private `[JACQUARD]` section)
    - _Requirements: 3.1 to 3.7_
  - [x] 2.3 `card-sheet.ts` (`cardSheetLayout`, `cardSheetSvg`) and `pdf.ts` (`PdfWriter`, `cardSheetPdf`)
    - _Requirements: 4.1 to 4.8_
  - [x] 2.4 `point-paper.ts` and `index.ts`
    - _Requirements: 5.1 to 5.3_

- [ ] 3. Export properties and examples
  - [ ] 3.1 Write property test: **Property 1: Cloth model matches the lift plan** — **Validates: Requirements 1.1, 1.2, 1.3, 1.5**
  - [ ] 3.2 Write property test: **Property 2: Cloth model rejects bad yarns** — **Validates: Requirements 1.4**
  - [ ] 3.3 Write property test: **Property 3: WIF round trip** — **Validates: Requirements 3.5, 3.2**
  - [ ] 3.4 Write property test: **Property 4: WIF structure** — **Validates: Requirements 3.1 to 3.4**
  - [ ] 3.5 Write property test: **Property 5: WIF reader rejects broken files** — **Validates: Requirements 3.6**
  - [ ] 3.6 Write property test: **Property 6: Card count, order and positions** — **Validates: Requirements 4.1 to 4.4**
  - [ ] 3.7 Write property test: **Property 7: Card SVG content** — **Validates: Requirements 4.1, 4.4, 4.5**
  - [ ] 3.8 Write property test: **Property 8: PDF structure** — **Validates: Requirements 4.6, 4.5, 4.1**
  - [ ] 3.9 Write property test: **Property 9: Point-paper sheet** — **Validates: Requirements 5.1 to 5.3**
  - [ ] 3.10 Write property test: **Property 10: Determinism and purity** — **Validates: Requirements 1.5, 3.4, 4.7, 5.3**
  - [ ] 3.11 Write property test: **Property 11: Engine errors pass through** — **Validates: Requirements 4.8**
  - [ ] 3.12 Example tests (expected 2-pick WIF, one-card PDF, `PROFILE_400` card with 416 positions in 52 rows of 8) and the source scan
    - _Requirements: 3.1, 4.3, 4.6, 7.1_

- [ ] 4. Web
  - [ ] 4.1 `simulator-panel.tsx`, `lib/draw-cloth.ts`, yarn colour state
    - _Requirements: 2.1 to 2.5_
  - [ ] 4.2 `export-panel.tsx`, `lib/download.ts`, wiring in `app.tsx`
    - _Requirements: 6.1 to 6.5_
  - [ ] 4.3 Component tests for both panels
    - _Requirements: 2.4, 2.5, 6.2 to 6.5_

- [ ] 5. Checkpoint and visual check: `pnpm typecheck`, `pnpm test`; run the app, view the simulator at 360 px and 1280 px through the Chrome DevTools MCP server, export each file and check the downloads; stop the servers and confirm no process listens on 5173 or 8787
  - _Requirements: 2.5, 6.1_

## Notes

- Property-to-task mapping: P1 3.1, P2 3.2, P3 3.3, P4 3.4, P5 3.5, P6 3.6, P7 3.7, P8 3.8, P9 3.9, P10 3.10, P11 3.11.
- Opening the WIF in an independent weaving tool is a manual step for the user.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2.1", "2.2", "2.3", "2.4"] },
    { "id": 2, "tasks": ["3.1", "3.2", "3.3", "3.4", "3.5", "3.6", "3.7", "3.8", "3.9", "3.10", "3.11", "3.12"] },
    { "id": 3, "tasks": ["4.1", "4.2", "4.3"] },
    { "id": 4, "tasks": ["5"] }
  ]
}
```
