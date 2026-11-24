# Design Document: deploy-static

## Motif path

`apps/web/src/lib/motif-local.ts` (lazy): `localStandIn(request)` mirrors `backend/src/core.ts` for the Stand_In: `validateMotifRequest` → `standInMotif` → `parseMotif(svg, colourCount)` → `{ svg, palette, source: "standIn" }`; an invalid request returns the same `REQUEST_INVALID` body. `motif-client.ts` gains `localMotifs()` (`PROD` and no `VITE_API_BASE`) and an option `local`; when local, `requestMotif` imports `motif-local` (abortable) instead of fetching, and maps an invalid request through the existing `requestMessage`. `app.tsx` passes `online || localMotifs()` to the motif panel, and the offline banner drops "Generating a motif needs the network" when local. `motif-panel.tsx` shows the sketch note before generating when local. The chunk is prefetched on idle in the Static_Build, so generating works offline after the first load.

### Property 1: The in-browser stand-in equals the backend's

For any request (valid: text prompts of 1 to 500 code points or sketches of random PNG/JPEG bytes, colour counts 2 to 8, every symmetry, repeats 8 to 400; and invalid ones: empty prompts, bad colour counts, unknown symmetry, bad repeats): when the backend returns 200, `localStandIn` returns a response deep-equal to the backend body; when it returns 400, `localStandIn` returns the same `REQUEST_INVALID` code and field.
**Validates: Requirements 1.2, 1.3**

## Hosting

`scripts/deploy-web.sh` (bash, `set -euo pipefail`):
1. `pnpm --filter @jacquard/web typecheck`, `pnpm test`, then `vite build` with `VITE_API_BASE` unset.
2. Zip `apps/web/dist` contents (index.html at the root) to a temporary file.
3. App id from `.deploy/amplify-app-id`; if missing, reuse an app named `jacquard` (`list-apps --query`) or `create-app --name jacquard --platform WEB`; write the id.
4. Branch `main`: `get-branch`, else `create-branch`.
5. `create-deployment` → `jobId`, `zipUploadUrl` (queried fields only); `curl --upload-file` to the URL; `start-deployment`; poll `get-job` until `SUCCEED` or `FAILED`.
6. Print `https://main.<app id>.amplifyapp.com`.

Every AWS call uses `--region us-west-2` and `--query` with `--output text`.

## Privacy check

`scripts/check-no-account-id.sh` reads the account id with `aws sts get-caller-identity --query Account --output text` into a variable, never prints it, and greps tracked and new unignored files (`git ls-files -co --exclude-standard`) and the last commit message for it; it prints only a count and exits 1 when it finds any.
