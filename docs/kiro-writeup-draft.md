Draft generated from KIRO_JOURNEY.md and git history on 2026-11-16.
Rewrite in your own voice before submitting.

# How Kiro was used to build JACQUARD

## 1. IDE, CLI, Web, Crew

Almost all the work happened in the Kiro IDE: 71 commits and five phase tags (`phase-B`, `phase-C`, `phase-D`, `phase-F`, `phase-G`).

The CLI was used once. Kiro CLI 3.3.0 ran the `spec-checker` agent headless on this machine over 25 changed files and ended with `VERDICT: PASS` (`1942203`, output in `media/journey/2026-11-16-kiro-cli-spec-check-local.txt`). The GitHub Actions job that runs the same command, `.github/workflows/kiro-spec-check.yml`, has never run. It is guarded by `KIRO_CI_ENABLED` and needs a `KIRO_API_KEY` secret, and neither is set yet.

For Kiro Web, a scheduled-task prompt exists in `.kiro/automations/gallery-daily.md`. The task itself was not created, because it spends credits and needs my sign-in. Crew was skipped on purpose.

## 2. Custom agents

The repo has five custom agents.

- `weave-auditor` has read access plus the six tools of our own MCP server. It ran five times, at the end of Phases B, C, D, F and G. It never found a float violation or a card round-trip error. Its findings were unlabelled loom facts: 2 in Phase C, 1 in Phase D and 2 in Phase F (`cfa6581`, `722a571`, `2bad8f1`). In Phase B it flagged a fragility, profiles paired by list position, which was fixed (`e021bdb`).
- `design-reviewer` is read-only. It ran five times and reported 15, 11, 12, 15 and 3 findings, all fixed (`cfa6581`, `722a571`, `2bad8f1`, `9202ff6`). The Phase C high finding was a screen that still showed violations auto-fix had just removed. I had noticed that problem in wave 4 and left it for the reviewer.
- `spec-checker` ran once, in the local CLI run above.
- `release-runner` belongs to the `release-check` workflow, which has not run.
- `journey-scribe` was created in `f04bfb7`.

Kiro's built-in `introspect` agent answered format questions for the Power, workflow and CLI in Phase F.

## 3. Agent hooks

There are three hooks: a fixture guard (PreToolUse), a typecheck-and-test hook on save, and a Stop hook that prompts for a journal entry.

For the first part of the day no hook ran at all. Live tests failed, and I changed matchers based on guesses (`e331dca`). The actual cause was workspace trust: Kiro had disabled hook execution for an untrusted folder (`023c8f3`). Once the folder was trusted, the guard blocked a hand test that wrote to a fixture file.

The save hook caught two real type errors, in tasks 10.5 and 9.6. Both were the same wrong import of types from `src/index.js`. The log shows `typecheck=1` and then `typecheck=0` seconds later (`5d20b28`, `25ee04e`). I cannot tell whether the hook output or the task's own typecheck prompted each fix. The guard allowed the three new golden fixtures in task 11.5, as designed. After autopilot started, it checked 286 file-tool calls and blocked none.

The Stop hook first worked as intended in wave 7, where it held back while later tasks in the wave were pending (`d284ed7`). In wave 0 it had written nothing. It also fired inside the headless CLI run and appended text to the `VERDICT: PASS` line.

The hooks have a weakness: sub-agents, and once I, edited files through the shell (`cat >>`, `sed -i`, Python scripts), and the hooks cannot see shell commands.

## 4. Spec-driven development versus vibe coding

There are five specs: `weave-engine`, `weave-mcp`, `motif-input`, `simulate-and-export` and `kiro-product`. All their tasks are checked. Their designs list 34, 16, 14 and 11 correctness properties, and `kiro-product` has none.

For the engine I did the requirements gap analysis by hand. I used Kiro's Analyze Requirements once, on `weave-mcp`. It raised one question, and requirement 14.9 was split (`9d9efb5`). From that commit on, the `autopilot.md` steering file let specs go from requirements to tasks without stopping for my approval.

Specs earned their keep where the design was wrong:

- The 24 × 24 lattice example test showed that the auto-fix design assumed the pick count is a multiple of the lattice size. The sub-agent stopped and asked instead of loosening the test (`584743a`).
- Writing the protocol tests showed the MCP SDK rejects array arguments before our handler sees them (`11393d7`).
- Speck removal as designed took 6.5 s on a 120 × 120 grid and was rewritten (`d90998d`).

Vibe mode handled setup, hook tooling, the point-paper editor's feel (`8007f27`) and the Phase G polish (`9202ff6`). On screen it found a 3 px sideways scroll at 360 px, wrapping labels and a keyboard-cursor race, none of which the spec covered.

The spec process also slipped:

