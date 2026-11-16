# Implementation Plan: weave-engine

## Overview

Build `@jacquard/engine` in `packages/engine` as pure TypeScript with no runtime dependencies, following `requirements.md` and `design.md`. Work goes bottom-up: workspace, types, generators, profiles and weaves, validation, lift plan, cards, float checker, auto-fix, then the public API and determinism checks.

Every acceptance criterion (45 in total) is covered by at least one correctness property or named example test; the coverage table is in Notes. All 34 property-based test tasks are required. None is optional.

## Tasks

- [x] 1. Set up the pnpm workspace and engine package
  - [x] 1.1 Create workspace root files
    - `package.json` (private, `packageManager` pnpm, scripts `test` and `typecheck` that run across packages), `pnpm-workspace.yaml` (`packages/*`, `apps/*`), `tsconfig.base.json` (strict, ES2022, module NodeNext)
    - No `package-lock.json` or `yarn.lock`
    - _Requirements: 6.2_
  - [x] 1.2 Create the engine package skeleton
    - `packages/engine/package.json`: name `@jacquard/engine`, `type: module`, `sideEffects: false`, no `dependencies` field; dev dependencies `typescript`, `vitest`, `fast-check`
    - `tsconfig.json` for `src` with `"types": []`; `tsconfig.test.json` for `src` and `test`; `vitest.config.ts`
    - Empty `src/index.ts`, `test/fixtures/`
    - _Requirements: 6.2_

- [x] 2. Core types, results and errors
  - [x] 2.1 Implement `src/types.ts` and `src/result.ts`
    - All types in design Data Models; `Result<T, E>` (no default for `E`), `ok()`, `err()`
    - _Requirements: 1.1, 1.2, 1.6_
  - [x] 2.2 Implement `src/errors.ts`
    - `EngineError` union and `PlanProblem` from design Error Handling, one constructor per code, `message` built only from the fields
    - `EngineResult<T> = Result<T, EngineError>`, returned by every public function
    - _Requirements: 3.8_

- [x] 3. Test generators
  - [x] 3.1 Implement `test/arbitraries.ts`
    - Profiles, designs (including repeat-ready widths), weaves, lift plans biased toward long runs, and the nine fault injectors, as in design Testing Strategy, Generators
    - _Requirements: 1.2, 1.6, 3.7_

- [x] 4. Loom profiles
  - [x] 4.1 Implement `src/profiles.ts`
    - `PROFILE_120`, `PROFILE_240`, `PROFILE_400` (frozen), `defineProfile()`, `validateProfile()` in 1.2 field order
    - Every default has a bracketed label comment; `[sourced]` defaults quote S1; `[to verify]` defaults say `// [to verify]`
    - `defineProfile` starts from the built-in profile's defaults when `hookCount` is 120, 240 or 400, so a custom 400-hook profile gets the sourced 16 spare hooks unless the caller overrides them; other hook counts keep the fallback defaults (`hooksPerCardRow` 8, `spareHookCount` 0, and so on)
    - _Requirements: 1.2, 1.3, 1.4, 1.5_
  - [x] 4.2 Example test: built-in profile defaults
    - The three built-ins have exactly the defaults in 1.2; `PROFILE_400` has 400 + 16 = 416 positions
    - Reads `src/profiles.ts` and checks each default line has a bracketed label comment (`// [sourced]`, `// [convention]`, `// [decision]` or `// [to verify]`) and each `[sourced]` line quotes S1
    - `defineProfile` inherits from a built-in: `hookCount` 400 gives the sourced 16 spare hooks unless overridden, 120 and 240 give their built-in defaults, and other hook counts get the fallback defaults
    - Remove passWithNoTests from vitest.config.ts.
    - _Requirements: 1.3_
  - [x] 4.3 Example test: invalid profile fields
    - One case per field in 1.5, each expecting `PROFILE_INVALID` with that field and value
    - _Requirements: 1.5_

- [x] 5. Weaves
  - [x] 5.1 Implement `src/weaves.ts`
    - `evaluateWeave`, `weavePeriod`, `validateWeave`; satin moves as the table `{ 5: [2, 3], 8: [3, 5] }`
    - _Requirements: 1.6, 1.7, 2.3_
  - [x] 5.2 Write property test for weave periodicity
    - **Property 1: Weave periodicity**
    - **Validates: Requirements 2.3, 2.12**
  - [x] 5.3 Write property test for plain weave
    - **Property 2: Plain weave alternates**
    - **Validates: Requirements 2.3**
  - [x] 5.4 Write property test for twill
    - **Property 3: Twill ratio and slope**
    - **Validates: Requirements 1.6, 2.3**
  - [x] 5.5 Write property test for satin binding cells
    - **Property 4: Satin has one binding cell per line in every window**
    - **Validates: Requirements 1.6, 2.3**
  - [x] 5.6 Write property test for satin moves
    - **Property 5: Satin is never a twill**
    - **Validates: Requirements 1.6, 1.7**
  - [x] 5.7 Write property test for satin facings
    - **Property 6: Satin facings are complements**
    - **Validates: Requirements 2.3**

