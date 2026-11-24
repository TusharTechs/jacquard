# Implementation Plan: deploy-static

All 1 correctness property has its own property test task. Every property test task is required.

## Tasks

- [x] 1. Motifs without a backend
  - [x] 1.1 `lib/motif-local.ts`, `localMotifs()` and the `local` option in `motif-client.ts`, the sketch note, the offline wording, idle prefetch
    - _Requirements: 1.1, 1.3 to 1.6_
  - [x] 1.2 Write property test: **Property 1: The in-browser stand-in equals the backend's** — **Validates: Requirements 1.2, 1.3**
  - [x] 1.3 Component tests for the local path (labels, sketch note, no fetch)
    - _Requirements: 1.1, 1.3, 1.4_
- [x] 2. MCP and hosting
  - [x] 2.1 AWS Documentation MCP server in `.kiro/settings/mcp.json`; check the manual-deploy steps through it
    - _Requirements: 3.1, 3.2_
  - [x] 2.2 `scripts/deploy-web.sh`, `scripts/check-no-account-id.sh`, `.deploy/` in `.gitignore`; deploy; rerun to prove idempotence
    - _Requirements: 2.1 to 2.5, 5.1 to 5.3_
- [x] 3. Verification and record
  - [x] 3.1 Full flow on the Live_URL through the Chrome DevTools MCP server at 1440x900 and 390x844; console; Lighthouse; `media/deploy/`
    - _Requirements: 4.1 to 4.3_
  - [x] 3.2 `README.md` with the Live_URL; status, tally, journal with costs
    - _Requirements: 6.1_

## Task Dependency Graph

```json
{ "waves": [ { "id": 0, "tasks": ["1.1", "1.2", "1.3"] }, { "id": 1, "tasks": ["2.1", "2.2"] }, { "id": 2, "tasks": ["3.1", "3.2"] } ] }
```