- Tasks 10.4 and 10.9 started before their dependency and had to be reset (`8526844`).
- Waves 5 and 9 and the `motif-input` scaffolding were committed before their journal entries (`450c7f9`, `56167d6`, `9517373`).
- I tagged `phase-C` before rerunning the tests.

## 5. Steering

There are seven steering files. Five are always on (`product`, `tech`, `structure`, `journey`, `autopilot`). Two are file-matched: `weaving-domain` for the engine and `design-language` for the web app.

Several rules came from mistakes. The shell tool reported `Exit Code: -1` for every command, so `tech.md` now makes every command echo `$?` (`0f571f9`). After a task left 8 type errors in a file it did not own, `tech.md` gained a rule that every task must finish with both typecheck and tests passing. In wave 6, two of the three tasks still did not follow that rule.

`weaving-domain.md` rule 9 put rasterizing into a new package, `@jacquard/motif`. `design-language.md`'s "never silently export" drove the Phase D export gate.

The user corrected me twice in this area. Once I spent about seven shell commands searching Kiro's app bundle, which nobody had asked for, until I was stopped. Another time I repeated a sub-agent's claim that `design-language.md` was empty without opening the file. It has 36 lines.

## 6. MCP

Three servers are registered in `.kiro/settings/mcp.json` (`abb1267`).

- `jacquard-weave` is our own. It wraps the engine as six tools with SDK 1.32.2. `weave-auditor` called it live in every review, starting at `phase-B`. The playbook's `export_wif` tool was never added.
- `chrome-devtools` ran the 360 px checks in Phases C, D and G. Its screenshots could not be saved into the repo, because the repo is outside the server's roots.
- `context7` is registered but was never used.

In the Phase C check, the first version of the journal entry said the dev servers were stopped and `lsof` showed nothing. That was false: I wrote it before reading the output, and both servers were still listening. The correction is in `3e987f6`.

## 7. Property-based testing

The project has 75 properties in 68 `*.property.test.ts` files: engine 34, mcp 16, motif 14, export 11. For the engine, Kiro's task runner recorded 28 property results. Properties 1 to 6 ran in chat, so Kiro has no record of them.

No property test has yet found a product bug. Six failures were mistakes in the tests themselves:

- Engine P33: a wrong import. The task report then said it "passed on its first real run" (`584743a`).
- Engine P32: `structuredClone` dropped null prototypes (`5d8e75a`).
- mcp P4: a `__proto__` key in a test helper (`a351561`).
- mcp P6: a wrong outcome label (`a146842`).
- mcp P15: the same null-prototype snapshot mistake as P32, made again (`7bc5ed2`).
- motif P12: an "over-long" prompt generator that was not over-long (`b0ee902`).

Each counterexample is recorded verbatim in the journal.

Planted-bug checks are not counted. A one-character off-by-one in `checkFloats` was caught by Properties 18 and 23 within a few cases (`1f42d8d`). Seven export bugs planted by a sub-agent were all caught, as were planted bugs in the motif, backend and web packages. The one design error found by a test came from an example test, not a property.

## 8. Powers

No Power was used. One was shipped: `power/` (the `loom` Power), with `plugin.json`, `mcp.json`, two skills and a bundled server (`a5a9165`, tag `phase-F`). `packages/mcp/test/power.test.ts` starts the bundle from a folder with no `node_modules` and lists its six tools.

The Power has not been installed in a fresh workspace yet. That is my manual step. The server also still names itself `jacquard-weave` while `mcp.json` calls it `loom`.

## 9. The motif step on the live site

Amazon Bedrock needs a paid plan on the AWS account used, so the live site has no model. Until the `motif-builder` spec, "Describe a motif" there gave a stand-in pattern picked from a hash of the words, so "a lotus with four petals" came out as stripes. The motif builder (spec `motif-builder`, tag `phase-motif`) reads the description with a fixed grammar, shows what it understood as editable chips and draws polygons that go through the same rasterize, speck and symmetry steps as before. It is labelled "Motif builder, not AI". The Bedrock path in `backend/` is built and tested but off.

Four properties cover it: the description reader is total and deterministic; builder output is valid motif SVG with every palette colour still present after the pipeline; every builder motif passes the float check after auto-fix on the default profile; and the saved design round-trips through localStorage. Property 2 found a bug on its first run: a paisley border mirrored top to bottom lost all its figures. The first peacock (a front view with a fanned tail) passed every test and still did not read as a peacock on the live site; it was redrawn as a side view.

## Not yet done

- The `release-check` workflow has not run, because workflows are off by default.
- The WIF export has not been opened in an independent weaving tool.
- The model path is not deployed: Bedrock model access is not available on the account. The live site (AWS Amplify Hosting) uses the motif builder.
- The card format has not been tested on a working loom.
