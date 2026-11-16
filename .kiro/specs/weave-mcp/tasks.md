# Implementation Plan: weave-mcp

## Overview

Build `@jacquard/mcp` in `packages/mcp`: a stdio MCP server with six read-only tools over `@jacquard/engine`, following `requirements.md` and `design.md`. Work goes in dependency order: package setup, `canonicalJson`, Label_Table, result envelope, argument checking, profile resolution, tool handlers, tool definitions and `createServer`, stdio entry and bundle, then tests and properties, a checkpoint, and last the configuration task (registration and two read-only agents).

All 16 correctness properties have their own property test task. Every property test task is required. There are no optional tasks.

## Task rules

These rules apply to every task and sub-task below. Each task says "Finish per Task rules" instead of repeating them.

- **Finish.** Run `pnpm typecheck; echo "EXIT_CODE=$?"` and `pnpm test; echo "EXIT_CODE=$?"`. A task is complete only if both show `EXIT_CODE=0` and the vitest summary line shows a non-zero passed count and no failures. Never report success on the exit code alone.
- **Errors in files the task did not touch.** Fix them, or stop and report them to the user. Never leave them behind.
- **Tests.** Run once with `pnpm vitest --run` (or through `pnpm test`), never in watch mode. Use `pnpm` only; never create `package-lock.json` or `yarn.lock`.
- **Server tests go through a real connection.** Create the server with `createServer(engine)`, connect an SDK `Client` over `InMemoryTransport.createLinkedPair()` (through `test/harness.ts`), and call `client.listTools()` and `client.callTool()`. Never call a handler, `checkArguments`, `resolveProfile` or `callTool` directly. The only plain-function tests are `canonicalJson` (Properties 4 and 5) and `LABEL_TABLE` (Property 3). The one process-level test spawns the built entry `node packages/mcp/dist/index.js` by relative path.
- **Property tests.** Use fast-check with `{ seed, numRuns }` set from constants at the top of the file (`numRuns` 100, and 300 for Property 7). Tag each with `Feature: weave-mcp, Property N: <title>`. Property test files end in `.property.test.ts`, other test files in `.test.ts`, all in `packages/mcp/test/`, kebab-case.
- **Property test failures are reported in full** in the task's reply: property number and title, the shrunk counterexample copied verbatim, the seed, and the requirement it traces to. Include failures that are fixed later in the same task. Never weaken, skip or delete a test to make it pass; fix the code.
- **No journal, no git.** Tasks do not write to `KIRO_JOURNEY.md` and do not commit or push. The main session writes one journal entry per wave, then commits and pushes.
- **Boundaries.** No weaving logic in `packages/mcp`. Import the engine only as `@jacquard/engine` (never `@jacquard/engine/` or `engine/src`). Do not touch anything under `packages/engine/test/fixtures`. Do not add `zod` as a dependency.

## Tasks

- [x] 1. Set up the `packages/mcp` package
  - [x] 1.1 Create the package skeleton
    - `packages/mcp/package.json`: name `@jacquard/mcp`, `private`, `type: module`; `dependencies`: `@jacquard/engine` as `workspace:*` and `@modelcontextprotocol/sdk` as exactly `1.32.2`; `devDependencies`: `esbuild` exactly `0.28.2`, and `fast-check`, `typescript`, `vitest`, `@types/node` at the exact resolved versions that `packages/engine` already uses (read them from the installed engine packages or `pnpm-lock.yaml`; write them without `^` or `~`)
    - Scripts: `build` (`node build.mjs`), `pretest` (`pnpm run build`), `test` (`vitest --run`), `typecheck` (`tsc -p tsconfig.json && tsc -p tsconfig.test.json`)
    - `tsconfig.json` (src only, strict, ES2022, `types: ["node"]`, same strict options as the engine), `tsconfig.test.json` (src and test), `vitest.config.ts`, a placeholder `src/index.ts` (`export {}`), and `build.mjs` using esbuild as in design Build and entry point
    - Make sure `dist/` is git-ignored without touching `.kiro` entries in `.gitignore`
    - Do not add `zod`
    - _Requirements: 13.1, 13.4, 13.5, 13.8, 14.9_
  - [x] 1.2 Install, verify the pins and add the dependency smoke test
    - Run `pnpm install; echo "EXIT_CODE=$?"` in the real workspace and read the whole output. If it reports a missing or unmet `zod` peer, STOP and report it to the user. Do not add `zod`
    - Confirm the lockfile resolves `@modelcontextprotocol/sdk` to `1.32.2`, `pnpm-lock.yaml` is the only lockfile, and no `^` or `~` appears in the `dependencies` of `packages/mcp/package.json`
    - Create `test/package.test.ts` checking: `@jacquard/engine` is `workspace:*`; every other `dependencies` entry is an exact version (digits and dots only) and the SDK is `1.32.2`; `zod` is not under `dependencies`; no file in `src` or `test` imports `zod`; the lockfile records `1.32.2`; `typecheck`, `test` and `pretest` scripts exist; `packages/engine/package.json` has no `dependencies` and no `@jacquard/mcp` entry; `git diff --stat` is not used here (13.6 is checked by the final task report)
    - _Requirements: 13.1, 13.2, 13.4, 13.5, 13.8, 14.9_