- [x] 6. Input validation
  - [x] 6.1 Implement `src/validate.ts`
    - `validateInput` with the nine steps in design Error Handling, Validation order; reads the caller's arrays without copying
    - _Requirements: 1.5, 1.7, 2.6, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_
  - [x] 6.2 Write property test for validation order
    - **Property 16: First error follows the validation order**
    - **Validates: Requirements 3.7**
  - [x] 6.3 Write property test for error fields
    - **Property 17: Errors carry their named fields**
    - **Validates: Requirements 1.5, 1.7, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.8**

- [x] 7. Lift plan builder
  - [x] 7.1 Implement `buildLiftPlan` in `src/lift-plan.ts`
    - Runs `validateInput`, evaluates each cell from its own region's weave anchored at the origin, sets idle hooks unlifted and lists them, tiles with `repeatAcross`
    - Add the design-based lift-plan generator to test/arbitraries.ts, as Design specifies, and remove the note at the top of that file.
    - _Requirements: 2.1, 2.2, 2.4, 2.5, 2.6_
  - [x] 7.2 Implement seam warnings
    - `WEAVE_PERIOD_SEAM` per used region, ordered by region then picks before ends; never blocks output
    - _Requirements: 2.12_
  - [x] 7.3 Implement `validatePlan`
    - Checks in the order given in design Error Handling, Plan validation order; returns `PLAN_INVALID` with `problem`, `pick`, `hook`
    - _Requirements: 2.13_
  - [x] 7.4 Example test: design grid orientation
    - A 3-pick by 2-end design with distinct regions and contrasting weaves; `design[pick][end]` maps to `lifts[pick][hook]`, not the transpose
    - _Requirements: 1.1_
  - [x] 7.5 Write property test for region weaves
    - **Property 7: Lift plan follows region weaves**
    - **Validates: Requirements 2.1, 2.2**
  - [x] 7.6 Write property test for idle hooks
    - **Property 8: Idle hooks never lift**
    - **Validates: Requirements 2.4**
  - [x] 7.7 Write property test for repeat across
    - **Property 9: Repeat across tiles the design**
    - **Validates: Requirements 2.5, 2.6**
  - [x] 7.8 Write property test for seam warnings
    - **Property 10: Seam warnings are exact and non-blocking**
    - **Validates: Requirements 2.12**
  - [x] 7.9 Write property test for plan validation
    - **Property 11: Plan validation accepts built plans and rejects corruptions**
    - **Validates: Requirements 2.13**

- [x] 8. Checkpoint: run the engine tests once and confirm everything so far passes; ask the user if questions arise

- [x] 9. Cards
  - [x] 9.1 Implement `buildCards`, `cardRows` and `nextCard` in `src/cards.ts`
    - Positions `hookCount + spareHookCount`, spare positions after the figuring hooks, punching by `holeMeans`, numbers from 1, chain successor by `nextCard`
    - _Requirements: 2.7, 2.8, 2.9_
  - [x] 9.2 Implement `decodeCards`
    - Checks and error order from design Cards, Decoding, including `CARD_SPARE_LIFTED` and `CARD_IDLE_LIFTED`; orders by card number only; runs `validatePlan` on the result
    - _Requirements: 2.10, 2.11, 2.13_
  - [x] 9.3 Example test: 400-hook card layout
    - `PROFILE_400` cards have 416 positions in 52 rows of 8 with no `null` slots; positions 400 to 415 are never punched under `holeMeans: "lift"`
    - _Requirements: 1.3, 2.8_
  - [x] 9.4 Write property test for card count and layout
    - **Property 12: Card count, numbering and layout**
    - **Validates: Requirements 2.7, 2.8, 2.9**
  - [x] 9.5 Write property test for punching
    - **Property 13: Punching follows holeMeans**
    - **Validates: Requirements 2.7**
  - [x] 9.6 Write property test for the card round trip
    - **Property 14: Card round trip**
    - **Validates: Requirements 2.10**
  - [x] 9.7 Write property test for bad card sets
    - **Property 15: Bad card sets are rejected**
    - **Validates: Requirements 2.11, 2.13**

