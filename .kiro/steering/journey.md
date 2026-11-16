---
inclusion: always
---

# Journey log rules

`KIRO_JOURNEY.md` is the raw material for the Kiroween write-up. These rules apply to the agent (me) in every session.

1. Append an entry to `KIRO_JOURNEY.md` using the template in that file. Add it under "Entries", above the "Template" heading. When to write one:
   - **Spec tasks run in waves:** write one entry per wave, never one per task or sub-task. While the tasks of a wave are running, in parallel or not, no task writes to `KIRO_JOURNEY.md`. After the whole wave finishes, write a single entry covering every task in it, titled with the spec name and wave id (for example `weave-engine wave 3`).
   - **Any other chat session:** write one entry at the end of the session.
2. Record which Kiro features were actually used in the session: spec name, hook that fired, steering file that mattered, custom agent, MCP tool, property test, checkpoint. Never list a feature that was not used. If none were used, write "none".
3. Record failures honestly: wrong output, a test made to pass the wrong way, anything the user had to correct. Do not soften or omit them.
4. When a property-based test fails, record it in full in the entry for the wave or session it happened in: the property number and title, the shrunk counterexample copied verbatim, the seed, and the requirement it traces to. This is the one item a wave entry must never summarise or shorten. Record every failure, including ones fixed later in the same wave.
5. Leave "Model / credits" blank for the user to fill in. Do not estimate it.
6. Update the running tally table at the bottom of `KIRO_JOURNEY.md`. Count only items that exist in the repo. Do not change the "Credits used" row.

Entry style: plain facts, with file paths, commit hashes or test names as evidence. Do not invent observations the session did not produce. Do not rewrite or delete earlier entries.