- [x] 2. Canonical JSON
  - [x] 2.1 Implement `src/canonical-json.ts`
    - `canonicalJson(value: unknown): string` as in design Canonical_JSON: keys sorted by UTF-16 code unit from `Object.keys`, `undefined` members skipped, no whitespace, numbers and strings through `JSON.stringify`
    - _Requirements: 11.4, 11.5, 11.7_
  - [x] 2.2 Write property test for key order
    - File `test/canonical-json-order.property.test.ts`; plain-function test
    - **Property 4: Canonical_JSON is ordered and independent of key order**
    - **Validates: Requirements 11.4, 11.5, 11.7**
  - [x] 2.3 Write property test for round trip and idempotence
    - File `test/canonical-json-round-trip.property.test.ts`; plain-function test
    - **Property 5: Canonical_JSON round trip and idempotence**
    - **Validates: Requirements 11.4**

- [x] 3. Label_Table
  - [x] 3.1 Implement `src/labels.ts`
    - Types `FieldLabel` and `ProfileLabels` (a missing field is a compile error) and `LABEL_TABLE` for `"120"`, `"240"`, `"400"`; data only; where a comment has more than one token, store the least certain (`[to verify]` < `[decision]` < `[convention]` < `[sourced]`), so `PROFILE_400.cardFillOrder` is `[to verify]`
    - _Requirements: 2.2, 2.3, 2.4_
  - [x] 3.2 Write property test for Label_Table against profiles.ts
    - File `test/label-table.property.test.ts`; plain-data test that reads `packages/engine/src/profiles.ts` as text by a path built from the test file location (read only, no import), runs once per profile field
    - **Property 3: Label_Table agrees with profiles.ts**
    - **Validates: Requirements 2.3**

- [x] 4. Result envelope
  - [x] 4.1 Implement `src/results.ts`
    - `toolResult(value)`, `toolError(error)`, `argumentError(argument, message)` with exactly the fields `code`, `argument`, `message`, and `internalError()` returning `{ code: "INTERNAL_ERROR", message: "Internal error." }`
    - `content` is one text item with `canonicalJson`; `structuredContent` is the parse of that text; `isError: true` only for errors
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 9.6, 11.4_

- [ ] 5. Engine seam and argument checking
  - [x] 5.1 Implement `src/engine-api.ts`
    - `EngineApi` interface and `realEngine` (the only value import of `@jacquard/engine`); `profiles` in order 120, 240, 400
    - _Requirements: 10.3, 13.3_
  - [x] 5.2 Implement `src/arguments.ts`
    - `ArgSpec` types and `checkArguments(spec, args)` as in design Argument checking: absent or `null`, then JSON type, then the extra checks for `design`, `weaves` (canonical-integer keys), `profile` (name string, `hookCount`, field types with path `profile.<field>`), `repeatAcross`, `plan`, `cardSet`; first malformed argument in declaration order; shape only, no domain checks
    - Extra-argument check for `auto_fix` only
    - _Requirements: 3.3, 3.4, 3.5, 4.4, 5.6, 7.3, 7.4, 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8_