- [x] 10. Float checker
  - [x] 10.1 Implement `src/runs.ts`
    - Constant, linear and ring run extraction; a ring run starts where its ring predecessor differs
    - _Requirements: 4.2, 4.4_
  - [x] 10.2 Implement `checkFloats` in `src/floats.ts`
    - Analysed unit only, side labels with `wovenFaceDown`, separate warp and weft limits, unbound lines, 4.6 ordering as confirmed in the design
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_
  - [x] 10.3 Implement the naive oracle in `test/oracle.ts`
    - Tiles the unit 3 times (along picks, and along ends with repeat on) and scans linearly; imports only types from `src`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_
  - [x] 10.4 Write property test against the oracle
    - **Property 18: Float checker agrees with a naive oracle**
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5**
  - [x] 10.5 Write property test for ring invariance along the picks
    - **Property 19: Ring invariance along the picks**
    - **Validates: Requirements 4.2, 4.3**
  - [x] 10.6 Write property test for ring invariance across the ends
    - **Property 20: Ring invariance across the ends**
    - **Validates: Requirements 4.2**
  - [x] 10.7 Write property test for the complement
    - **Property 21: Complement swaps face and back**
    - **Validates: Requirements 4.1**
  - [x] 10.8 Write property test for wovenFaceDown
    - **Property 22: wovenFaceDown swaps face and back**
    - **Validates: Requirements 1.2, 4.1**
  - [x] 10.9 Write property test for violation shape and order
    - **Property 23: Violations are over the limit, exclusive and sorted**
    - **Validates: Requirements 4.3, 4.4, 4.6**

- [x] 11. Auto-fix
  - [x] 11.1 Implement badness and incremental run tables in `src/auto-fix.ts`
    - Badness `B` as in design Auto-fix, Badness; recompute only the two lines through a flipped cell
    - _Requirements: 5.1_
  - [x] 11.2 Implement safe-flip detection and cell ranking
    - Safe-flip rule; ranking by the single lattice `(p − s·e) mod n = 0`, then smallest remaining piece, then ring offset
    - _Requirements: 5.4, 5.7_
  - [x] 11.3 Implement the auto-fix loop
    - Clean plans return unchanged; safe phase, then fallback on lowest negative ΔB; `stuck` and `iterationLimit` failures return `AUTOFIX_FAILED` with `remaining` and no plan; expand the unit to every tile with `repeatAcross`; idle hooks never touched
    - _Requirements: 5.1, 5.2, 5.3, 5.5, 5.6, 5.8_
  - [x] 11.4 Example test: satin-lattice placement
    - Solid 24 × 24 region, limits 8, run all lifted and all unlifted; every flip satisfies `(p − 2e) mod 9 = 0`; no three flips on consecutive ends at consecutive picks
    - _Requirements: 5.7_
  - [x] 11.5 Example test: golden fixtures
    - Create a few small gallery-like designs in `test/fixtures/` that auto-fix must fix; fixtures are read-only once committed
    - _Requirements: 5.1_
  - [x] 11.6 Write property test for auto-fix success
    - **Property 24: Auto-fix success leaves no violations**
    - **Validates: Requirements 5.1**
  - [x] 11.7 Write property test for clean plans
    - **Property 25: Clean plans are returned unchanged**
    - **Validates: Requirements 5.2**
  - [x] 11.8 Write property test for idempotence
    - **Property 26: Auto-fix is idempotent**
    - **Validates: Requirements 5.3**
  - [x] 11.9 Write property test for flip locations
    - **Property 27: Every flip lies in a current violation**
    - **Validates: Requirements 5.4**
  - [x] 11.10 Write property test for changed cells
    - **Property 28: Only flipped lift cells change**
    - **Validates: Requirements 5.5, 6.3**
  - [x] 11.11 Write property test for periodic output
    - **Property 29: Auto-fix keeps repeat-across plans periodic**
    - **Validates: Requirements 5.6**
  - [x] 11.12 Write property test for the failure rule
    - **Property 30: Never partly fixed**
    - **Validates: Requirements 5.8**
  - [x] 11.13 Write property test for badness
    - **Property 33: Badness strictly decreases with every flip**
    - **Validates: Requirements 5.1, 5.8**

