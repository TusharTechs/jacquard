---
inclusion: always
---

# Autopilot: standing orders

Set by Tushar on 2026-11-16. Work through the rest of `BUILD_PLAYBOOK.md` without waiting between steps.

## Order of work

1. Phase B: `weave-mcp` (in progress).
2. Phase C: `motif-input`.
3. Phase D: `simulate-and-export`.
4. Phase F: `loom` Power, `release-check` workflow, Kiro CLI headless check in GitHub Actions, Kiro Web automation. Skip Kiro Crew.
5. Phase G: polish. Deploy only after asking Tushar.
6. Phase H: draft the "how Kiro was used" write-up from `KIRO_JOURNEY.md` and git history.

Phase E (hand-woven swatch) is Tushar's. Skip it.

## For each phase

1. Write the spec in Kiro's format, requirements-first. Run a gap analysis, resolve the gaps using `PLAN.md`, the steering files and the engine as the source of truth, and record every decision in the spec's Decision log labelled `[decision]`. Do not stop for approval.
2. Generate design and tasks the same way. Every property test task is required.
3. Run every task in dependency-wave order. Each task ends with `pnpm typecheck` and `pnpm test` passing (EXIT_CODE rule in `tech.md`).
4. If a property test fails: first copy the full shrunk counterexample, seed and requirement into the journal, then fix the code. If the failure shows the spec is wrong, fix the spec and record that as a finding. Never weaken a test.
5. After each wave: one journal entry, commit, push.
6. At the end of the phase: run the `weave-auditor` agent (and, from Phase C, the `design-reviewer` agent) over the phase's work, fix their findings, commit and push. Then create the tag `phase-<letter>` (for example `phase-B`) and push it with `git push origin <tag>`.

## Stop and ask Tushar only

- Before creating, changing or deleting any AWS resource, or anything that costs money.
- Before making the GitHub repository public.
- If Amazon Bedrock model access is missing. In that case build the motif step behind an interface with a deterministic stand-in generator, keep going, and say at the end what to enable.
- If a decision would contradict `PLAN.md` or a `[sourced]` loom fact.
- If the same task fails three times.

## Phase B decisions already made

- Relax 1.7 and use the SDK stdio transport.
- Use the low-level SDK `Server` with hand-written JSON Schema.
- Bundle the engine with esbuild 0.28.2.
- One `cardRows` entry per card (6.1 wording).
- Object-shaped tool results.
- When a profile comment has several label tokens, use the least certain: `[to verify]` < `[decision]` < `[convention]` < `[sourced]`.
- Accept `ARGUMENT_INVALID` versus `PROFILE_INVALID`, the extra-argument check on `auto_fix` only, and `TOOL_UNKNOWN`.
- No direct `zod` dependency unless the code imports it.

## When finished

When everything up to Phase H is done, or a stop condition is hit, write a short summary at the top of `KIRO_JOURNEY.md` under `## Status for Tushar`: what was built, what is left for Tushar, and every stop question. Then stop.