- [x] 6. Profile resolution
  - [x] 6.1 Implement `src/profile.ts`
    - `resolveProfile(profileArgument, engine)`: built-in name returns the engine's profile unmodified; an object goes through `defineProfile` then `validateProfile`, and an `Err` is returned as the Tool_Error (`PROFILE_INVALID`); the tool operation does not run on error
    - _Requirements: 7.3, 8.6, 9.3, 9.4_

- [ ] 7. Tool handlers
  - [x] 7.1 Implement `list_profiles` and `build_lift_plan` in `src/handlers.ts`
    - `list_profiles`: three profiles in order 120, 240, 400, each field as `{ value, label }` from `LABEL_TABLE`, no arguments needed
    - `build_lift_plan`: resolve profile, call `buildLiftPlan` with `repeatAcross` defaulting to `false`, return `{ plan, idleHooks, warnings }`; pass `weaves` through unchanged; engine errors unchanged
    - _Requirements: 2.1, 2.2, 2.4, 2.5, 2.6, 3.1, 3.2, 3.3, 3.6_
  - [x] 7.2 Implement `check_floats` and `auto_fix` in `src/handlers.ts`
    - `check_floats` returns `{ violations }` (empty list is a success); `auto_fix` calls `autoFix` with the engine defaults only and returns `{ plan, flips }`; `AUTOFIX_FAILED` and every other engine error returned with all fields unchanged
    - _Requirements: 4.1, 4.2, 4.3, 5.1, 5.2, 5.3, 5.4, 5.5_
  - [ ] 7.3 Implement `build_cards` and `decode_cards` in `src/handlers.ts`
    - `build_cards` returns `{ cardSet, cardRows }` with one `cardRows(card, profile)` call per card in card order; `decode_cards` returns `{ plan }`; engine errors unchanged
    - _Requirements: 6.1, 6.2, 6.3, 6.5, 7.1, 7.2, 10.3, 10.4_

- [ ] 8. Tool definitions, server and test support
  - [ ] 8.1 Implement `src/tools.ts`
    - `TOOL_DEFS` in the order of the design table: name, description (non-empty, at most 1000 characters; `build_cards` and `decode_cards` say "The card format has not been tested on a working loom."), hand-written JSON Schema `inputSchema`, `annotations: { readOnlyHint: true }`, and the ordered `ArgSpec` list from which the schema is derived, plus the handler
    - _Requirements: 1.1, 1.3, 1.4, 12.5_
  - [ ] 8.2 Implement `src/server.ts`
    - `createServer(engine: EngineApi)` using the low-level SDK `Server`; `tools/list` returns `TOOL_DEFS` without handlers; `tools/call` dispatch: unknown name gives `TOOL_UNKNOWN` with the name as sent, then `checkArguments`, then the handler; a thrown value is logged to stderr with `console.error` and returns `INTERNAL_ERROR`; no state kept between calls
    - _Requirements: 1.1, 1.5, 8.2, 8.3, 8.4, 8.5, 11.2_
  - [ ] 8.3 Implement `test/harness.ts`
    - `connect(engine = realEngine)` returns `{ client, close }` over `InMemoryTransport.createLinkedPair()`; helpers for a spy engine (records calls and argument references), a throwing engine, and an `AUTOFIX_FAILED` stub
    - _Requirements: 1.1, 8.3_
  - [x] 8.4 Implement `test/arbitraries.ts`
    - mcp-local fast-check generators using only the public engine API: small designs (up to about 12 by 12, at most 4 regions), weave assignments, valid built-in and custom profiles (low `maxFloat` so violations occur), valid lift plans and card sets (through `buildLiftPlan`, `autoFix`, `buildCards`), one-fault corruptions per engine error code, one-fault corruptions per argument, and non-canonical weave keys
    - _Requirements: 3.3, 3.4, 9.5, 10.1_

