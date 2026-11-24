# Implementation Plan: motif-builder

All 4 correctness properties have their own property test task. Every property test task is required.

## Tasks

- [x] 1. Describer and Builder in `@jacquard/motif`
  - [x] 1.1 `src/describe.ts`: tokens, tables, counts, colours, symmetry, overrides, notes; export from `index.ts`
    - _Requirements: 1.1 to 1.7_
  - [x] 1.2 `src/builder-shapes.ts` and `src/motif-builder.ts`: figures, pattern subjects, layouts, Kept_Part placement, role colours
    - _Requirements: 2.1 to 2.5_
  - [x] 1.3 Write property test: **Property 1: Describer totality and determinism** — **Validates: Requirements 1.3, 1.4, 1.6, 1.7**
  - [x] 1.4 Write property test: **Property 2: Builder output** — **Validates: Requirements 2.1, 2.2, 2.3, 2.6**
  - [x] 1.5 Write property test: **Property 3: Every builder motif weaves within the float limit after auto-fix** — **Validates: Requirements 2.7**
  - [x] 1.6 Example tests: lotus (2.8), the six verification descriptions, fallback, mirrored elephant
    - _Requirements: 1.3, 1.5, 2.5, 2.8_
- [x] 2. Web app
  - [x] 2.1 `lib/motif-builder.ts`, `lib/use-motif-builder.ts`, `place` in `use-motif-request.ts`, `components/motif-chips.tsx`, panel wiring and copy, `applyMotif` setup and Undo
    - _Requirements: 3.1 to 3.6, 4.1 to 4.3_
  - [x] 2.2 `lib/saved-design.ts` and `persist` in `App` and `main.tsx`
    - _Requirements: 5.1 to 5.5, 5.7_
  - [x] 2.3 Write property test: **Property 4: Saved design round trip** — **Validates: Requirements 5.3, 5.4, 5.6**
  - [x] 2.4 Component tests: chips, labels, no "model" in the static panel, builder placement and Undo, persistence in `App`
    - _Requirements: 3.2 to 3.5, 4.1, 5.1, 5.5_
- [ ] 3. Headers, deploy and record
  - [ ] 3.1 CSP check against the built app with the header served locally; `scripts/amplify-custom-headers.yml`; `deploy-web.sh` applies it
    - _Requirements: 6.1 to 6.4_
  - [ ] 3.2 Redeploy; six descriptions at 1440x900 and 390x844 on the Live_URL; console; `curl -I`; Lighthouse; `media/motif-builder/`
    - _Requirements: 7.1 to 7.5_
  - [ ] 3.3 `product.md`, `README.md`, `docs/kiro-writeup-draft.md`; journal with "Surprise"; tally; status
    - _Requirements: 8.1, 8.2_

## Task Dependency Graph

```json
{ "waves": [ { "id": 0, "tasks": ["1.1", "1.2", "1.3", "1.4", "1.5", "1.6"] }, { "id": 1, "tasks": ["2.1", "2.2", "2.3", "2.4"] }, { "id": 2, "tasks": ["3.1", "3.2", "3.3"] } ] }
```
