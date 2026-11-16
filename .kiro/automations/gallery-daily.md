# Kiro Web scheduled task: regenerate the gallery daily

Created by Tushar in Kiro Web (app.kiro.dev → Schedule → Create scheduled task). The agent did not create it: it runs on paid credits and needs a Kiro Web sign-in (kiro-product Requirement 5).

- Name: `jacquard gallery daily`
- Repository: `TusharTechs/jacquard`
- Schedule: Daily, 02:00 UTC
- Status: Active once created

## Prompt (paste into the task)

```
In the JACQUARD repository, regenerate the example gallery and open a pull request only if it changed.

1. Run `pnpm install --frozen-lockfile`.
2. Run `pnpm gallery` to rewrite apps/web/public/gallery from scripts/gallery/generate.ts.
3. Run `pnpm --filter @jacquard/web test` and `pnpm --filter @jacquard/engine test`, each followed by `; echo "EXIT_CODE=$?"`. Both must show EXIT_CODE=0 and no failed tests. If either fails, do not open a pull request; report the failing test names instead.
4. If `git status --porcelain apps/web/public/gallery` shows changes, open a pull request titled "Gallery: regenerate examples" that lists, for each changed example, its id, the violations before auto-fix, the flips and the violations after (from the example's `check` field). Do not change any other file.
5. Do not edit packages/engine/test/fixtures, .kiro/, or KIRO_JOURNEY.md.

If nothing changed, do nothing.
```

Take a screenshot of the first pull request it opens for the journal (`BUILD_PLAYBOOK.md`, Phase F).
