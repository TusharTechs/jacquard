# Kiro journey log — JACQUARD

This log is the raw material for the "how Kiro was used" write-up, the blog post and the social post. Add one entry per working session. Once the repo exists, the `journey-scribe` hook appends a draft entry when an agent session stops; edit it by hand so the observations are yours.

## How to log

For each session record:
- **Date and surface:** IDE, CLI, Web or Crew.
- **Goal:** one line.
- **Kiro features used:** spec (which), vibe, hook (which fired), steering (which file mattered), custom agent, MCP tool, property test, Power, workflow, checkpoint.
- **Model and credits:** from `/usage` at the start and end of the session.
- **What worked:** something specific, with a file or commit reference.
- **What failed or surprised:** wrong output, a property test that caught a bug, a hook that misfired, a time Kiro gamed a test.
- **Spec versus vibe note:** which you chose for this piece and whether it was the right call.
- **Evidence:** commit hash, screenshot path, failing-then-passing test name.

Keep a running tally at the bottom. Numbers the judges responded to last year: count of specs, hooks, steering files, MCP servers, and concrete bugs caught.

---

## Entries

### 2026-11-15 — Research and idea selection (before any Kiro use)

- **Goal:** Choose a project with a real chance at an overall or category prize.
- **What was done:** Read the Kiroween 2026 overview, rules, FAQs and resources; analysed all 62 Kiroween 2025 winners; documented current Kiro features; drafted eight ideas; ran a seven-judge simulated panel; scanned 476 competitor repos on GitHub and 22 projects on dev.to; re-ran the vote with the competition data.
- **Outcome:** The first vote chose a Morse one-switch voice app (5 of 7). The competitor scan then found four near-identical entries, one already live. The second vote chose JACQUARD: 5 of 7 with the builder alone on camera, 7 of 7 with a real weaver or textile designer on camera.
- **Lesson for the write-up:** Ideas that come straight out of an AI brainstorm are being built several times over in this field; checking the competition changed the decision.
- **Kiro credits used:** 0.
- **Evidence:** `research/01` to `research/11`, `PLAN.md`.

### 2026-11-16 — Repo setup, steering files, journey tooling

- Surface: IDE
- Goal: Put the project under version control, write steering files, and set up journey logging (steering rule, Stop hook, journey-scribe agent).
- Kiro features used: none from specs, MCP, Powers or property tests. Steering files were created, not yet exercised. A hook and a custom agent were created, not yet fired. No checkpoints.
- Model / credits (start → end):
- What worked: Private GitHub repo created and pushed (`origin/main`). Steering files written in `.kiro/steering/`: `product.md`, `tech.md`, `structure.md`, `weaving-domain.md` (file-matched to `packages/engine/**`), `design-language.md` (file-matched to `apps/web/**`), `journey.md`. Hook `.kiro/hooks/journey-entry-on-stop.json` (Stop, agent action). Agent `.kiro/agents/journey-scribe.json`.
- What failed or surprised: Lines ignoring `research/`, `PLAN.md` and `BUILD_PLAYBOOK.md` appeared in `.gitignore` after I wrote it, and I removed them. The cause is unknown. Later `.gitignore` and `LICENSE` were deleted from disk (not by me) and I restored them from git on request. The `journey-scribe` write restriction uses a `permissions.rules` shape taken from the research notes; the `match` syntax for paths is unverified, so confirm in the IDE that the agent cannot write other files. Hook trigger name `Stop` and the `fileMatch` front matter were not tested in a live session either. Weaving facts about real looms are marked "to verify" and four questions to the user are open (default loom source, hook count and card size, lacing direction, binding weaves).
- Spec versus vibe note: vibe; setup work with no spec.
- Evidence: commits `8d5ffdc`, `66bec3c`; files under `.kiro/`.

### Template

```
### YYYY-MM-DD — <session title>
- Surface:
- Goal:
- Kiro features used:
- Model / credits (start → end):
- What worked:
- What failed or surprised:
- Spec versus vibe note:
- Evidence:
```

---

## Running tally

| Item | Count | Notes |
|---|---|---|
| Specs (feature / bugfix) | 0 / 0 | |
| Property-based tests / bugs they caught | 0 / 0 | |
| Hooks | 1 | journey-entry-on-stop (not yet fired) |
| Steering files | 6 | 4 always-on, 2 file-matched |
| Custom agents | 1 | journey-scribe (not yet invoked) |
| MCP servers (third-party / our own) | 0 / 0 | |
| Powers (used / shipped) | 0 / 0 | |
| Workflows | 0 | |
| CLI headless runs in CI | 0 | |
| Web automations | 0 | |
| Credits used of 4,000 | 0 | |
