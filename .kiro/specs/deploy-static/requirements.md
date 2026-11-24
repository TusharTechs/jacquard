# Requirements Document

## Introduction

Scope: put the web app on a public HTTPS URL, as a static site only, so a judge can run the whole flow with nothing failing: gallery, Describe a motif, Upload a sketch, painting, Check, auto-fix, Weave with the 3D loom, Cards, print and every export. Tushar approved AWS resources for a static site only, in us-west-2, with the AWS CLI configured on the build machine. No backend, Lambda, API Gateway or Bedrock in this phase.

Code locations: `apps/web` (an in-browser stand-in path for motifs), `scripts/deploy-web.sh`, `.kiro/settings/mcp.json`, `README.md`, `.gitignore`. `packages/` and `backend/` do not change. Acceptance criteria are cited as `N.M`.

## Glossary

- **Static_Build**: `vite build` of `apps/web` with no `VITE_API_BASE`, as deployed.
- **Stand_In**: the deterministic generator `standInMotif` in `@jacquard/motif`.
- **Backend_Stand_In**: the backend's response for a request when its generator is the Stand_In: `handleMotifRequest` with `createStandInGenerator()`.
- **Local_Stand_In**: the in-browser path that runs the Stand_In without a network call.
- **Amplify_App**: the AWS Amplify Hosting app created for this site, with one branch, `main`.
- **Live_URL**: the branch's default `amplifyapp.com` HTTPS URL.

## Requirements

### Requirement 1: Motifs without a backend

**User Story:** As a judge on the live site, I want Describe a motif and Upload a sketch to work, so that the flow does not fail without a model.

#### Acceptance Criteria

1. WHEN the Static_Build has no `VITE_API_BASE`, THE motif client SHALL produce motifs with the Local_Stand_In and SHALL NOT call `/api/motif`. Development (`vite`), tests and builds with `VITE_API_BASE` SHALL keep calling the backend as today.
2. FOR every request, valid or not, THE Local_Stand_In SHALL return what the Backend_Stand_In returns: the same `svg`, `palette` and `source` for a valid request, and the same `REQUEST_INVALID` rejection for an invalid one (Property 1).
3. THE result SHALL carry the same labels as today: "Stand-in motif (model not connected) — edit it freely", and for a sketch "The stand-in does not trace your sketch. It picks a pattern from the file's bytes."
4. ON the Upload a sketch tab of the Static_Build, BEFORE generating, THE panel SHALL say plainly that without the model a sketch is not traced and the stand-in makes a pattern from the file instead.
5. THE Local_Stand_In SHALL be a lazy chunk; the entry chunk SHALL grow by at most 2 kB gzip.
6. IN the Static_Build, generating SHALL not depend on the network once the chunk is loaded, and the offline notes SHALL not say that generating needs the network.

### Requirement 2: Hosting

**User Story:** As Tushar, I want the site on AWS with one repeatable command, so that I can redeploy safely.

#### Acceptance Criteria

1. THE site SHALL be hosted on AWS Amplify Hosting with a manual deployment (a zip of `apps/web/dist`), with no repository connection, in us-west-2, on the default `amplifyapp.com` domain.
2. `scripts/deploy-web.sh` SHALL build, test, zip, create a deployment, upload the zip, start the deployment, wait for it, and print the Live_URL. It SHALL be idempotent: a rerun reuses the Amplify_App and branch and only adds a deployment.
3. THE Amplify_App id SHALL be kept in `.deploy/amplify-app-id`, which is gitignored.
4. Routing is hash-based, so no rewrite rule is needed: a direct visit to `/#/weave` and a reload SHALL show the Weave Step.
5. No other AWS resource SHALL be created.

### Requirement 3: AWS documentation through MCP

#### Acceptance Criteria

1. `.kiro/settings/mcp.json` SHALL add the AWS Documentation MCP server, `awslabs.aws-documentation-mcp-server` via `uvx`, at an exact version published at least 14 days earlier.
2. THE manual-deploy steps SHALL be checked against the AWS documentation through that server before they run, and its answers recorded in the journal.

### Requirement 4: Verification on the Live_URL

#### Acceptance Criteria

1. THE full flow (1 to 4 above in the Introduction) SHALL be checked on the Live_URL through the Chrome DevTools MCP server at 1440x900 and 390x844, with no console error.
2. Lighthouse performance, accessibility and best practices SHALL each be at least 90 on the Live_URL.
3. Screenshots SHALL be saved under `media/deploy/`.

### Requirement 5: Secrets and privacy

#### Acceptance Criteria

1. THE AWS account id, access keys, ARNs that contain the account id and the Amplify console URL SHALL NOT appear in the repository, the journal, screenshots or commit messages. The Live_URL may.
2. Scripts SHALL select only the fields they need from AWS CLI output (`--query`), so ARNs are never printed.
3. A check before each commit SHALL confirm the account id does not occur in tracked or new files, without printing it.

### Requirement 6: Costs

#### Acceptance Criteria

1. THE journal SHALL list every AWS resource created and its expected monthly cost.

## Decision log

| Q | Answer | Label |
|---|---|---|
| When is the motif path local? | `import.meta.env.PROD` and no `VITE_API_BASE`: the deployed build. `vite` dev keeps its proxy to the local backend (which can run Bedrock), and tests (not PROD) keep the fetch path, so the motif-client tests do not change. A `local` option on `requestMotif` lets tests exercise the local path. | [decision] |
| Does Upload a sketch "work" without a model? | It produces a stand-in motif from the file's bytes, which is what the backend's stand-in does today; it does not trace the sketch. The panel says so before and after generating (1.3, 1.4), so nothing is faked. | [decision] |
| Amplify app name | `jacquard`. An app named `tab-net-terms` already exists in the account; it belongs to another project and is not touched. | [decision] |
| AWS Documentation MCP version | 1.2.5 (PyPI, 2026-11-09 21:57 UTC); 1.2.6 (2026-11-17) is under 14 days old. | [decision] |
| Screenshots | The Chrome DevTools MCP server cannot write files into the repository (its roots exclude it, as in studio-experience), so checks run through it and the saved set in `media/deploy/` is captured with `puppeteer-core` against the same Live_URL. | [decision] |
| Print on the Live_URL | The browser print dialog is not driven by the MCP server; the print sheet is checked by the `beforeprint` path and `window.print` being called. | [decision] |
