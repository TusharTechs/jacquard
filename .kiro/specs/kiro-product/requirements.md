# Requirements Document

## Introduction

Scope: Phase F of `BUILD_PLAYBOOK.md`, shipping the Kiro configuration as a product. Four parts:

1. The `loom` Power in `power/`, in the Agent Plugins format: `plugin.json`, skills, and an `mcp.json` that starts a self-contained build of the weave MCP server.
2. A gallery of finished examples, produced by a deterministic script, used by the release check, the web app (Phase G) and the daily Kiro Web automation.
3. The `release-check` workflow recipe in `.kiro/workflows/`.
4. A GitHub Actions workflow that runs Kiro CLI headless with read-only tools to check changed code against `.kiro/specs`, and the prompt for a Kiro Web scheduled task.

Kiro Crew is out of scope (standing orders). Nothing here creates an AWS resource. The CI job and the Kiro Web task spend Kiro credits, so both stay off until the user turns them on.

Formats follow the kiro.dev documentation as reported by the Kiro `introspect` agent on 2026-11-16: Agent Plugins (`https://kiro.dev/docs/powers/create.md`, `https://agent-plugins.org/specification`), workflows (`https://kiro.dev/docs/workflows/authoring.md`), headless CLI (`https://kiro.dev/docs/cli/headless.md`), and Kiro Web automations (`https://kiro.dev/docs/web/automations.md`).

## Glossary

- **Power**: the folder `power/`, an Agent Plugin.
- **Power_Server**: `power/dist/server.js`, a single-file bundle of `@jacquard/mcp` with the engine and the MCP SDK inlined.
- **Gallery**: the files under `apps/web/public/gallery/`: `index.json` and one JSON file per example.
- **Gallery_Example**: one finished design: title, prompt, loom setup, palette, design, weaves, and the summary of its engine check.
- **Release_Check**: the workflow `.kiro/workflows/release-check.workflow.json`.
- **Spec_Check**: the GitHub Actions workflow `.github/workflows/kiro-spec-check.yml`.

## Requirements

### Requirement 1: The loom Power

**User Story:** As a Kiro user in another workspace, I want to install a Power that designs and checks woven patterns, so that I can use the weave engine without cloning this repository.

#### Acceptance Criteria

1. THE `power/plugin.json` SHALL contain `$schema` `https://agent-plugins.org/schemas/1.0.0/plugin.schema.json`, `name` `loom`, a semver `version`, a `description`, an `author` object with `name`, `keywords`, `repository` and `license` `MIT`.
2. THE `power/mcp.json` SHALL contain `$schema` `https://agent-plugins.org/schemas/1.0.0/mcp.schema.json` and one stdio server whose `command` is `node` and whose `args` are `["${PLUGIN_ROOT}/dist/server.js"]`, with no `env`, no absolute path and no secret.
3. THE Power_Server SHALL be committed, SHALL run with plain `node` and no `node_modules`, and SHALL answer the MCP initialize handshake and list the same six tools as `packages/mcp`.
4. THE Power_Server SHALL be rebuilt by a script in `packages/mcp`, and a test SHALL fail when the committed file differs from a fresh build.
5. THE Power SHALL contain at least two skills in `power/skills/<name>/SKILL.md`, each with `name` equal to its folder name and a `description` of at most 1024 characters: one for designing and validating a woven pattern, and one for checking floats and preparing the card set.
6. THE skills SHALL state the framing rules: the card format is a configurable loom profile not tested on a working loom; the tool assists the designer and card puncher; loom facts carry their labels.
7. THE Power SHALL include install instructions in `power/README.md` (from GitHub and from a local folder) and the steps to test it in a fresh empty workspace.

### Requirement 2: Gallery

**User Story:** As a judge or visitor, I want finished examples, so that I can see results in seconds.

#### Acceptance Criteria

