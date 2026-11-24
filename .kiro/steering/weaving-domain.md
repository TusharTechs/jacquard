---
inclusion: fileMatch
fileMatchPattern: "packages/engine/**"
---

# Weaving domain (engine)

Every statement about real looms in this file carries a label. Do not fill in a `to verify` item from memory. If a task needs one, stop and ask the user. The decision log in `.kiro/specs/weave-engine/requirements.md` is the full record.

Labels: **[convention]** standard weaving practice; **[sourced]** stated in a published source, not yet checked on a working loom; **[decision]** our design choice; **[to verify]** not yet confirmed.

## Sources

- **[S1]** *Jacquard Machines: Instruction Paper*, Lowell Textile School. American School of Correspondence, Chicago, copyright 1909. Project Gutenberg ebook #50532. Read by the user outside Kiro; quotes relayed by the user. Cite it in code comments as `S1` with the quote.
- **[S2]** District Varanasi, Government of Uttar Pradesh, "Banaras Brocades and Sarees" (GI-registered product page, quoting *A Compendium of Geographical Indications (GI) II: Handicrafts of India*, p. 1165), https://varanasi.nic.in/district-produce/banarasi-saree/ , fetched by Kiro on 2026-11-24. States that the sarees are decorated with designs in zari, names kalga and bel among the floral and foliate motifs, describes "jali" as a net-like pattern, and says they are woven on the conventional Banaras hand loom jacquard.
- **[S3]** "32 feet long blueprint, handwoven Banarasi installation on display at India's new Parliament building", *The Times of India*, 20 June 2023, https://timesofindia.indiatimes.com/life-style/fashion/buzz/32-feet-long-handwoven-installation-by-tilfi-banaras-on-display-at-indias-new-parliament-building/articleshow/101104214.cms , fetched by Kiro on 2026-11-24. Reports a handwoven Banarasi textile translated onto the loom with Jacquard punch cards (naksha-pattas).
- **[S4]** "Buta", *Encyclopaedia Britannica*, https://www.britannica.com/art/buta , fetched by Kiro on 2026-11-24. Describes buta as an ornamental motif of Mughal Indian art, a floral spray with stylised leaves and flowers, used in textiles among other arts.
- Handlooms still weaving from punched cards: **[sourced, S2, S3]** (a modern handloom in Varanasi with a jacquard, and a 2023 handwoven piece made from Jacquard punch cards). Not checked by us on a working loom.

## Glossary

- **Warp**: the lengthwise threads, held under tension on the loom.
- **Weft**: the crosswise thread that is passed through the warp.
- **End**: one warp thread. A design is `N` ends wide. End 0 is the leftmost column [convention].
- **Pick**: one pass of the weft across the warp. A design is `M` picks tall. One pick is one row of point paper. Pick 0 is the first pick woven, drawn at the bottom of point paper [convention].
- **Hook**: the Jacquard element that lifts warp ends. Figuring hook `h` carries end `h` [sourced, S1: "The hook that passes through the first needle is considered the first thread in the pattern"]. Version 1 assumes one end per hook and a single-lift, single-cylinder machine [decision]; harness ties and double-lift machines are out of scope.
- **Spare hook**: extra hooks beyond the figuring hooks. S1: "Nearly all machines have a few extra hooks (from 16 to 26) ... chiefly used for extra work, such as selvedge, extra harnesses, etc." [sourced]. Never lifted in version 1.
- **Float**: a run where a warp end or weft thread passes over (or under) several crossing threads without interlacing. Long floats snag and weaken cloth.
- **Binding weave**: a regular interlacing structure put into a painted region [convention]. Version 1: plain; twill (up, down, S or Z); satin (size 5 with move 2 or 3, size 8 with move 3 or 5; warp- or weft-faced) [convention].
- **Point paper**: grid paper where each square is one end-pick intersection. A colour index labels a weave region, not a yarn [convention]. In this project it is the editable design grid.
- **Lift plan**: for each pick, the set of figuring hooks raised. A punched hole means the hook lifts: profile field `holeMeans`, default `"lift"` [convention], consistent with S1 ("pierce the card where it is blank"; the cylinder presses off "the hooks that are not to be lifted").
- **Card lacing order**: one card per pick, in pick order, laced into an endless chain [convention]. Exported numbers start at 1 [decision]. Travel direction is outside the engine.
- **Card layout**: `hookCount + spareHookCount` positions in rows of `hooksPerCardRow`. For the 400 profile, S1: "A needle board or plate for a 400-machine, has 416 holes, arranged in 52 rows with 8 holes in a row." [sourced]. Slot 0 is the top needle of a row [sourced, S1]. Row 0 nearest the numbered end [to verify]. Spare positions after the figuring hooks [to verify].
- **Loom profile**: configuration record for one loom. Fields and labels are in requirements R1.2.
- **WIF**: Weaving Information File, the standard interchange format for weaving drafts. How Jacquard lift plans map into it: **to verify** against the published WIF spec (export spec, not the engine).

## Rules for the engine

1. **Orientation is explicit.** Ends index across from the left (0 to N-1), picks index in weaving order (0 to M-1). Name every function parameter `end` or `pick`, never `x`/`y` or `row`/`col`.
2. **Loom profile is data, not constants.** No hook count, card layout, hole meaning or float limit is hard-coded in engine logic. All come from the profile. Each profile default carries a comment with its label; `[sourced]` defaults quote S1; unconfirmed defaults say `// to verify`.
3. **No claims of loom correctness.** Docs and error messages say the card format has not been tested on a working loom.
4. **Every line is bound.** After weave generation and auto-fix, no end or pick is unbound.
5. **No float longer than the profile limits** after auto-fix. Violations carry pick, end, length, side and direction. Auto-fix changes only lift-plan cells, never region labels.
6. **Card count equals pick count.** Multi-card-per-pick (extra weft) is out of scope.
7. **Round trip.** Cards decode back to the same lift plan they were encoded from.
8. **Determinism.** Same input, same output bytes. No timestamps, random values or locale-dependent formatting.
9. **Region limit.** The engine accepts at most `regionLimit` regions (default 4, maximum 8) and rejects more. Reducing an image to regions happens outside the engine. The engine does not call a model.
10. **Typed errors** with a stable `code` field for every validation failure.

## Open items (to verify)

- `hooksPerCardRow` and `spareHookCount` for the 120 and 240 profiles.
- Card row 0 nearest the numbered end of the card.
- Placement of spare positions on the card.
- Card dimensions and hole spacing: not in S1. Export spec labels cards as a schematic.
