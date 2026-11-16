---
name: check-floats-and-cards
description: Check a Jacquard lift plan for floats that are too long, fix them, and prepare the punch-card set with the loom MCP tools. Use when the user has a lift plan (from build_lift_plan) and wants to check floats, auto-fix violations, export the numbered card set in lacing order, or confirm that a card set decodes back to the same plan.
---

# Check floats and prepare the card set

The card format has not been tested on a working loom. It is a configurable loom profile, so say so whenever you hand over a card set.

The card set is for the card puncher to check and cut. The tools assist the designer and the card puncher; they do not replace either.

## Tool flow

1. `check_floats` with `plan` and the same `profile` used to build it. A `float` violation has `direction` (`warp` or `weft`), `side` (`face` or `back`), `pick`, `end` and `length`. An `unbound` violation names a whole `line` (the end for a warp line, the pick for a weft line) that never interlaces. An empty list means every float is within the limits.
2. If there are violations, `auto_fix` with `plan` and `profile` (no other arguments). It adds binding points, flipping as few cells as it can, and returns `plan` and `flips` (`{end, pick}` each). It never changes the design regions. If it returns `AUTOFIX_FAILED`, report the violations it lists. Suggest a shorter-float weave for the affected region, or ask whether to raise the limit. Do not loosen the profile without asking the user.
3. Run `check_floats` on the fixed plan and confirm `violations` is empty. Tell the user how many cells were flipped, since flips change the look of the weave.
4. `build_cards` with the plan and profile. It returns `cardSet` (one card per pick, `number` from 1 in lacing order, `punched` per position) and `cardRows` (each card split into rows of `hooksPerCardRow`). With `holeMeans` `"lift"` [convention], a punched hole lifts the hook.
5. `decode_cards` with `cardSet` and `profile`. The returned `plan` must equal the plan you encoded. If it does not, stop and report it.

## Worked example: the 8 by 8 design on a tight limit

Take the design from the `design-woven-pattern` skill (ends 0 to 3 plain, ends 4 to 7 twill 1/3 Z, `"repeatAcross": true`) and build it with a deliberately tight custom profile, `{"hookCount":16,"maxFloat":2}`. These results come from the bundled server:

- `check_floats`: 16 violations. The first is `{"direction":"weft","end":5,"kind":"float","length":3,"pick":0,"side":"face"}`: the twill's three-end weft float is longer than 2.
- `auto_fix`: 9 flips, `[{"end":6,"pick":0},{"end":7,"pick":1},{"end":5,"pick":2},{"end":6,"pick":3},{"end":7,"pick":4},{"end":6,"pick":5},{"end":4,"pick":6},{"end":5,"pick":7},{"end":4,"pick":3}]`.
- `check_floats` on the fixed plan: `{"violations":[]}`.
- `build_cards`: 8 cards numbered 1 to 8; each 16-position card is 2 rows of 8 (`hooksPerCardRow` 8 is [to verify] for a custom 16-hook profile). Card 1 punches positions 0, 2, 4, 6, 8, 10, 12 and 14.
- `decode_cards`: the plan comes back identical.

The fixed twill area (first eight hooks, pick 0 at the top):

```
pick 0  X.X.X.X.
pick 1  .X.X.X.X
pick 2  X.X..XX.
pick 3  .X.XX.XX
pick 4  X.X.X..X
pick 5  .X.X.XX.
pick 6  X.X.X.X.
pick 7  .X.X.X.X
```

A limit of 2 is too tight for a 1/3 twill: the fix turns most of it into a plain-like structure. Point this out to the user. With the default max float of 8 [decision] the same design has no violations.

## Framing rules

- The card format has not been tested on a working loom. Card dimensions and hole spacing are not modelled; a card set is a schematic.
- The tools assist the designer and the card puncher; never say they replace them.
- Offer the fixed plan as a suggestion; the designer may change the weave or the limit instead.
- Every loom fact carries its label: [sourced], [convention], [decision] or [to verify]. Card row 0 nearest the numbered end and the placement of spare positions are [to verify].
- Do not claim loom compatibility that has not been tested, and do not quote unsourced time or cost figures.