- [ ] 9. Stdio entry and bundle
  - [ ] 9.1 Implement `src/index.ts`
    - Create the server with `realEngine`, connect `StdioServerTransport`, set `server.onerror` to log to stderr; no `console.log`, `console.info`, `console.debug` or `process.stdout` anywhere in `src`
    - _Requirements: 1.2, 1.6, 1.7_
  - [ ] 9.2 Finish the esbuild bundle in `build.mjs`
    - Bundle `src/index.ts` to `dist/index.js` (node, ESM, node22, SDK external) so the engine source is inlined; the script exits non-zero on failure so `pretest` fails the test run; confirm `node packages/mcp/dist/index.js` starts (stop it right away; do not leave a process running)
    - _Requirements: 13.7, 13.8_

- [ ] 10. Tool list and list_profiles tests
  - [ ] 10.1 Write property test for the tool list
    - File `test/tool-list.property.test.ts`; fixed finite set, one case per tool
    - **Property 1: Tool list**
    - **Validates: Requirements 1.1, 1.3, 1.4, 12.5**
  - [ ] 10.2 Write property test for list_profiles content
    - File `test/list-profiles.property.test.ts`
    - **Property 2: list_profiles content**
    - **Validates: Requirements 2.1, 2.2, 2.4, 2.5**

- [ ] 11. Result envelope test
  - [ ] 11.1 Write property test for the result envelope
    - File `test/result-envelope.property.test.ts`
    - **Property 6: Result envelope**
    - **Validates: Requirements 8.2, 11.4**

- [ ] 12. Fidelity and card tests
  - [ ] 12.1 Write property test for fidelity to the engine
    - File `test/fidelity.property.test.ts`; `numRuns` 300; the model calls the public engine function directly and compares `canonicalJson` of both sides
    - **Property 7: Fidelity to the engine**
    - **Validates: Requirements 3.1, 3.2, 4.1, 4.2, 5.1, 5.2, 6.1, 7.1, 10.1, 10.4**
  - [ ] 12.2 Write property test for build_cards numbering
    - File `test/build-cards-numbering.property.test.ts`
    - **Property 8: build_cards numbering**
    - **Validates: Requirements 6.2, 6.3**
  - [ ] 12.3 Write property test for the round trip through the server
    - File `test/card-round-trip.property.test.ts`
    - **Property 9: Round trip through the server**
    - **Validates: Requirements 7.5**

- [ ] 13. Error handling, argument and determinism tests
  - [ ] 13.1 Write property test for engine errors
    - File `test/engine-errors.property.test.ts`; includes the spy-engine check that the operation did not run on an invalid profile, and the `AUTOFIX_FAILED` stub case
    - **Property 10: Engine errors come back unchanged**
    - **Validates: Requirements 3.6, 4.3, 5.4, 6.5, 7.2, 7.3, 8.1, 8.6, 9.8, 10.2**
  - [ ] 13.2 Write property test for continuing after failures
    - File `test/keeps-answering.property.test.ts`
    - **Property 11: The server keeps answering correctly after failures**
    - **Validates: Requirements 1.5, 8.5, 11.2**
  - [ ] 13.3 Write property test for the first malformed argument
    - File `test/first-malformed-argument.property.test.ts`; spy engine shows no engine call
    - **Property 12: The first malformed argument is the one reported**
    - **Validates: Requirements 3.5, 4.4, 7.4, 9.1, 9.2, 9.6, 9.7**
  - [ ] 13.4 Write property test for weave key handling
    - File `test/weave-keys.property.test.ts`; spy engine records what `buildLiftPlan` received
    - **Property 13: Weave key handling**
    - **Validates: Requirements 3.3, 3.4, 9.5**
  - [ ] 13.5 Write property test for determinism
    - File `test/determinism.property.test.ts`; same connection and two separate servers; error text has no timestamp, stack, absolute path or process id
    - **Property 14: Determinism**
    - **Validates: Requirements 2.6, 4.5, 6.4, 7.6, 11.1, 11.6, 12.4**
  - [ ] 13.6 Write property test for unmodified arguments
    - File `test/arguments-unmodified.property.test.ts`; compares with a `structuredClone` taken before the call
    - **Property 15: Arguments are never modified**
    - **Validates: Requirements 4.3, 5.4, 6.5, 7.2, 10.5**
  - [ ] 13.7 Write property test for INTERNAL_ERROR
    - File `test/internal-error.property.test.ts`; throwing engine with arbitrary thrown values
    - **Property 16: Unexpected exceptions become INTERNAL_ERROR**
    - **Validates: Requirements 8.3, 8.4, 11.6**

