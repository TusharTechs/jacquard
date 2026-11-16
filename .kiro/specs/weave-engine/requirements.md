# Requirements Document

## Introduction

Scope: single-weft figured weave for a mechanical Jacquard loom, implemented as the pure TypeScript package `packages/engine`. Version 1 assumes a single-lift, single-cylinder machine [decision] and has one warp colour and one weft colour.

Out of scope: double-lift machines (the source describes them with twice the hooks), extra-weft (brocade), more than one card per pick, electronic loom formats, peg holes, lace holes and card dimensions (export spec), yarn colour (simulator spec), any model or network call.

Status: **draft 3, not approved.** Design is in `design.md`.

Acceptance criteria are cited as `N.M`: criterion M of Requirement N. The labels in square brackets are defined in the Labels section, and source S1 in the Sources section.

## Glossary

- **Design**: a grid of non-negative integer region indices, `pickCount` rows by `width` columns. Column = end, row = pick. End 0 is the leftmost column. Pick 0 is the first pick woven. The UI draws pick 0 at the bottom [convention].
- **Region**: every cell that has the same region index, connected or not [convention].
- **Weave assignment**: a mapping from region index to a weave: plain, twill or satin.
- **Loom profile**: the configuration record defined in 1.2.
- **Figuring hook**: one of the `hookCount` hooks that carry the design. Hook `h` controls end `h` [sourced, S1: "The hook that passes through the first needle is considered the first thread in the pattern"].
- **Spare hook**: one of the `spareHookCount` extra hooks. Not part of the lift plan in version 1.
- **Lift plan**: a grid of booleans, `pickCount` by `hookCount`. True means the figuring hook lifts and its warp end is raised.
- **Idle hook**: a figuring hook at or beyond the design width, when "repeat across" is off.
- **Card**: one punch card for one pick. It holds `hookCount + spareHookCount` positions.
- **Float**: a run of consecutive cells, in one line of the lift plan, that all have the same lift state (4.1).
- **Analysed width**: the design width. Floats are never measured across idle hooks.
- **Weave period**: 2 for plain, `up + down` for twill, `size` for satin. The weave repeats with this period along both ends and picks.

## Requirements

### Requirement 1: Data model

**User Story:** As a designer, I want designs, weaves and loom profiles to be explicit, validated data, so that the engine fits my loom and every loom fact can be changed without changing code.

#### Acceptance Criteria

1. THE SYSTEM SHALL represent a design as a rectangular grid of non-negative integer region indices, with one column per end and one row per pick.
2. THE SYSTEM SHALL represent a loom profile with these fields:

   | Field | Meaning | Default | Label |
   |---|---|---|---|
   | `hookCount` | number of figuring hooks | 120, 240 or 400 in built-ins | [decision]; 400 also [sourced] |
   | `hooksPerCardRow` | positions in one card row | 8 | 400: [sourced]; 120, 240: [to verify] |
   | `spareHookCount` | spare hooks on the card | 400: 16; 120, 240: 0 | 400: [sourced]; 120, 240: [to verify] |
   | `spareHookPlacement` | where spare positions sit on the card | `"afterFiguring"` | [to verify] |
   | `maxFloat` | maximum float length, in threads | 8 | [decision] |
   | `maxWarpFloat` | limit for warp floats | `maxFloat` | [decision] |
   | `maxWeftFloat` | limit for weft floats | `maxFloat` | [decision] |
   | `regionLimit` | maximum number of distinct regions | 4 | [decision] |
   | `holeMeans` | `"lift"` or `"noLift"` | `"lift"` | [convention], consistent with S1 |
   | `cardFillOrder` | order of positions across card rows | `"ascending"` | slot 0 at top: [sourced]; row 0 at numbered end: [to verify] |
   | `wovenFaceDown` | swaps face and back in reports | false | [decision] |

