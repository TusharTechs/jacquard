# JACQUARD build playbook — end to end with Kiro

Read `PLAN.md` first for scope, schedule and what decides the score. This file is the how: what is installed, what you do by hand, and the prompts to paste into Kiro at each phase.

**One rule for the whole build:** Kiro writes the project. The specs, steering, hooks, agents and code should all come out of Kiro sessions, so the submission write-up is true and `/.kiro` shows real history. Use this playbook's prompts as starting points and edit them in your own words.

---

## 0. Setup

### Already installed on this Mac (Nov 16)

| Tool | Version | Use |
|---|---|---|
| Kiro IDE | 1.4.178 (`/Applications/Kiro.app`, `kiro` on PATH) | Specs, property-based tests, most of the build |
| Kiro CLI | 3.3.0 (`kiro-cli`) | Terminal sessions, headless runs in CI, launching Crew |
| Node 22, pnpm 12, git, GitHub CLI (signed in), AWS CLI, ffmpeg | present | Build, repo, deploy, video trimming |

Not installed: Kiro Crew. It is only needed for the optional Best Kiro Crew App bonus; `kiro-cli crew` installs it on first run.

### You do these by hand (they need your sign-in)

1. Open Kiro and sign in with the same account your 4,000 hackathon credits were redeemed on. Check the balance at `kiro.dev/account/usage` (hackathon credits show with a "kiroween" prefix).
2. Sign in on the CLI:
   ```bash
   kiro-cli login
   ```
3. Confirm it worked:
   ```bash
   kiro-cli whoami
   ```
4. Decide on the model API for the prompt-to-motif step. The plan uses Amazon Bedrock through your AWS account; that usage is billed by AWS, separately from Kiro credits, and should be small. Check that Bedrock model access is enabled in your AWS console before Nov 20.
5. Buy for the hand-woven swatch: two contrasting yarns, stiff card or thick paper, a hole punch, a blunt needle. A cardboard frame loom can be cut from a box.

### Project folder and repo

Create an empty folder (for example `~/Projects/jacquard`), copy in `PLAN.md`, `KIRO_JOURNEY.md`, `BUILD_PLAYBOOK.md` and the `research/` folder as reference material, then open that folder in Kiro. The public GitHub repo needs an open-source licence visible in its About section and `/.kiro` must never be added to `.gitignore`.

---

## 1. Special instructions for Kiro (do this first, before any code)

These are what make Kiro log the journey and stay consistent. Paste each prompt into a Kiro chat (vibe mode) in the project folder.

**Prompt 1 — steering**

> Read PLAN.md and research/11-competition-summary.md. Create steering files in .kiro/steering:
> - product.md (always included): what JACQUARD is, who it is for, the framing rules from PLAN.md, and what is out of scope.
> - tech.md (always): pnpm monorepo; packages/engine is pure TypeScript with no runtime dependencies, tested with vitest and fast-check; packages/mcp is an MCP server wrapping the engine; apps/web is a React single-page app; a small AWS backend proxies model calls so no key reaches the browser; hosting on AWS Amplify or S3 with CloudFront, never Vercel or Netlify.
> - structure.md (always): folder layout and naming rules.
> - weaving-domain.md (included only for files under packages/engine): a glossary and rules for warp, weft, end, pick, hook, float, binding weave, point paper, lift plan, card lacing order, and loom profile. Where you are unsure of a weaving fact, mark it "to verify" instead of guessing.
> - design-language.md (included only for files under apps/web): the visual language, component rules, and required states (empty, loading, error, mobile).
> Ask me before inventing any fact about real looms.

**Prompt 2 — journey rules (the important one)**

> Create .kiro/steering/journey.md, always included, with these rules for yourself:
> 1. At the end of every task or chat session, append an entry to KIRO_JOURNEY.md using the template in that file.
> 2. Record which Kiro features were actually used in the session (spec name, hook that fired, steering file that mattered, custom agent, MCP tool, property test, checkpoint). Never list a feature that was not used.
> 3. Record failures honestly: wrong output, a test you made pass the wrong way, anything I had to correct.
> 4. When a property-based test fails, copy the shrunk counterexample and the requirement it traces to into the entry.
> 5. Leave "Model / credits" blank for me to fill in; do not estimate it.
> 6. Update the running tally table at the bottom of KIRO_JOURNEY.md.
> Then create a hook that runs when an agent session stops and prompts you to write that entry, and a custom agent named journey-scribe that only has permission to read the repo and write KIRO_JOURNEY.md.