- [ ] 14. Example tests and fuzz
  - [ ] 14.1 Write protocol-level example tests
    - File `test/protocol-examples.test.ts`: unknown tool name then a valid call (1.5); `arguments` omitted or an array; `list_profiles` with no arguments (2.5); `auto_fix` with an extra `maxIterations` argument rejected and `autoFix` called with plan and profile only (5.5, 5.6); profile `"360"` lists `"120"`, `"240"`, `"400"` (9.3); profile object without `hookCount` names `profile.hookCount` (9.4); `AUTOFIX_FAILED` stub preserves `reason`, `maxIterations` and `remaining` (5.3); `PROFILE_400.cardFillOrder` label is `[to verify]` in the `list_profiles` result
    - _Requirements: 1.5, 2.5, 5.3, 5.5, 5.6, 9.3, 9.4_
  - [ ] 14.2 Write the robustness fuzz test
    - File `test/robustness.test.ts`: arguments from `fc.jsonValue()` to every tool; no result is `INTERNAL_ERROR` and no call rejects. A failure is reported as an engine bug or a missing shape check, and is not hidden by catching the exception
    - _Requirements: 8.3, 9.8_

- [ ] 15. Process-level and package smoke tests
  - [ ] 15.1 Write the process-level spawn test
    - File `test/process.test.ts`: spawn `node packages/mcp/dist/index.js` with the workspace root as working directory and the relative path; initialize handshake within 5 seconds (13.7); after `tools/list` and one call per tool, every stdout line is a complete JSON-RPC message (1.2, 1.6); a non-JSON line and a JSON non-JSON-RPC line leave the process running, a later `tools/list` is answered, and stdout holds only complete JSON-RPC messages, with no assertion about whether an error reply exists (1.7); two processes from the same build give byte-identical stdout for the same requests (11.1); close the child at the end
    - _Requirements: 1.2, 1.6, 1.7, 11.1, 13.7_
  - [ ] 15.2 Extend `test/package.test.ts` with source scans
    - No import path containing `@jacquard/engine/` or `engine/src` in `src` and `test` (13.3); no `console.log`, `console.info`, `console.debug` or `process.stdout` in `src` (1.6); no `Date`, `Math.random`, `process.env`, `Intl`, `toLocale`, `fetch`, `fs`, `net`, `http` in `src` (11.3, 12.1 to 12.3); `src` contains no weaving logic imports other than through `engine-api.ts`, and only `engine-api.ts` imports engine values (10.3)
    - _Requirements: 1.6, 10.3, 11.3, 12.1, 12.2, 12.3, 13.3_

- [ ] 16. Checkpoint - Ensure all tests pass
  - Run the full mcp and engine test suites and typecheck once and confirm everything passes; confirm `git diff --stat packages/engine/test/fixtures` is empty (13.6); ask the user if questions arise.
  - _Requirements: 13.5, 13.6_

