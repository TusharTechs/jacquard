# JACQUARD — Kiroween 2026 build plan

**Category:** Resurrection. **Deadline:** Fri Dec 4, 2026, 2:00 PM PT (Sat Dec 5, 3:30 AM IST). Target submission: Thu Dec 3 IST, one day early.

**Pitch:** In 1804, a loom read punch cards. Computers borrowed the idea, then abandoned them; handlooms did not [sourced, S2 and S3 in `.kiro/steering/weaving-domain.md`]. JACQUARD brings the punch card back: describe a motif and a motif builder turns it into a design (the AI path is built but off), or upload a sketch; get a card-ready design, a simulated cloth, and the card set to weave it.


## The three things that decide the score

1. **Proof that the output is real, without a weaver on camera.** Decided Nov 16: the builder records the demo alone. Three substitutes for a weaver on camera:
   - **Weave it by hand.** Print the card set, punch a few cards, and weave a small swatch (about 24 threads by 24 rows, two yarn colours) on a cardboard frame loom by following the generated lift plan row by row. Put the swatch next to the simulator on camera. This is the strongest proof available to one person.
   - **Independent check.** Export WIF (the standard weaving interchange format) and show the file opening correctly in a weaving tool we did not write.
   - **Honest framing.** Say on camera: "I am not a weaver, so here is how I checked it." Optionally send the live link to a Weavers' Service Centre, a textile institute or an online weaving community; quote any reply with permission. Fifteen minutes of effort, no dependency on it.
2. **Weave output that is verifiably correct.** No open spec for card dimensions was found, so the card format is a configurable loom profile with defaults taken from a published source, and the app says plainly that it has not been tested on a working loom. The float checker must visibly catch bad designs. The motif must not be a pixelated AI picture: the model writes a clean limited-colour vector motif, and the deterministic engine does the weaving work.
3. **Kiro configuration shipped as a product.** Beyond specs, steering and hooks: a weave-engine MCP server and a Power other Kiro users can install, plus property-based tests with real invariants.

## Framing rules

- Punch cards are dead as a computing medium; say that in the first line (one judge rated category fit borderline otherwise).
- The tool assists the designer and the card puncher. Never say it replaces them.
- No unverified statistics. The handloom census figure (about 35 lakh workers, 2019-20) is sourced; time and cost per design are not, so ask the weaver and quote them.
- Hosting on AWS (Amplify Hosting, or S3 plus CloudFront). Not Vercel, Netlify or Lovable. Model keys stay behind a backend proxy.

## Product scope

**Must ship**
- Input: text prompt or uploaded sketch, turned into a motif.
- Loom setup: hook count (120 / 240 / 400), colour limit, repeat size.
- Grid design ("point paper") editor with manual touch-up.
- Deterministic weave engine in TypeScript: colour reduction to the grid, binding weave per colour region, float-length check with highlighted violations and auto-fix.
- Fabric simulator showing the woven cloth.
- Export: punch-card set (SVG and PDF, numbered and in lacing order), classic graph-paper sheet, WIF file.
- Gallery of three or four finished examples so a judge sees results in ten seconds.

**Stretch**
- A physically cut or hand-punched sample card, and a woven swatch if the weaver is willing.
- Hindi interface.
- Extra-weft (brocade) designs with more than one card per row.

**Out of scope:** accounts, payments, marketplace, electronic-jacquard file formats.

## How Kiro is used (maps to the eight questions in the submission write-up)