**Your part of the journey (Kiro cannot do these):**
- At the end of each session run `/usage` in Kiro CLI or check the usage page, and fill in the credits line.
- Screen-record four kinds of moments when they happen, because they cannot be recreated later: a spec turning an EARS line into a correctness property; a property test failing with a shrunk counterexample; a hook firing on save; a checkpoint restore that saved you. Save clips to `media/journey/` with the date in the filename.
- Commit after every session with a message that names the Kiro feature used. The commit history is evidence too.

---

## 2. Build phases

Each phase lists the Kiro surface, the mode, and a starting prompt. Phases map to the schedule in `PLAN.md`.

### Phase A — Weave engine (Nov 17-19). IDE, requirements-first spec with property-based tests

Start a new Spec, choose Feature, Requirements-First, name it `weave-engine`.

> Build the deterministic weave engine in packages/engine. Seed requirements, to be rewritten in EARS:
> - A design is a grid of colour indices, one column per hook and one row per pick, plus a loom profile (hook count, hooks per card row, maximum float length, colour limit).
> - WHEN a design and loom profile are given THE SYSTEM SHALL produce a lift plan and one punch card per pick, with one hole position per hook.
> - WHEN any float on the face or back exceeds the profile's maximum THE SYSTEM SHALL report its row, start column and length.
> - WHEN auto-fix is run THE SYSTEM SHALL add binding points so that no float exceeds the maximum, changing as few cells as possible.
> - WHEN a card set is decoded THE SYSTEM SHALL reproduce the original lift plan exactly.
> - THE SYSTEM SHALL return identical output for identical input.
> - WHEN the design is wider than the hook count or uses more colours than the profile allows THE SYSTEM SHALL reject it with a specific error.
> Run Analyze Requirements before design. In the design, derive correctness properties from these requirements and make every property-based test task required, not optional.

After the spec is generated: read the requirements yourself and fix anything about weaving that looks invented. Then run tasks. When a property test fails, do not let Kiro weaken the test; make it fix the engine. Log it.

**Hook to add once the engine exists:**

> Create a hook that runs the engine test suite whenever a file under packages/engine is saved, and a hook that blocks any tool call that would edit files under packages/engine/test/fixtures.

### Phase B — MCP server and custom agents (Nov 19). IDE or CLI, vibe plus a short spec

> Create packages/mcp: an MCP server over stdio exposing the engine as tools: validate_design, check_floats, auto_fix, build_cards, export_wif. Register it in .kiro/settings/mcp.json. Also add the Context7 MCP server for library documentation and the Chrome DevTools MCP server so you can inspect the running web app.
> Then create two custom agents in .kiro/agents: weave-auditor (read-only; uses the weave MCP tools to audit any design or engine change and reports violations) and design-reviewer (reviews apps/web against design-language.md, including empty, error and mobile states).

From here on, ask the weave-auditor agent to check engine changes. Note in the journey each time it catches something.

### Phase C — Motif input and editor (Nov 20-22). IDE, spec for the pipeline, vibe for the editor feel

New Spec `motif-input`:

> A user types a description or uploads a sketch. The backend asks a language model for a clean vector motif (SVG) limited to the loom profile's colour count, with the chosen symmetry and repeat. The app rasterizes the SVG to the grid at the hook resolution, removes specks smaller than a minimum feature size, and passes the grid to the engine. The user can then edit cells by hand on a point-paper grid. No model key may reach the browser. Include requirements for failure cases: model timeout, invalid SVG, too many colours.

Use vibe mode for the grid editor's interaction details (drag to paint, undo, zoom) and say so in the journey: this is your spec-versus-vibe comparison.

### Phase D — Simulator and exports (Nov 23-25). IDE, spec

New Spec `simulate-and-export`:

> Render a fabric simulation of the woven cloth from the lift plan and yarn colours on a canvas. Export: (1) the punch-card set as SVG and PDF, numbered, in lacing order, using the loom profile's card layout; (2) a classic point-paper sheet; (3) a WIF file. Add properties: the WIF round-trips to the same lift plan; the number of cards equals the number of picks; every card has exactly the profile's number of hole positions.

Then, by hand: open the exported WIF in a weaving tool you did not write and screen-record it. If it does not open correctly, start a **Bugfix spec** in Kiro with what you saw; that gives you a real bugfix-spec story.

### Phase E — Physical proof (Nov 26-27). You, plus a bugfix spec

Print the cards, punch a few, weave the swatch from the lift plan, film it. Anything the swatch exposes (a long float the checker missed, a mirrored pattern) goes into a Bugfix spec. This is the best material for the video.

### Phase F — Kiro as a product (Nov 28-29). IDE, CLI, Web, optional Crew

**Power**

> Package a Kiro Power named "loom" in a power/ folder using the Agent Plugin format: plugin.json, a skills folder with a skill for designing and validating woven patterns, and an mcp.json that registers the weave MCP server. Write install instructions for adding it from GitHub. Then tell me how to test it in a fresh empty workspace.

