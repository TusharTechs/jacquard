---
name: design-woven-pattern
description: Design and validate a woven pattern for a Jacquard handloom with the loom MCP tools. Use when the user wants to turn a motif, a point-paper grid or a description into a design grid of weave regions, choose a binding weave (plain, twill or satin) for each region, pick a loom profile (120, 240 or 400 hooks, or a custom hook count) and build a lift plan.
---

# Design a woven pattern

The card format has not been tested on a working loom. It is a configurable loom profile, so say so whenever you hand over a lift plan or a card set.

These tools assist the designer and the card puncher. They do not replace either, and nothing here has been checked on a real loom.

## Words

- **End**: one warp thread, one column of the design. End 0 is the leftmost [convention].
- **Pick**: one pass of the weft, one row of the design. Pick 0 is the first pick woven and is drawn at the bottom of point paper [convention].
- **Region**: an integer in the design grid. It labels a weave area, not a yarn colour.
- **Float**: a thread passing over or under several crossing threads without interlacing.

## Tool flow

1. `list_profiles`: read the built-in profiles. Every field comes with a label. Keep the label when you repeat a value to the user (for example "max float 8 [decision]"). A custom profile is an object with at least `hookCount`. If its `hookCount` is 120, 240 or 400, it starts from that built-in profile. Any other `hookCount` starts from fallback defaults: 8 hooks per card row [to verify], 0 spare hooks [to verify], max float 8 [decision], region limit 4 [decision], holes mean lift [convention]. Read the values with `list_profiles` and from any `PROFILE_INVALID` errors.
2. Make the design grid: `design[pick][end]`, one row per pick with pick 0 first, one integer region per end with end 0 first. Use at most `regionLimit` regions (4 by default).
3. Choose one weave per region, keyed by the region number as a string:
   - `{"kind":"plain"}`
   - `{"kind":"twill","up":1,"down":3,"direction":"Z"}` (direction `S` or `Z`)
   - `{"kind":"satin","size":5,"move":2,"facing":"weft"}` (size 5 with move 2 or 3, size 8 with move 3 or 5 [convention]; facing `warp` or `weft`)
4. `build_lift_plan` with `design`, `weaves`, `profile` and, to fill every hook with the repeat, `"repeatAcross": true`. Read `idleHooks` and `warnings` in the result. A `WEAVE_PERIOD_SEAM` warning means the weave does not tile evenly across the repeat.
5. Hand the plan to the `check-floats-and-cards` skill: `check_floats`, `auto_fix` if needed, `build_cards`, `decode_cards`.

Engine errors come back unchanged, with a stable `code` (for example `PROFILE_INVALID` or `ARGUMENT_INVALID`). Report the code and the message; do not guess around them.

## Worked example: 8 by 8, two regions, 16-hook custom loom

Region 0 (ends 0 to 3) is plain, region 1 (ends 4 to 7) is twill 1/3 Z. This call was run through the bundled server:

```json
{
  "design": [
    [0,0,0,0,1,1,1,1],
    [0,0,0,0,1,1,1,1],
    [0,0,0,0,1,1,1,1],
    [0,0,0,0,1,1,1,1],
    [0,0,0,0,1,1,1,1],
    [0,0,0,0,1,1,1,1],
    [0,0,0,0,1,1,1,1],
    [0,0,0,0,1,1,1,1]
  ],
  "weaves": {
    "0": { "kind": "plain" },
    "1": { "kind": "twill", "up": 1, "down": 3, "direction": "Z" }
  },
  "profile": { "hookCount": 16 },
  "repeatAcross": true
}
```

Result: `idleHooks` `[]`, `warnings` `[]`, and a plan with `pickCount` 8, `hookCount` 16, `designWidth` 8. The first eight hooks of each pick (`X` lifts, pick 0 at the top of this list):

```
pick 0  X.X.X...
pick 1  .X.X.X..
pick 2  X.X...X.
pick 3  .X.X...X
pick 4  X.X.X...
pick 5  .X.X.X..
pick 6  X.X...X.
pick 7  .X.X...X
```

Hooks 8 to 15 repeat hooks 0 to 7. With the default limits (max float 8 [decision]) `check_floats` returns `{"violations":[]}`, so no fix is needed. The `check-floats-and-cards` skill shows the same design on a tighter limit.

## Framing rules

- The card format has not been tested on a working loom. The profile is configuration, not a promise of loom compatibility.
- The tools assist the designer and the card puncher; never say they replace them.
- Present the design grid and the weave choices as a suggestion; ask the designer to confirm or change them before building cards.
- Every loom fact carries its label: [sourced] (stated in a 1909 source, not checked on a loom), [convention], [decision] or [to verify]. Do not fill in a [to verify] value from memory.
- A motif is a clean vector drawing with a few colours, reduced to regions; the engine does the weaving work. Do not present a pixelated picture as a design.
- Do not quote statistics about time or cost per design. None are sourced.