3. THE SYSTEM SHALL provide built-in loom profiles for 120, 240 and 400 hooks, each with the defaults in 1.2. Each default SHALL carry a code comment with its label, and each `[sourced]` default SHALL cite S1 with its quote.
4. WHERE a custom loom profile is supplied, THE SYSTEM SHALL use it in place of a built-in profile.
5. IF a loom profile has a `hookCount`, `hooksPerCardRow`, `maxFloat`, `maxWarpFloat` or `maxWeftFloat` that is not a positive integer, a `spareHookCount` that is not a non-negative integer, a `regionLimit` that is not an integer from 1 to 8, a `holeMeans`, `cardFillOrder` or `spareHookPlacement` outside the allowed values, or a `wovenFaceDown` that is not a boolean, THEN THE SYSTEM SHALL reject it with an error naming the field and its value. In version 1 the only allowed `cardFillOrder` is `"ascending"` and the only allowed `spareHookPlacement` is `"afterFiguring"`.
6. THE SYSTEM SHALL represent a weave as one of: plain; twill with `up` (ends up), `down` (ends down) and `direction` (`"S"` or `"Z"`); satin with `size` (5 or 8), `move` (2 or 3 for size 5; 3 or 5 for size 8) and `facing` (`"warp"` or `"weft"`).
7. IF a twill has an `up` or `down` that is not a positive integer or a `direction` other than S or Z, or a satin has a `size` other than 5 or 8, a `move` not listed for its size in 1.6, or an invalid `facing`, THEN THE SYSTEM SHALL reject the weave with an error naming the region index, the parameter and its value.

### Requirement 2: Lift plan and cards

**User Story:** As a card puncher, I want a lift plan and a numbered card set in lacing order that decodes back to the same plan, so that the cards I punch weave the design that was drawn.

#### Acceptance Criteria

1. WHEN a valid design, a weave assignment and a loom profile are given, THE SYSTEM SHALL produce a lift plan with one row per pick and one cell per figuring hook. The cell at end `e` and pick `p` is the weave of region `design[p][e]` evaluated at `(e, p)`, and figuring hook `h` carries end `h` [sourced].
2. THE SYSTEM SHALL evaluate a cell only from the weave of the cell's own region, so that a weave never changes a cell outside its region, and SHALL anchor every weave at the design origin (end 0, pick 0).
3. THE SYSTEM SHALL evaluate the weaves as follows. [decision], confirmed
   - Plain: lifted when `(e + p)` is even.
   - Twill, with period `up + down`: direction Z lifted when `(e - p) mod period < up`; direction S lifted when `(e + p) mod period < up`. The modulo is non-negative.
   - Satin, size `n` and move `m`: the binding cell of pick `p` is the end where `e mod n = (m * p) mod n`. Weft-faced: lifted only at the binding cell. Warp-faced: lifted everywhere except the binding cell.
4. WHEN the design is narrower than the hook count and "repeat across" is off, THE SYSTEM SHALL leave every idle hook unlifted on every pick and SHALL list the idle hook indices in the output.
5. WHERE "repeat across" is on and the design width divides the hook count exactly, THE SYSTEM SHALL tile the design over all figuring hooks, so that hook `h` takes the lift value of end `h mod width`, and SHALL list no idle hooks.
6. IF "repeat across" is on and the design width does not divide the hook count, THEN THE SYSTEM SHALL reject it with an error naming the design width and the hook count.
7. WHEN a lift plan is given, THE SYSTEM SHALL produce one card per pick with exactly `hookCount + spareHookCount` positions. A figuring-hook position is punched when the hook lifts and `holeMeans` is `"lift"`, or when the hook does not lift and `holeMeans` is `"noLift"`. An idle hook never lifts, and neither does a spare hook in version 1; their positions are punched or left blank according to `holeMeans` so that they stay down.
8. THE SYSTEM SHALL number card positions from 0. Figuring hook `h` is position `h`. WHILE `spareHookPlacement` is `"afterFiguring"`, spare hook `s` is position `hookCount + s`. THE SYSTEM SHALL lay out each card in `ceil((hookCount + spareHookCount) / hooksPerCardRow)` rows, with position `q` at row `floor(q / hooksPerCardRow)` and slot `q mod hooksPerCardRow`. Slots in the last row beyond the last position are not positions and SHALL never be punched. (For the 400 profile: 416 positions in 52 rows of 8.)
9. WHEN cards are produced, THE SYSTEM SHALL number the card for pick `p` as `p + 1`, keep a 0-based internal index, order the set by pick, and define the successor of the last card as the first card.
10. WHEN a card set is decoded with a loom profile, THE SYSTEM SHALL return a lift plan equal, cell for cell, to the lift plan the cards were built from, whatever order the cards are given in.
11. IF a card set to decode is empty, has a missing number, a duplicate number, or a card whose position count differs from `hookCount + spareHookCount`, THEN THE SYSTEM SHALL reject it with an error naming the problem and the card number. IF a spare position on a card is in the state that means "lift", THEN THE SYSTEM SHALL reject the card set with an error naming the card number and the position. [proposed: the spare-position check]
12. WHEN a region used in the design has a weave period that does not divide `pickCount`, or, WHERE "repeat across" is on, does not divide the design width, THE SYSTEM SHALL return a warning with a stable code naming the region, the weave period, the dimension (`"picks"` or `"ends"`) and its size. Warnings SHALL never block output. THE SYSTEM SHALL list warnings in order of region index, then picks before ends. [convention]
13. IF a lift plan given to the float checker, auto-fix or card builder does not match its profile (wrong row length, rows not equal to `pickCount`, a lifted idle hook, or tiles that differ while "repeat across" is on), THEN THE SYSTEM SHALL reject it with an error naming the problem. [proposed]

