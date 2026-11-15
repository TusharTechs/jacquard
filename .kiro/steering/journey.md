---
inclusion: always
---

# Journey log rules

`KIRO_JOURNEY.md` is the raw material for the Kiroween write-up. These rules apply to the agent (me) in every session.

1. At the end of every task or chat session, append an entry to `KIRO_JOURNEY.md` using the template in that file. Add it under "Entries", above the "Template" heading.
2. Record which Kiro features were actually used in the session: spec name, hook that fired, steering file that mattered, custom agent, MCP tool, property test, checkpoint. Never list a feature that was not used. If none were used, write "none".
3. Record failures honestly: wrong output, a test made to pass the wrong way, anything the user had to correct. Do not soften or omit them.
4. When a property-based test fails, copy the shrunk counterexample and the requirement it traces to into the entry.
5. Leave "Model / credits" blank for the user to fill in. Do not estimate it.
6. Update the running tally table at the bottom of `KIRO_JOURNEY.md`. Count only items that exist in the repo. Do not change the "Credits used" row.

Entry style: plain facts, with file paths, commit hashes or test names as evidence. Do not invent observations the session did not produce. Do not rewrite or delete earlier entries.
