# Design Document: kiro-product

Traces to `requirements.md`.

## Overview

```
packages/mcp/build.mjs ──(target "power", SDK inlined)──► power/dist/server.js ◄── power/mcp.json (node ${PLUGIN_ROOT}/dist/server.js)
scripts/gallery/generate.ts ──(esbuild bundle, node)──► apps/web/public/gallery/{index.json, <id>.json}
.kiro/workflows/release-check.workflow.json: parallel[ release-runner tests | weave-auditor gallery ] → design-reviewer → release-runner build
.github/workflows/kiro-spec-check.yml: if vars.KIRO_CI_ENABLED == 'true' → tests → kiro-cli headless (spec-checker, read tools) → $GITHUB_STEP_SUMMARY
.kiro/automations/gallery-daily.md: prompt for a Kiro Web scheduled task (created by the user)
```

## Components

### Power

```
power/
├── plugin.json
├── mcp.json
├── README.md
├── dist/server.js            built, committed
└── skills/
    ├── design-woven-pattern/SKILL.md
    └── check-floats-and-cards/SKILL.md
```

`packages/mcp/build.mjs` takes an optional `--power` flag: same entry `src/index.ts`, `external: []`, outfile `../../power/dist/server.js`, `legalComments: "none"`, a banner comment naming the source package and the untested-loom sentence. Script `build:power`. The esbuild output is deterministic for the same inputs and versions.

Skills describe the tool flow in plain steps: `list_profiles` to pick a profile and read labels; `build_lift_plan` with a design grid (pick 0 first, end 0 left) and a weave per region; `check_floats`; `auto_fix` when violations exist; `build_cards`; `decode_cards` to confirm the round trip. They include a small worked example (an 8 by 8 two-region design with plain and twill) and the framing rules.

### Gallery

`scripts/gallery/generate.ts` holds four fixed examples:

| id | prompt | profile | colours | repeat | symmetry | min feature |
|---|---|---|---|---|---|---|
| `lotus-border` | "lotus border" | 240 | 3 | 48 × 48 | mirrorEnds | 2 |
| `peacock-butta` | "peacock butta" | 240 | 4 | 40 × 40 | mirrorEnds | 2 |
| `temple-stripe` | "temple stripe" | 120 | 2 | 24 × 32 | none | 2 |
| `star-lattice` | "star lattice" | 400 | 4 | 50 × 50 | mirrorBoth | 3 |

If a prompt's hashed family repeats another example's, the script still uses it; the test only checks determinism and soundness. For each: `standInMotif` → `motifToDesign` → `buildLiftPlan` with the web app's `defaultWeaves`, imported from `apps/web/src/lib/default-weaves.ts` by relative path (it is app data, not a package internal), so the gallery and the app use the same table → `checkFloats` → `autoFix` when needed → `checkFloats` again. Output JSON (canonical key order, 2-space indent, trailing newline): `{ id, title, prompt, source: "standIn", setup, palette, design, weaves, check: { violationsBefore, flips, violationsAfter } }`. `index.json` lists `{ id, title, profile, ends, picks }`.

`scripts/gallery/run.mjs` bundles `generate.ts` with esbuild to a temporary file and runs it; root script `pnpm gallery`. A root-level test package is avoided: the check lives in `apps/web/test/gallery.test.ts`, which imports the generator's pure `buildGallery()` function and compares it with the committed files.

### Workflow and agents

`release-runner` (`.kiro/agents/release-runner.json`): tools `read`, `shell`; permissions allow shell `pnpm typecheck`, `pnpm test`, `pnpm -r build`, `pnpm gallery --check`; deny `fs_write` everywhere and every other shell command.

`spec-checker` (`.kiro/agents/spec-checker.json`): tools `read`; deny `fs_write`, `shell`, MCP.

### CI

One job, `if: vars.KIRO_CI_ENABLED == 'true'`: checkout with `fetch-depth: 2`, `pnpm/action-setup`, `actions/setup-node` (22), `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm test`, install Kiro CLI with the documented script, write `git diff --name-only HEAD~1 HEAD` into the prompt, run `kiro-cli chat --v3 --no-interactive --agent spec-checker --trust-tools=read_file,grep_search` with `KIRO_API_KEY: ${{ secrets.KIRO_API_KEY }}` in that step's `env` only, tee output to a file, and append it to `$GITHUB_STEP_SUMMARY`. The job fails when the CLI exits non-zero or the verdict line says `FAIL`.

## Correctness properties

This feature is configuration and generated content. Its checks are example and snapshot tests, not properties:

- `packages/mcp/test/power.test.ts`: `plugin.json` and `mcp.json` fields (1.1, 1.2); a fresh `--power` build is byte-identical to the committed `power/dist/server.js` (1.4); spawning `node power/dist/server.js` from a temporary folder outside the repo (no `node_modules`) answers initialize and lists the six tools (1.3); skill frontmatter rules (1.5) and framing sentences (1.6).
- `apps/web/test/gallery.test.ts`: `buildGallery()` equals the committed files byte for byte (2.3, 2.4); every example has `violationsAfter` 0 and `source` `standIn` (2.2, 2.5).
- `packages/mcp/test/config.test.ts` extended: `release-runner` and `spec-checker` permissions (3.2, 4.4); the CI file reads the key only through `secrets.KIRO_API_KEY` in a step `env`, never echoes it, and has the `KIRO_CI_ENABLED` guard (4.2, 4.3).

No new correctness property, so no property test task. Every existing property test still runs.