### Requirement 3: Validation

**User Story:** As a designer, I want invalid input rejected with a specific, typed error, so that I know exactly what to fix and the app can show it.

#### Acceptance Criteria

1. IF the design width is greater than the profile hook count, THEN THE SYSTEM SHALL reject it with an error that states the design width and the hook count.
2. IF the number of distinct region indices in the design is greater than the profile region limit, THEN THE SYSTEM SHALL reject it with an error that states the region count and the region limit.
3. IF the design has no rows, or no columns, THEN THE SYSTEM SHALL reject it with an error that identifies it as empty.
4. IF the design rows differ in length, THEN THE SYSTEM SHALL reject it with an error that names the first row whose length differs from row 0, its length, and the expected length.
5. IF a design cell is not a non-negative integer, THEN THE SYSTEM SHALL reject the design with an error that names the row, column and value.
6. IF a region index used in the design has no weave in the assignment, THEN THE SYSTEM SHALL reject the input with an error naming the region index. Assignments for region indices not used in the design SHALL NOT cause this error, but their weaves are still checked under 1.7. [proposed: the 1.7 check on unused assignments]
7. WHEN an input fails more than one check, THE SYSTEM SHALL report the first failure in this order: profile (1.5), weave parameters (1.7), empty design, unequal rows, invalid cell, width, "repeat across" divisibility, region count, missing weave.
8. THE SYSTEM SHALL report every validation failure as a typed error with a stable `code` field and the values named above as fields, not only as message text.

### Requirement 4: Floats

**User Story:** As a designer, I want every float over the limit, on either side of the cloth, reported with its position, length, side and direction, so that I can see where the cloth would be weak.

#### Acceptance Criteria

1. WHEN a lift plan is checked, THE SYSTEM SHALL find these runs of consecutive cells of equal lift state, within the analysed width:

   | Direction | Run | Side if lifted | Side if not lifted |
   |---|---|---|---|
   | warp | consecutive picks along one end | face | back |
   | weft | consecutive ends along one pick | back | face |

   WHILE `wovenFaceDown` is true, THE SYSTEM SHALL swap the labels face and back in every report.
2. THE SYSTEM SHALL treat the picks as a ring, so a warp run continues from the last pick to pick 0. WHERE "repeat across" is on, THE SYSTEM SHALL also treat the ends of the design as a ring, so a weft run continues from the last end to end 0. WHILE "repeat across" is off, THE SYSTEM SHALL end weft runs at end 0 and at the last end of the design.
3. WHEN a run is longer than the limit for its direction (`maxWarpFloat` for warp, `maxWeftFloat` for weft), THE SYSTEM SHALL report it as kind `"float"` with its pick (row), start end (column), length, side (face or back) and direction (warp or weft). The start is the first cell of the run in ring order.
4. WHEN every pick of an end has the same lift state, or every end in the analysed width has the same lift state on one pick (whether "repeat across" is on or off), THE SYSTEM SHALL report that line as kind `"unbound"` with its direction, side and line index, whatever its length and the limits, and SHALL NOT also report it as kind `"float"`.
5. IF the lift plan has no float and no unbound line, THEN THE SYSTEM SHALL report an empty violation list.
6. THE SYSTEM SHALL list violations in a fixed order: kind, side, direction, row, start column.

