---
inclusion: fileMatch
fileMatchPattern: "packages/engine/**"
---

# Weaving domain (engine)

Every statement about real looms in this file is either general textile vocabulary or marked **to verify**. Do not fill in a "to verify" item from memory. If a task needs one, stop and ask the user.

## Glossary

- **Warp**: the lengthwise threads, held under tension on the loom.
- **Weft**: the crosswise thread that is passed through the warp.
- **End**: one warp thread. A design is `N` ends wide.
- **Pick**: one pass of the weft across the warp. A design is `M` picks tall. One pick corresponds to one row of point paper.
- **Hook**: the Jacquard mechanism element that lifts warp ends. Number of hooks sets the maximum design width in the loom profile. How many ends each hook controls (one-to-one or many-to-one through a harness): **to verify**.
- **Float**: a stretch where a warp end or weft thread passes over (or under) several crossing threads without being bound. Long floats snag and weaken cloth, so the engine measures them and enforces a maximum length.
- **Binding weave**: a regular interlacing structure (plain, twill, satin) used to tie down a colour region so no float exceeds the limit. Which binding weaves to offer, and their exact interlacing counts for a given loom: **to verify**.
- **Point paper**: grid paper where each square is one end-pick intersection and its colour or mark says what the design does there. In this project it is the editable design grid.
- **Lift plan**: for each pick, the set of ends raised. Derived from the point paper plus binding weaves. Whether "raised" corresponds to a punched hole or an unpunched position on the card: **to verify**.
- **Card lacing order**: the order in which cards are strung together into a chain so picks run in sequence. Direction, start card, and repeat handling: **to verify**.
- **Loom profile**: configuration object describing one loom: hook count, card layout, colour limit, maximum float, repeat rules. See rules below.
- **WIF**: Weaving Information File, the standard interchange format for weaving drafts. Which WIF sections the engine writes and how Jacquard lift plans map into them: **to verify** against the published WIF spec.

## Rules for the engine

1. **Orientation is explicit.** Ends index across (0 to N-1), picks index down (0 to M-1). Name every function parameter `end` or `pick`, never `x`/`y` or `row`/`col`.
2. **Loom profile is data, not constants.** No hook count, card dimension, hole position or float limit is hard-coded in engine logic. All come from the profile. Profile defaults must cite a published source in a code comment; until a source is confirmed, mark the default `// to verify`.
3. **No claims of loom correctness.** Docs and error messages say the card format has not been tested on a working loom.
4. **Every end is bound.** After weave generation and auto-fix, every end has at least one binding interlacement per repeat.
5. **No float longer than the profile maximum** after auto-fix. The checker returns violations with end, pick and length so the UI can highlight them. Auto-fix must not change the visible design colours.
6. **Card count equals pick count** for single-weft designs. Multi-card-per-pick (extra weft) is stretch scope; do not implement it implicitly.
7. **Round trip.** Cards decode back to the same lift plan they were encoded from.
8. **Determinism.** Same design and profile produce identical lift plan, cards, SVG and WIF bytes. No timestamps, no random values, no locale-dependent formatting in exports.
9. **Colour reduction** maps the input to at most the profile colour limit before weaving. The engine does not call a model.
10. **Typed errors** for invalid dimensions (design wider than hooks, zero picks, colour count over limit).

## Open questions for the user (ask before implementing)

- Card size, hole spacing and hole count per row for the target loom.
- Whether the user's reference loom is a mechanical Jacquard with cards, and its hook count.
- Lacing direction and which side of the card is the start.
- Which published source supplies the default loom profile.
- Binding weaves to include in the first version.