1. THE gallery script SHALL produce four Gallery_Examples from fixed inputs, using `@jacquard/motif` (`standInMotif`, `motifToDesign`) and `@jacquard/engine` (`buildLiftPlan`, `checkFloats`, `autoFix`).
2. EACH Gallery_Example SHALL record whether auto-fix was needed and SHALL have zero float violations in its final lift plan.
3. THE gallery script SHALL be deterministic: running it twice SHALL produce byte-identical files.
4. A test SHALL fail when the committed Gallery differs from a fresh run, and when any example has violations after auto-fix.
5. EACH Gallery_Example SHALL label its motif as a stand-in, because no model was connected when it was made.

### Requirement 3: Release check workflow

**User Story:** As the maintainer, I want one recipe that runs every release check, so that a release is checked the same way each time.

#### Acceptance Criteria

1. THE Release_Check SHALL run, in order: engine and package tests together with the `weave-auditor` agent over the Gallery (in parallel), then the `design-reviewer` agent over `apps/web`, then a build of every package.
2. THE test and build steps SHALL use a custom agent `release-runner` that may run only `pnpm typecheck`, `pnpm test`, `pnpm -r build` and `pnpm --filter * build` style commands, and may not write files.
3. THE Release_Check SHALL use only documented node types (`step`, `parallel`) and fields.

### Requirement 4: Spec check in CI

**User Story:** As the maintainer, I want every push checked against the specs by Kiro, so that drift between code and requirements shows up early.

#### Acceptance Criteria

1. THE Spec_Check SHALL run on push to `main`, install the workspace, run `pnpm typecheck` and `pnpm test`, install Kiro CLI, and run `kiro-cli chat --v3 --no-interactive --agent spec-checker` with `--trust-tools` limited to read tools.
2. THE Spec_Check SHALL read the key only from the repository secret `KIRO_API_KEY` into the step environment, SHALL NOT write it to a file or print it, and SHALL post the agent's output to the job summary.
3. THE Spec_Check SHALL run only when the repository variable `KIRO_CI_ENABLED` is `true`, so it spends no minutes or credits until the user turns it on.
4. THE `spec-checker` agent SHALL be read-only: tools `read` only, `fs_write` and `shell` denied.
5. THE `spec-checker` prompt SHALL ask for each changed file's governing spec, the acceptance criteria it touches, and any criterion the change appears to break, with file and criterion references, and SHALL end with a one-line verdict.

### Requirement 5: Kiro Web automation

**User Story:** As the maintainer, I want the gallery regenerated daily with a pull request when it changes, so that examples stay current with the engine.

#### Acceptance Criteria

1. THE repository SHALL contain the scheduled-task prompt in `.kiro/automations/gallery-daily.md`, with the schedule, the repository, the commands to run, the check that the gallery test passes, and the instruction "If nothing changed, do nothing".
2. THE scheduled task SHALL NOT be created by the agent; the user creates it in Kiro Web (it spends credits).

## Labels

Same labels as earlier specs. This spec adds no loom facts.

## Decision log

Gap analysis run by the agent under `.kiro/steering/autopilot.md`.

| Q | Answer | Label |
|---|---|---|
| How does the Power start the server without `node_modules`? | A second esbuild target in `packages/mcp` bundles the SDK too (`power/dist/server.js`). The file is committed (`dist/` is ignored elsewhere, so `.gitignore` gets `!power/dist/`). | [decision] |
| Steering in the Power | Agent Plugins v1 documents skills and MCP only, so guidance goes into skills. | [decision] |
| Where the gallery script lives | `scripts/gallery/` at the workspace root, bundled and run with esbuild (a root dev dependency), so it can import the workspace packages. | [decision] |
| Gallery inputs | Four fixed prompts and setups (design.md table); region weaves from the web app's defaults. The stand-in hash gives `temple-stripe` and `star-lattice` the same family (check); kept, because the gallery shows stand-ins and the model will replace them (finding from task 2.1). | [decision] |
| Shell steps in a workflow | Workflows have no shell step; a custom agent `release-runner` with a shell allow list runs the commands. | [decision] |
| CI cost | Off until `KIRO_CI_ENABLED` is `true` and `KIRO_API_KEY` is set. Turning it on is the user's call. | [decision] |
| Kiro Web task | Prompt committed; the task itself is the user's (it spends credits and needs a Kiro Web sign-in). | [decision] |
| Kiro Crew | Skipped by the standing orders. | [decision] |