### Requirement 5: Auto-fix

**User Story:** As a designer, I want long floats fixed by adding binding points without touching my regions, so that the cloth is sound and the design stays as I drew it.

#### Acceptance Criteria

1. WHEN auto-fix is run on a lift plan with violations, THE SYSTEM SHALL flip lift-plan cells by a documented deterministic heuristic until the plan has no float and no unbound line on either side, and SHALL return the fixed plan and the ordered list of flipped cells. The result need not be minimal.
2. WHEN auto-fix is run on a lift plan with no violations, THE SYSTEM SHALL return it unchanged, with an empty list of flipped cells.
3. WHEN auto-fix is run on its own output, THE SYSTEM SHALL change nothing.
4. THE SYSTEM SHALL flip only a cell that lies inside a float or unbound line that was over the limit at the moment of the flip.
5. THE SYSTEM SHALL change only lift-plan cells. It SHALL NOT change the design, the region labels or the weave assignment, and SHALL NOT flip an idle hook.
6. WHERE "repeat across" is on, THE SYSTEM SHALL flip a cell in every tile copy of the design unit, so the plan stays periodic.
7. WHERE a choice of cells exists, THE SYSTEM SHALL choose by a documented deterministic order that steps in a satin-like way, so that binding points in neighbouring floats do not line up into visible diagonals. This criterion is verified by example tests, not by a property.
8. IF no valid plan is reached within the iteration bound, THEN THE SYSTEM SHALL return an error that lists the remaining violations and SHALL NOT return a partly fixed plan. The bound is the option `maxIterations`; its default value is set in the design.

### Requirement 6: Determinism

**User Story:** As a developer of the MCP server and the web app, I want identical output for identical input, so that exports, gallery files and tests are reproducible.

#### Acceptance Criteria

1. THE SYSTEM SHALL return identical output for identical input, where identical means structurally equal and equal after JSON serialisation with sorted keys.
2. THE SYSTEM SHALL NOT read the clock, a random source, the locale, the environment or the network.
3. THE SYSTEM SHALL NOT modify its input values.

## Labels

- **[convention]** standard weaving practice.
- **[sourced]** stated in a published source (see Sources), not yet checked on a working loom.
- **[decision]** our design choice.
- **[to verify]** a loom fact not yet confirmed on a real loom or in a source.
- **[proposed]** a detail added while writing the spec or design. It needs your confirmation.

Every `[sourced]` and `[to verify]` loom fact is a loom-profile field with a default. It is never a constant in engine logic (`.kiro/steering/weaving-domain.md`).

## Sources

- **[S1]** *Jacquard Machines: Instruction Paper*, Lowell Textile School. American School of Correspondence, Chicago, copyright 1909. Project Gutenberg ebook #50532. Read by the user outside Kiro; quotes below were relayed by the user.

## Decision log