| Write-up question | What we do | Where it lives |
|---|---|---|
| IDE, CLI, Web, Crew | IDE for specs, property tests and UI work. CLI headless in CI for spec-conformance review on each push. Web automation for a nightly gallery regeneration that opens a PR. Crew app as a separate repo (stretch, Best Kiro Crew App bonus). | `.github/workflows/`, Kiro Web, separate repo |
| Custom agents | `weave-auditor` (checks structural validity, read-only), `journey-scribe` (writes the build log), `design-reviewer` (UI states, accessibility). | `.kiro/agents/*.json` |
| Agent hooks | On save in the engine folder: run the property tests. Before tool use: block edits to golden fixtures. On agent stop: append a journey entry. Manual: export sample cards and validate the WIF. | `.kiro/hooks/*.json` |
| Specs versus vibe | Requirements-first specs in EARS for the weave engine, card export and simulator. Vibe coding for visual polish. One bugfix spec for the first real bug. Record what each was good and bad at. | `.kiro/specs/` |
| Steering | Always-on: product, tech, structure. File-matched: weaving domain glossary for the engine, design language for the UI. | `.kiro/steering/*.md` |
| MCP | Our own weave-engine MCP server (validate draft, check floats, simulate, export cards), used by Kiro while building and shipped to users. Context7 for library docs. Chrome DevTools MCP so Kiro can see the simulator. | `.kiro/settings/mcp.json`, `packages/mcp/` |
| Property-based testing | Properties derived from EARS requirements: card set to pattern round trip; no float longer than N after auto-fix; every warp end is bound; card count equals pick count; export is deterministic. | spec `tasks.md`, `packages/engine/test/` |
| Powers | A `loom` Power in the Agent Plugin format bundling the MCP server, weaving skills and steering, installable from GitHub. | `power/plugin.json`, `power/skills/` |

Also: one workflow recipe for the release check (`.kiro/workflows/`), and checkpoints noted in the journey when a rollback saved time.

Items to confirm in the Kiro IDE on day 1, because the docs pages read during research were incomplete: exact hook trigger names for file save, the spec folder path, and how property tests are declared in a spec.

## Schedule (IST)

| Dates | Work | Kiro focus |
|---|---|---|
| Nov 16 | Sign in to Kiro, public GitHub repo with MIT licence, `/.kiro` committed. Steering, journey hook. Buy yarn and card stock. | Steering, hooks |
| Nov 17-19 | Weave engine: grid model, binding weaves, float checker, card encoding. MCP server. | Requirements-first spec, property tests |
| Nov 20-22 | Prompt and sketch to grid design. Editor. | Spec, vibe for the editor feel |
| Nov 23-25 | Fabric simulator. Card, graph-sheet and WIF export. Validate WIF in an independent tool. | Spec, DevTools MCP |
| Nov 26-27 | Print and punch cards, weave the hand swatch, film it. Fix whatever the swatch exposes. | Bugfix spec from what the swatch shows |
| Nov 28-29 | Power, custom agents, workflow, CLI in CI, Web automation. Crew app if time allows. | Power, agents, CLI, Web, Crew |
| Nov 30 - Dec 1 | Design polish: onboarding, empty and error states, mobile. Deploy on AWS. | Vibe, design-reviewer agent |
| Dec 1 | Last moment to request more credits (12:00 PM PT). | |
| Dec 2 | Video (under 3 minutes), write-up, blog post, social post starting with #KiroweenHackathon26. | Journey log becomes the write-up |
| Dec 3 | Submit. Check live URL, repo licence, `/.kiro` not ignored. | |

## Credit budget (4,000 credits; starting estimate, to be corrected from `/usage`)

| Area | Credits |
|---|---|
| Specs and requirements analysis | 500 |
| Weave engine and property tests | 900 |
| Design input and editor | 700 |
| Simulator and exports | 700 |
| Power, MCP, agents, workflow | 400 |
| Polish and bug fixes | 400 |
| Reserve | 400 |

Model use: a low-multiplier model (Haiku 5.5 at 0.06x) for scaffolding, tests and docs; Auto or Sonnet 5.5 (1.3x) for implementation; Opus 5.5 (2.0x) only for the engine design document. Record credits per session in the journey.

## Submission checklist

- [ ] Public GitHub repo, open-source licence visible in the About section
- [ ] `/.kiro` at repo root, not in `.gitignore`
- [ ] Live URL, free and open until Jan 29, 2027
- [ ] YouTube video, public, under 3 minutes, no third-party trademarks or copyrighted music
- [ ] Text description and Kiro write-up covering all eight questions
- [ ] Category: Resurrection. Bonus categories ticked
- [ ] Blog post mentioning Kiroween 2026 (Bonus Blog Prize)
- [ ] Social post starting with #KiroweenHackathon26 (Social Blitz)
- [ ] Any pre-existing code disclosed (none planned)