- [x] 12. Public API and determinism
  - [x] 12.1 Export the public API from `src/index.ts`
    - Types, built-in profiles, `defineProfile`, `validateProfile`, `evaluateWeave`, `weavePeriod`, `buildLiftPlan`, `validatePlan`, `buildCards`, `decodeCards`, `cardRows`, `nextCard`, `checkFloats`, `autoFix`
    - _Requirements: 1.4, 6.1_
  - [x] 12.2 Example test: no forbidden globals or runtime dependencies
    - Scans `src/` for `Date`, `Math.random`, `Intl`, `toLocale`, `process`, `globalThis`, `fetch`; checks `package.json` has no `dependencies`
    - _Requirements: 6.2_
  - [x] 12.3 Write property test for determinism
    - **Property 31: Identical input gives identical output**
    - **Validates: Requirements 6.1**
  - [x] 12.4 Write property test for input immutability
    - **Property 32: Inputs are never modified**
    - **Validates: Requirements 6.3**
  - [x] 12.5 Write property test for custom profiles
    - **Property 34: A custom profile is used in place of a built-in**
    - **Validates: Requirements 1.4**

- [x] 13. Final checkpoint: run the full engine test suite and typecheck once; record results and any shrunk counterexamples in `KIRO_JOURNEY.md`; ask the user if questions arise

## Notes

- Every property test task is required. Each runs at least 200 fast-check cases with a random seed, and the seed is logged on failure.
- Never weaken, skip or delete a test to make it pass. If a property fails, fix the engine, then copy the shrunk counterexample, the seed and the property's requirement into `KIRO_JOURNEY.md`.
- Run tests once, never in watch mode, for example `pnpm --filter @jacquard/engine exec vitest --run`. Per `tech.md`, append `; echo "EXIT_CODE=$?"` and read both that value and the vitest summary line before reporting a result.
- `[sourced]` and `[to verify]` loom facts stay profile fields with labelled defaults; never hard-code them.
- Golden fixtures under `test/fixtures/` are read-only once committed.

Coverage of the 45 acceptance criteria (P = property, T = example-test task):

| Requirement | Coverage |
|---|---|
| 1 | 1.1 T7.4 · 1.2 P22 · 1.3 T4.2, T9.3 · 1.4 P34 · 1.5 P17, T4.3 · 1.6 P3, P4, P5 · 1.7 P5, P17 |
| 2 | 2.1 P7 · 2.2 P7 · 2.3 P1–P6 · 2.4 P8 · 2.5 P9 · 2.6 P9 · 2.7 P12, P13 · 2.8 P12, T9.3 · 2.9 P12 · 2.10 P14 · 2.11 P15 · 2.12 P1, P10 · 2.13 P11, P15 |
| 3 | 3.1 P17 · 3.2 P17 · 3.3 P17 · 3.4 P17 · 3.5 P17 · 3.6 P17 · 3.7 P16 · 3.8 P17 |
| 4 | 4.1 P18, P21, P22 · 4.2 P18, P19, P20 · 4.3 P18, P19, P23 · 4.4 P18, P23 · 4.5 P18 · 4.6 P23 |
| 5 | 5.1 P24, P33, T11.5 · 5.2 P25 · 5.3 P26 · 5.4 P27 · 5.5 P28 · 5.6 P29 · 5.7 T11.4 · 5.8 P30, P33 |
| 6 | 6.1 P31 · 6.2 T12.2 · 6.3 P28, P32 |

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["2.1"] },
    { "id": 2, "tasks": ["2.2", "3.1"] },
    { "id": 3, "tasks": ["4.1", "5.1", "10.1", "10.3"] },
    { "id": 4, "tasks": ["4.2", "4.3", "5.2", "5.3", "5.4", "5.5", "5.6", "5.7", "6.1"] },
    { "id": 5, "tasks": ["6.2", "6.3", "7.1"] },
    { "id": 6, "tasks": ["7.2", "7.3", "7.4"] },
    { "id": 7, "tasks": ["7.5", "7.6", "7.7", "7.8", "7.9"] },
    { "id": 8, "tasks": ["8"] },
    { "id": 9, "tasks": ["9.1", "10.2"] },
    { "id": 10, "tasks": ["9.2", "9.3", "10.4", "10.5", "10.6", "10.7", "10.8", "10.9", "11.1"] },
    { "id": 11, "tasks": ["9.4", "9.5", "9.6", "9.7", "11.2"] },
    { "id": 12, "tasks": ["11.3"] },
    { "id": 13, "tasks": ["11.4", "11.5", "11.6", "11.7", "11.8", "11.9", "11.10", "11.11", "11.12", "11.13", "12.1"] },
    { "id": 14, "tasks": ["12.2", "12.3", "12.4", "12.5"] },
    { "id": 15, "tasks": ["13"] }
  ]
}
```