| Q | Answer | Label |
|---|---|---|
| Q1 | A colour index labels a weave region, not a yarn. Version 1 has one warp colour and one weft colour. "Colour limit" is renamed "region limit". | [convention] |
| Q1 | Weaves: plain; twill (ends up, ends down, direction S or Z); satin (size 5 with move 2 or 3, or size 8 with move 3 or 5; warp-faced or weft-faced). Moves 1 and `size - 1` are rejected because they make a twill. One weave per region. A cell's lift value is its region's weave evaluated at the cell's (end, pick). | [convention] |
| Q2 | A design may be narrower than the hook count. Idle hooks never lift and are listed. Option "repeat across" tiles the design and is allowed only when the width divides the hook count exactly. | [decision] |
| Q3 | A punched hole means the hook lifts. Profile field `holeMeans`, default `"lift"`. S1 has no explicit sentence, but says needles tend "to pierce the card where it is blank" and that the cylinder presses off "the hooks that are not to be lifted". | [convention], consistent with S1 |
| Q3 | The face is the side facing up on the loom. A lifted end shows warp on the face. Profile field `wovenFaceDown`, default false, swaps face and back in reports. | [decision] |
| Q3 | Warp float on the up side: run of consecutive picks with the end lifted. Weft float on the up side: run of consecutive ends not lifted within a pick. The back is the complement. | [convention] |
| Q4 | `hooksPerCardRow` is 8 for all three profiles. For 400 hooks: S1, "There are four hundred hooks and four hundred needles in the machine which are in rows of eight hooks and eight needles." For 120 and 240 it is assumed. | 400: [sourced]; 120, 240: [to verify] |
| Q4 | Spare hooks: `spareHookCount` 16 for the 400 profile. S1: "A needle board or plate for a 400-machine, has 416 holes, arranged in 52 rows with 8 holes in a row." and "Nearly all machines have a few extra hooks (from 16 to 26) ... chiefly used for extra work, such as selvedge, extra harnesses, etc." 0 for 120 and 240. | 400: [sourced]; 120, 240: [to verify] |
| Q4 | Default maximum float is 8 threads, user-editable. The right value depends on thread density. | [decision] |
| Q4 | Region limit default 4, maximum 8. | [decision] |
| Q5 | Card position `q` sits at card row `floor(q / hooksPerCardRow)`, slot `q mod hooksPerCardRow`. The position count need not divide evenly. Fill order is a profile field. | [decision] |
| Q5 | Slot 0 is the top needle of a row. S1: "The first needle is the one ... nearest the needle board at the top ... and the others are graded down until the eighth". | [sourced] |
| Q5 | Card row 0 is nearest the numbered end of the card. | [to verify] |
| Q5 | Spare positions come after the last figuring hook. Profile field `spareHookPlacement`. | [to verify] |
| Q6 | A region is every cell with the same index. All weaves are anchored at the design origin. | [convention] |
| Q7 | One card per pick, in pick order, laced into an endless chain (last card laced to the first). Exported card numbers start at 1. Internal indices are 0-based. Travel direction is outside the engine. | [convention]; numbering [decision] |
| Q8 | Floats wrap along the picks always. They wrap across the ends only when "repeat across" is on. Separate limits `maxWarpFloat` and `maxWeftFloat`, defaulting to `maxFloat`. A line that never interlaces is reported as "unbound". | [convention]; limits [decision] |
| Q9 | Auto-fix is a documented deterministic heuristic, not exactly minimal. It may flip cells inside the figure. It may fail with an error. The "as few cells as possible" wording is replaced by testable properties (Requirement 5). | [decision] |
| Phase | Weaves start at the origin: plain lifted at (0,0); twill lifted at (0,0); satin binding cell at end 0 on pick 0. Z rises to the right on point paper drawn with pick 0 at the bottom; S rises to the left. | [decision], confirmed |
| Seam | A weave period that does not divide the repeat produces a warning, not an error. Designers size the repeat as a multiple of the weave repeats. | [convention] |

## Notes for the export spec

These are not engine requirements. From S1, relayed by the user:
- The needle board is divided by a groove into 26 rows on each side, with grooves at each end, for the lacing. So cards are laced at both ends and at the centre.
- The numbered end of the card is at the left of the machine.
- S1 gives no card dimensions or hole spacing. Those stay [to verify], and the exported card must be labelled a schematic.

## Items for your confirmation

1. **2.11 spare-position check.** Decoding rejects a card whose spare position says "lift", since version 1 never lifts spares.
2. **2.13 lift-plan input check.** The MCP server will pass lift plans from outside the engine, so the checker, auto-fix and card builder reject plans that do not match the profile.
3. **3.6 unused assignments.** Their weaves are still checked for valid parameters. Without this, 1.7 (step 2 of 3.7) would have to run after the design checks to know which regions are used.
