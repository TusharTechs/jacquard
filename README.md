# JACQUARD

Punch cards are dead as a computing medium. Handlooms still use them ([sources](#sources)), and JACQUARD helps designers and card punchers make them: describe or sketch a motif, edit it on point paper, check the floats, watch a stylised 3D loom weave it, and print the punch-card set.

**Live site:** https://main.d28e9v65r7sow0.amplifyapp.com

The live site is a static build with no AI. "Describe a motif" uses a motif builder, not AI: it reads the description with a small fixed grammar (subjects such as lotus, peacock, star, paisley or elephant; counts, symmetry, size, layout, ground and up to four colours), shows what it understood as editable chips, and draws clean shapes in the browser. A sketch is not traced on the live site; it gives a pattern made from the file. The design is saved in the browser across reloads. The card format is a configurable loom profile and has not been tested on a working loom.

The model path is built but off: `backend/` proxies motif requests to Amazon Bedrock and needs Bedrock model access on the AWS account, which this deployment does not have. With a backend URL set (`VITE_API_BASE`), the app uses it and labels model motifs as suggestions.

## Repository

- `packages/engine`: the weave engine (lift plan, float check, auto-fix, cards), pure TypeScript.
- `packages/motif`, `packages/export`, `packages/mcp`: motif parsing, the motif builder and the stand-in, exports (card sheets, point paper, WIF), and the weave-engine MCP server.
- `apps/web`: the Studio (Design, Check, Weave, Cards).
- `backend`: the Bedrock model proxy (built and tested, not deployed; needs Bedrock model access).
- `power/`: the `loom` Kiro Power. `.kiro/`: specs, steering, hooks, agents.

## Commands

- `pnpm install`, `pnpm typecheck`, `pnpm test`
- `scripts/deploy-web.sh`: build, test and deploy the static site to AWS Amplify Hosting (us-west-2), with the security and cache headers in `scripts/amplify-custom-headers.yml`.

## Sources

That handlooms still weave from punched cards is stated in published sources; we have not checked it on a working loom:

- District Varanasi, Government of Uttar Pradesh, [Banaras Brocades and Sarees](https://varanasi.nic.in/district-produce/banarasi-saree/) (GI product page): the sarees are woven on the conventional Banaras hand loom jacquard.
- The Times of India, 20 June 2023, [a handwoven Banarasi installation in India's new Parliament building](https://timesofindia.indiatimes.com/life-style/fashion/buzz/32-feet-long-handwoven-installation-by-tilfi-banaras-on-display-at-indias-new-parliament-building/articleshow/101104214.cms), translated onto the loom with Jacquard punch cards.

## Credits

- Demo video narration: a synthetic voice, Kokoro-82M (hexgrad, Apache-2.0 licence), run locally (`video/voice/tts/`). The words are the builder's own script.

## Licence

MIT, see `LICENSE`.
