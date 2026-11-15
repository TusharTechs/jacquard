---
inclusion: always
---

# JACQUARD: structure

## Layout

```
.
├── .kiro/
│   ├── steering/        always-on and file-matched guidance
│   ├── specs/           one folder per feature
│   ├── hooks/           hook JSON files
│   ├── agents/          custom agent JSON files
│   ├── workflows/       release check recipe
│   └── settings/mcp.json
├── apps/
│   └── web/             React SPA
├── packages/
│   ├── engine/          pure TypeScript weave engine
│   │   ├── src/
│   │   └── test/        vitest and fast-check; fixtures in test/fixtures
│   └── mcp/             MCP server wrapping the engine
├── backend/             AWS model-call proxy (Lambda)
├── power/               `loom` Power: plugin.json, skills/
├── research/            competition and prior-art notes (read-only reference)
├── PLAN.md
├── BUILD_PLAYBOOK.md
├── KIRO_JOURNEY.md
├── pnpm-workspace.yaml
└── LICENSE
```

## Naming

- Files and folders: kebab-case (`float-check.ts`, `point-paper-editor.tsx`).
- React components: PascalCase exports, one component per file, file name in kebab-case.
- Types and interfaces: PascalCase. Functions and variables: camelCase. Constants: UPPER_SNAKE_CASE only for true module-level constants.
- Test files sit in `test/` and end in `.test.ts`; property tests end in `.property.test.ts`.
- Packages are scoped `@jacquard/engine`, `@jacquard/mcp`, `@jacquard/web`.
- Spec folders in `.kiro/specs/` use kebab-case feature names.
- Domain terms keep their weaving names in code (`warp`, `weft`, `end`, `pick`, `float`, `liftPlan`). Do not rename them to generic terms like `row` or `column` in the engine.
- Each engine module exports through `packages/engine/src/index.ts`; nothing outside the package imports from `src/` internals.

## Rules

- Never add `.kiro` to `.gitignore`.
- Do not put weaving logic in `apps/web` or `packages/mcp`; it belongs in the engine.
- Do not edit anything under `research/` unless asked.
