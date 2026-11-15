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
| Hooks | 0 | |
| Steering files | 0 | |
| Custom agents | 0 | |
| MCP servers (third-party / our own) | 0 / 0 | |
| Powers (used / shipped) | 0 / 0 | |
| Workflows | 0 | |
| CLI headless runs in CI | 0 | |
| Web automations | 0 | |
| Credits used of 4,000 | 0 | |