Test it in an empty folder and record the screen: a different Kiro workspace designing a valid pattern through the Power is the proof that the configuration is a product.

**Workflow**

> Create a workflow in .kiro/workflows named release-check that runs, in order: engine tests, the weave-auditor agent over the example gallery, the design-reviewer agent over apps/web, and a build. Run the first two in parallel if the format allows.

**CLI headless in CI**

> Add a GitHub Actions workflow that, on every push, runs Kiro CLI in non-interactive mode with read-only tools to check that the changed code still satisfies the requirements in .kiro/specs, and posts the result as a job summary. Read the API key from a repository secret; never write it to a file.

You add the secret in GitHub settings yourself.

**Web automation**: in Kiro Web, schedule a daily task that regenerates the example gallery and opens a pull request. Take a screenshot of the first PR it opens.

**Crew (optional, separate repo, $1,000 bonus)**: run `kiro-cli crew`, then build a small Crew app in its own new repository on the same GitHub account, for example a "design desk" that takes a pattern request and returns a validated card set through the weave MCP server. Only attempt this if everything above is done by Nov 29.

### Phase G — Polish and deploy (Nov 30 - Dec 1). IDE, vibe

> Run the design-reviewer agent over apps/web and fix every finding: first-run experience with a gallery of finished examples, empty and error states, mobile layout, keyboard access. Add a visible note that the card format is a configurable profile and has not been tested on a working loom. Then deploy to AWS and give me the URL.

Click through the live URL on a phone and on a laptop you did not build on.

### Phase H — Write-up (Dec 2). IDE or CLI

> Using only KIRO_JOURNEY.md and the git history, draft the submission's "how Kiro was used" write-up, answering these eight questions in order: IDE/CLI/Web/Crew; custom agents; agent hooks; spec-driven development versus vibe coding; steering; MCP; property-based testing; Powers. Use real counts and real incidents with commit references. Do not include anything that is not in the journey or the history.

Rewrite it in your own voice before submitting. The Social Blitz prize is judged on original thoughts versus AI writing, so write the social post yourself.

---

## 3. Using the 4,000 credits

You said you want to use them fully. Spend them where judges look:

- The engine design and property tests: use a strong model and high effort here. This is the part judges will read.
- Let agents review each other (weave-auditor, design-reviewer) rather than skipping review to save credits.
- Use a cheap model for scaffolding, docs and boilerplate.
- Keep about 400 credits untouched until Dec 1 for last-week fixes. Credit requests close Dec 1, 12:00 PM PT.
- After the first full session, compare credits used with the budget table in `PLAN.md` and adjust.

---

## 4. Demo video plan (under 3 minutes, target 2:50)

Rules: public on YouTube, shows the app on the device it was built for, no copyrighted music, no third-party trademarks or logos (crop other tools' windows to the content and refer to them generically).

| Time | Shot | What you say |
|---|---|---|
| 0:00-0:15 | Your hand holding a stack of punched cards, then the app | "In 1804 this was the first computer program. Computers gave it up. Looms never did. I taught AI to write it." |
| 0:15-0:30 | Point-paper sheet, a card being punched | Who draws designs today and how slow it is, in one sentence. Then: "I am not a weaver, so I had to prove this works." |
| 0:30-1:20 | Live app, one take | Type a motif. Design appears on the grid. The float checker flags long floats in red. Auto-fix. Simulated cloth. Export the card set. |
| 1:20-1:40 | Exported file opening in an independent weaving tool, then the hand-woven swatch beside the simulator | "A tool I did not write reads it. And this is the cloth, woven by hand from those cards." |
| 1:40-2:35 | Kiro journey, four short clips recorded during the build, with the tally from KIRO_JOURNEY.md on screen | (1) An EARS requirement becoming a correctness property. (2) A property test failing with a shrunk counterexample, and the bug it found. (3) A hook firing on save and the auditor agent catching something. (4) The "loom" Power installed in an empty workspace, designing a valid pattern. One sentence on where specs beat vibe coding and where they did not. |
| 2:35-2:50 | Live URL and repo on screen | What it is, that it is open source, and one line on what comes next. |

Recording notes:
- Record journey clips as they happen (see section 1). You cannot stage a first failure afterwards.
- Record the app demo last, on the deployed URL, in one continuous take.
- Add captions; many judges watch without sound.
- Keep the Kiro section to under a minute; the write-up carries the detail.
- Trim with ffmpeg or any editor; export 1080p.

---

## 5. When to come back here

Bring back to this chat: the generated requirements for a sanity check before you run tasks; any property-test failure you do not understand; the draft write-up and video script for review; and the final submission checklist on Dec 2.