- [ ] 17. Final task: registration and custom agents (configuration, not server code)
  - [ ] 17.1 Register the server in `.kiro/settings/mcp.json`
    - Read the file first if it exists and only add the entry; never overwrite other servers. If it does not exist, create it with the single entry
    - Entry: command `node`, args `["packages/mcp/dist/index.js"]`, no absolute path, no `~` or `/Users/`, no key or token, no `env` secrets
    - _Requirements: 14.1, 14.2_
  - [ ] 17.2 Create `.kiro/agents/weave-auditor.json`
    - Read `.kiro/agents/journey-scribe.json` first and follow its schema
    - Read-only on the repository; allowed tools are exactly the six weave MCP tools (`list_profiles`, `build_lift_plan`, `check_floats`, `auto_fix`, `build_cards`, `decode_cards`) plus read tools; no write tools, no shell tools, no other MCP tools, no permission on `packages/engine/test/fixtures`
    - Prompt: audit a design or an engine change for float violations, card round-trip errors and loom facts without a Field_Label; report each finding with the affected file or design and the category; never edit files
    - _Requirements: 14.3, 14.4, 14.7_
  - [ ] 17.3 Create `.kiro/agents/design-reviewer.json`
    - Same schema as above; read-only on the repository, no write tools, no shell tools, no MCP tools, no permission on `packages/engine/test/fixtures`
    - Prompt: review `apps/web` against `.kiro/steering/design-language.md` for empty, loading, error and mobile states and accessibility; report each finding with the file and the state or accessibility category; never edit files; intended for use from Phase C onwards
    - _Requirements: 14.5, 14.6, 14.7_
  - [ ] 17.4 Write the configuration scan test and the final report
    - File `test/config.test.ts`: reads `.kiro/settings/mcp.json` and both agent files; fails with the offending file and value if the registration has an absolute path (starts with `/` or a drive letter), `~`, `/Users/`, a key or a token; if an agent lists a write tool, a shell tool, a tool outside its allowed set, or any permission on `packages/engine/test/fixtures`; or if `weave-auditor` lists any MCP tool other than the six weave tools (14.8)
    - The reply of this task, whether it succeeds or fails (including a failure unrelated to the SDK), states the pinned MCP SDK version `1.32.2` (14.10) and lists the manual checks below as steps for the user
    - Finish per Task rules
    - _Requirements: 14.1, 14.2, 14.3, 14.5, 14.7, 14.8, 14.9, 14.10_
  - Manual steps for the USER, after this task. The agent does not run them and does not claim them as passed. They are not properties and not automated tests:
    - 14.4: ask `weave-auditor` to audit a design or an engine change. Check that it reports float violations, card round-trip errors and loom facts without a Field_Label, each with the file or design and the category, and that it modifies zero files.
    - 14.6: ask `design-reviewer` to review `apps/web`. Check that it reports findings against `.kiro/steering/design-language.md` for empty, loading, error and mobile states and accessibility, each with the file and the category, and that it modifies zero files.

## Notes

- Every property test task is required. There are no optional tasks. Each property runs at least 100 fast-check cases (300 for Property 7) with the seed logged on failure.
- Every task finishes per Task rules, with `pnpm typecheck` and `pnpm test`, each with `; echo "EXIT_CODE=$?"`.
- `pnpm test` runs the build first (`pretest`). Tasks in the same wave each rebuild `dist/index.js`. If a parallel build collides with the process-level test, rerun once; if it persists, report it.
- Dev dependency versions in `packages/mcp` are the exact versions the engine package resolves to; the engine's own `package.json` is not changed.
- Property-to-task mapping: P1 10.1, P2 10.2, P3 3.2, P4 2.2, P5 2.3, P6 11.1, P7 12.1, P8 12.2, P9 12.3, P10 13.1, P11 13.2, P12 13.3, P13 13.4, P14 13.5, P15 13.6, P16 13.7.
- Requirement 13.6 and manual checks 14.4 and 14.6 are not automated tests (see design, Not automated).

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["2.1", "3.1", "5.1", "5.2", "8.4"] },
    { "id": 3, "tasks": ["2.2", "2.3", "3.2", "4.1"] },
    { "id": 4, "tasks": ["6.1"] },
    { "id": 5, "tasks": ["7.1"] },
    { "id": 6, "tasks": ["7.2"] },
    { "id": 7, "tasks": ["7.3"] },
    { "id": 8, "tasks": ["8.1"] },
    { "id": 9, "tasks": ["8.2"] },
    { "id": 10, "tasks": ["8.3", "9.1"] },
    { "id": 11, "tasks": ["9.2", "10.1", "10.2", "11.1", "12.1"] },
    { "id": 12, "tasks": ["12.2", "12.3", "13.1", "13.2", "13.3"] },
    { "id": 13, "tasks": ["13.4", "13.5", "13.6", "13.7"] },
    { "id": 14, "tasks": ["14.1", "14.2"] },
    { "id": 15, "tasks": ["15.1", "15.2"] },
    { "id": 16, "tasks": ["17.1", "17.2", "17.3"] },
    { "id": 17, "tasks": ["17.4"] }
  ]
}
```
