# loom: a Kiro Power for Jacquard punch cards

Punch cards are dead as a computing medium, but handlooms still weave from them. This Power lets Kiro design a woven pattern and write the punch-card set for it.

The card format is a configurable loom profile and has not been tested on a working loom. The Power assists the designer and the card puncher; it does not replace them.

## What it contains

- `mcp.json`: starts the `loom` MCP server with `node ${PLUGIN_ROOT}/dist/server.js`. No API key, no environment variables, no network.
- `dist/server.js`: a single-file build of `@jacquard/mcp` from this repository, with the weave engine and the MCP SDK bundled in. It runs with plain `node` (version 22 or later) and needs no `node_modules`. `dist/package.json` only marks the file as an ES module.
- Six tools: `list_profiles`, `build_lift_plan`, `check_floats`, `auto_fix`, `build_cards`, `decode_cards`.
- Two skills:
  - `design-woven-pattern`: design grid, weaves per region, loom profile, lift plan.
  - `check-floats-and-cards`: float check, auto-fix, card set, decode round trip.

Every loom fact the tools report carries a label: [sourced] (stated in a 1909 source, not checked on a loom), [convention], [decision] or [to verify].

## Install

You need Node.js 22 or later on your `PATH`.

### From a local folder (reliable)

1. Clone the repository: `git clone https://github.com/TusharTechs/jacquard`.
2. In Kiro IDE, open the Powers panel, choose **Add Custom Power**, then **Import power from a folder**, and pick the `power/` folder of the clone (the folder that holds `plugin.json`).
3. With Kiro CLI: `kiro-cli powers install <path-to-clone>/power`.

### From GitHub

In Kiro IDE, open the Powers panel, choose **Add Custom Power**, then **Import power from GitHub**, and give the repository URL `https://github.com/TusharTechs/jacquard`. The Power lives in the `power/` folder of the repository, not at its root. The Kiro documentation says a power may live in a folder of a repository with `plugin.json` at that folder's root, but it does not say which URL form selects the folder (for example a `/tree/main/power` URL). If the GitHub import does not find the Power, use the local-folder route above.

## Test it in a fresh empty workspace

1. Create an empty folder and open it in Kiro.
2. Install the Power by one of the routes above.
3. Check that the `loom` MCP server shows as connected with six tools.
4. Ask: "Design an 8 by 8 two-region pattern for a 16-hook custom loom, check floats, fix them and give me the card set".

What to expect:

- Kiro picks up the two skills and calls `build_lift_plan` with an 8 by 8 design, a weave for each of the two regions and a custom profile such as `{"hookCount":16}`.
- `check_floats` returns a list of violations. With the default max float of 8 [decision] and short weaves such as plain and twill 1/3, the list is usually empty and `auto_fix` is not needed. With a tighter limit or a long-float weave, `auto_fix` reports the flipped cells and a second `check_floats` returns an empty list.
- `build_cards` returns 8 cards numbered 1 to 8 in lacing order, each with 16 positions in 2 rows of 8, and `decode_cards` gives back the same lift plan.
- Kiro's answer says that the card format has not been tested on a working loom.

The two skills contain a worked example of exactly this request, run through the bundled server.

## Rebuilding the server

From the repository root: `pnpm --filter @jacquard/mcp build:power`. A test in `packages/mcp/test/power.test.ts` fails when the committed `dist/server.js` differs from a fresh build.

## Licence

MIT. See `LICENSE` at the repository root.
