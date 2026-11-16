---
inclusion: always
---

# JACQUARD: tech

## Stack

- pnpm monorepo, TypeScript throughout, strict mode.
- `packages/engine`: pure TypeScript with no runtime dependencies. No DOM, no Node-only APIs, no network. Tested with vitest and fast-check. Output must be deterministic: same input, same bytes.
- `packages/mcp`: MCP server that wraps the engine (validate draft, check floats, simulate, export cards). It adds no weaving logic of its own.
- `apps/web`: React single-page app. Imports the engine as a workspace package.
- Backend: a small AWS backend (API Gateway plus Lambda) proxies model calls. No model key, and no key-bearing request, reaches the browser. Keys live in AWS Secrets Manager or Lambda environment configuration, never in the repo.
- Hosting: AWS Amplify Hosting, or S3 with CloudFront. Never Vercel, Netlify or Lovable.

## Rules

- Dependencies flow one way: `apps/web` and `packages/mcp` depend on `packages/engine`. The engine depends on nothing.
- Do not add a runtime dependency to `packages/engine`. Dev dependencies (vitest, fast-check, typescript) are fine.
- Validate all model output at the boundary before it reaches the engine. The engine rejects malformed input with typed errors rather than throwing strings.
- Engine tests include property-based tests with real invariants: card set to pattern round trip; no float longer than the limit after auto-fix; every warp end is bound; card count equals pick count; export is deterministic.
- Golden fixtures are read-only unless the user asks for a change.
- Use `pnpm` only. Do not create `package-lock.json` or `yarn.lock`.
- Run tests once (`pnpm vitest --run`), never in watch mode.

## Shell exit codes

- In this workspace the shell tool reports `Exit Code: -1` for every command, so that exit code cannot be trusted.
- Append `; echo "EXIT_CODE=$?"` to every shell command and read that value instead.
- For test runs, also read the test runner's summary line (passed and failed counts).
- Never report tests as passing unless both `EXIT_CODE=0` and the summary line show success.

## Commands (update when the scripts exist)

- Install: `pnpm install`
- Test all: `pnpm -r test`
- Typecheck: `pnpm -r typecheck`
