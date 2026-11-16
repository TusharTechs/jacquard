# Implementation Plan: kiro-product

## Overview

Ship the Kiro configuration as a product: the `loom` Power, the gallery, the `release-check` workflow, the CI spec check and the Kiro Web automation prompt. This feature has no correctness properties (see design); its checks are example and snapshot tests.

## Task rules

- Finish every task with `pnpm typecheck; echo "EXIT_CODE=$?"` and `pnpm test; echo "EXIT_CODE=$?"`, both `EXIT_CODE=0` with no failed tests.
- No AWS resource, no Kiro Web task, no repository setting changed. The CI job stays guarded.
- No journal, no git inside tasks.

## Tasks

- [x] 1. Power
  - [x] 1.1 `--power` build target in `packages/mcp/build.mjs` and `build:power` script; `.gitignore` exception `!power/dist/`; build `power/dist/server.js`
    - _Requirements: 1.3, 1.4_
  - [x] 1.2 `power/plugin.json`, `power/mcp.json`, two skills, `power/README.md`
    - _Requirements: 1.1, 1.2, 1.5, 1.6, 1.7_
  - [x] 1.3 `packages/mcp/test/power.test.ts`
    - _Requirements: 1.1 to 1.6_
- [x] 2. Gallery
  - [x] 2.1 `scripts/gallery/generate.ts`, `scripts/gallery/run.mjs`, root `gallery` script, root esbuild dev dependency; generate `apps/web/public/gallery/`
    - _Requirements: 2.1, 2.2, 2.3, 2.5_
  - [x] 2.2 `apps/web/test/gallery.test.ts`
    - _Requirements: 2.3, 2.4_
- [ ] 3. Workflow, agents, CI, automation
  - [ ] 3.1 `.kiro/agents/release-runner.json`, `.kiro/agents/spec-checker.json`, `.kiro/workflows/release-check.workflow.json`
    - _Requirements: 3.1, 3.2, 3.3, 4.4, 4.5_
  - [ ] 3.2 `.github/workflows/kiro-spec-check.yml` and `.kiro/automations/gallery-daily.md`
    - _Requirements: 4.1, 4.2, 4.3, 5.1, 5.2_
  - [ ] 3.3 Extend `packages/mcp/test/config.test.ts`; run the `spec-checker` agent once locally with the CI command to confirm it works
    - _Requirements: 3.2, 4.2, 4.3, 4.4_

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3", "2.1", "2.2"] },
    { "id": 1, "tasks": ["3.1", "3.2", "3.3"] }
  ]
}
```
