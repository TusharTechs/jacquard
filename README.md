# JACQUARD

Punch cards are dead as a computing medium. Handlooms still use them, and JACQUARD helps designers and card punchers make them: describe or sketch a motif, edit it on point paper, check the floats, watch a stylised 3D loom weave it, and print the punch-card set.

**Live site:** https://main.d28e9v65r7sow0.amplifyapp.com

The live site is a static build. Motifs come from a deterministic stand-in generator that runs in the browser, labelled "Stand-in motif (model not connected)"; a sketch is not traced without the model. The card format is a configurable loom profile and has not been tested on a working loom.

## Repository

- `packages/engine`: the weave engine (lift plan, float check, auto-fix, cards), pure TypeScript.
- `packages/motif`, `packages/export`, `packages/mcp`: motif parsing and the stand-in, exports (card sheets, point paper, WIF), and the weave-engine MCP server.
- `apps/web`: the Studio (Design, Check, Weave, Cards).
- `backend`: the model proxy (not deployed).
- `power/`: the `loom` Kiro Power. `.kiro/`: specs, steering, hooks, agents.

## Commands

- `pnpm install`, `pnpm typecheck`, `pnpm test`
- `scripts/deploy-web.sh`: build, test and deploy the static site to AWS Amplify Hosting (us-west-2).

## Licence

MIT, see `LICENSE`.
