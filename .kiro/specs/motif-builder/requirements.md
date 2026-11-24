# Requirements Document

## Introduction

Scope: Amazon Bedrock is not available on Tushar's AWS account (it needs a paid plan), so the live site will never have a model. Today "Describe a motif" on the live site turns "a lotus with four petals on a plain ground" into horizontal stripes, because the stand-in picks a pattern from a hash of the words. This phase adds a deterministic motif builder that reads the description, draws clean SVG shapes from a small motif grammar and hands them to the existing pipeline (rasterize, specks, symmetry, motif to design). It also saves the design across reloads, removes "model" from the motif panel on the static build, adds security headers on the Amplify app, redeploys and checks the result on the Live_URL.

Code locations: `packages/motif` (new files only: the description parser and the builder, with their own tests), `apps/web` (builder path, chips, copy, persistence), `scripts/deploy-web.sh` and a headers file, `README.md`, `.kiro/steering/product.md`, `docs/kiro-writeup-draft.md`. `packages/engine`, `packages/export` and `backend/` do not change, and the existing functions of `packages/motif` keep their behaviour. Acceptance criteria are cited as `N.M`.

## Glossary

- **Static_Build**: `vite build` of `apps/web` with no `VITE_API_BASE`, as deployed (deploy-static).
- **Description**: the text typed in "Describe the motif".
- **Motif_Plan**: what the builder draws: subject, count, layout, size, symmetry and 2 to 4 named colours (ground first).
- **Describer**: `describeMotif(text, options)` in `@jacquard/motif`: Description to Motif_Plan, plus the words it understood, the words it did not use and notes.
- **Builder**: `buildMotif(plan)` in `@jacquard/motif`: Motif_Plan to Motif_SVG text.
- **Chips**: the editable summary of the Motif_Plan under the Description box.
- **Figure_Subject**: lotus, peacock, star, diamond, paisley, rosette, tree, elephant. **Pattern_Subject**: border, stripe, check, lattice.
- **Asymmetric_Subject**: paisley, elephant and peacock (the others are drawn symmetric about their own centre).
- **Kept_Part**: the part of the design grid that a symmetry keeps: the left half for `mirrorEnds`, the low picks (the bottom of the SVG) for `mirrorPicks`, the low-left quarter for `mirrorBoth`, all of it for `none`.
- **Default_Setup**: the web app's first setup: profile 240, 3 colours, repeat 48 by 48, minimum feature 2, repeat across on; the web app's default weaves (region 0 plain, then twill 1/3 Z, satin 5/2 weft, twill 3/1 S).
- **Saved_Design**: the design, loom setup, palette, weaves, yarns and Step kept in `localStorage`.
- **Live_URL**: `https://main.d28e9v65r7sow0.amplifyapp.com`.

## Requirements

### Requirement 1: Reading a description

**User Story:** As a designer on the live site, I want my words to decide the motif, so that "a lotus with four petals" gives a lotus with four petals.

#### Acceptance Criteria

1. THE Describer SHALL recognise at least these subjects, with plurals and the listed other names: lotus (kamal), peacock (mor), star, diamond (lozenge, rhombus), paisley (kalga, kalka, mango, ambi, keri), rosette (flower, phool, floral, blossom), tree (tree of life), elephant (hathi, haathi), border, stripe, check, lattice (jaal, jali, trellis).
2. THE Describer SHALL read these modifiers: a count as a number word or digits from one to twelve before "petals", "points", "stripes", "bands", "teeth" or "cells" (also written "eight-point" or "8-pointed"); symmetry ("mirror", "mirrored", "symmetric", "pair", "facing", "two" before a subject → mirror; "four-way", "fourfold", "4-fold", "quartered", "radial" → four-way; "asymmetric", "no symmetry" → none); size (small, tiny, little, medium, large, big, bold); layout ("single", "butta", "buta", "central", "medallion" → single butta; "border", "edge", "band" → border; "all-over", "allover", "all over", "repeat", "repeating", "scattered" → all-over repeat); ground ("plain ground", "<colour> ground", "<colour> background"); and up to 4 colours by name.
3. WHEN no subject word is found, THE Describer SHALL use a rosette and SHALL report that it fell back, together with the words it understood.
4. THE Describer SHALL be a total, pure function: for any text it returns a Motif_Plan with a known subject, a count inside the subject's range (or none), a known layout, size and symmetry, and 2 to 4 distinct `#rrggbb` colours, and the same text and options give an equal result (Property 1).
5. WHEN a Figure_Subject is named with no symmetry word, THE Motif_Plan SHALL use the subject's own symmetry: four-way for lotus, star, diamond and rosette; mirror for tree; none for paisley, elephant and peacock. Pattern_Subjects use four-way, border uses mirror. A symmetry word overrides it.
6. THE colour count SHALL be the ground plus the distinct figure colours named when 2 or more figure colours are named, else the loom setup's colour count, kept within 2 to 4 and within the profile's region limit. Colours not named are filled from the subject's own yarn colours. Extra colours beyond the count are dropped with a note.
7. Chip edits (subject, count, layout, size, symmetry, ground colour, colour count) SHALL override what the Description says, and the overrides SHALL be cleared when the Description text changes.

### Requirement 2: Drawing the motif

**User Story:** As a designer, I want a clean, recognisable motif, so that the point paper shows what I asked for.

#### Acceptance Criteria

1. THE Builder SHALL write Motif_SVG that `parseMotif` accepts with the plan's colour count as the limit, in a `0 0 100 100` viewBox, with a full-size ground rect first, using only `rect` and `polygon`, and with numbers written by `String` with at most 2 decimals, so the text does not depend on locale.
2. THE Builder's palette SHALL be exactly the plan's colours (Property 2).
3. THE Builder SHALL be deterministic: the same Motif_Plan gives the same text (Property 2).
4. FOR a Figure_Subject, THE layout SHALL place one figure (single butta), a row of figures between two edge lines (border), or a 2 by 2 grid of figures (all-over repeat); the size SHALL scale the figures. Pattern_Subjects SHALL fill the whole repeat and ignore layout and size.
5. FOR an Asymmetric_Subject with a mirror of the ends, THE Builder SHALL draw each figure inside the Kept_Part, so that mirroring makes a facing pair instead of cutting a figure in half. A figure that is not symmetric top to bottom (peacock, tree, paisley, elephant, and a lotus, rosette or star with an odd count) SHALL NOT be mirrored top to bottom: the Describer drops that part of the symmetry and says so in a note.
6. ON the Default_Setup and on repeats from 48 to 96 ends and picks, THE design from `motifToDesign` SHALL contain every colour of the palette (Property 2), so the colour chip is true.
7. ON the Default_Setup, every Builder motif SHALL pass the engine's float check after `autoFix` (Property 3).
8. "a lotus with four petals on a plain ground" SHALL give, on the Default_Setup, a design with four-way symmetry (equal to its mirror in ends, in picks, and under a quarter turn before speck removal) and exactly four 4-connected petal regions.

### Requirement 3: The builder in the web app

**User Story:** As a judge on the live site, I want to see what the builder understood and change it, so that I can steer the motif without a model.

#### Acceptance Criteria

1. IN the Static_Build, "Generate motif" on the Describe tab SHALL use the Builder in the browser, with no network call. Development, tests and builds with `VITE_API_BASE` keep the current backend path. Upload a sketch keeps the in-browser stand-in.
2. UNDER the Description box, THE panel SHALL show the Chips as soon as there is a Description, for example "lotus · 4 petals · plain ground · 3 colours", each one a labelled control the user can change by keyboard, pointer or touch.
3. THE panel SHALL show which words were understood; WHEN it fell back to a rosette, it SHALL say so; words it did not use SHALL be listed.
4. A placed builder motif SHALL be labelled "Motif builder, not AI — edit it freely".
5. Placing a builder motif SHALL set the loom setup's symmetry to the plan's and raise its colour count to the plan's when lower, and Undo SHALL bring back the previous grid, loom setup and palette together.
6. THE same Description, Chips and loom setup SHALL give the same design.

### Requirement 4: Copy on the static build

#### Acceptance Criteria

1. IN the Static_Build, no text in the motif panel (any state) or on the Upload a sketch tab SHALL contain the word "model".
2. THE wording SHALL stay honest: the sketch note says a sketch is not traced and a pattern is made from the file; the label for a sketch result says the same.
3. The backend path keeps its current wording ("Suggestion from the model", "The motif model failed"), since there a model can answer.

### Requirement 5: Saving the design

**User Story:** As a designer, I want my design to survive a reload, so that I do not lose work.

#### Acceptance Criteria

1. THE app SHALL save the Saved_Design to `localStorage` under one versioned key shortly after each change, and restore it on load before the first paint. A reload with no Step in the URL opens the saved Step.
2. Undo history SHALL NOT be saved.
3. Every storage call SHALL be wrapped in try/catch; a missing, full or blocked storage SHALL never break the app.
4. A Saved_Design larger than the size limit SHALL NOT be written. A stored value that is not valid JSON, has another version, or fails validation (sizes, region indices, colours, weaves, setup) SHALL be ignored and removed.
5. "Start from a blank grid" SHALL clear the Saved_Design. An all-blank grid is not saved.
6. FOR any valid Saved_Design, saving and loading SHALL give an equal value (Property 4).
7. Persistence SHALL be on only in the real app (`main.tsx`), so component tests do not share state.

### Requirement 6: Security headers

#### Acceptance Criteria

1. THE Amplify app SHALL send, on every path: a Content-Security-Policy that allows only `'self'` (plus only what the app is shown to need), `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, and a `Permissions-Policy` that turns off camera, microphone and geolocation.
2. `/` and `/index.html` SHALL be sent with `Cache-Control: no-cache`; hashed files under `/assets/` SHALL stay immutable.
3. THE headers SHALL live in a file in the repository and be applied by `scripts/deploy-web.sh` to the existing Amplify app only. No new AWS resource.
4. WHETHER three.js or Tone.js need `'wasm-unsafe-eval'`, `blob:` workers or worklets SHALL be checked, and only what they need allowed.

### Requirement 7: Redeploy and verification

#### Acceptance Criteria

1. THE site SHALL be redeployed with `scripts/deploy-web.sh`.
2. ON the Live_URL, through the Chrome DevTools MCP server, at 1440x900 and 390x844, the six Descriptions "a lotus with four petals on a plain ground", "a peacock", "an eight-point star", "a paisley border", "small diamond all-over" and "an elephant" SHALL each be generated, seen on the point paper and woven in the Cloth view, and judged to read as what was asked. Screenshots go under `media/motif-builder/`.
3. THE console SHALL show no error and no CSP violation (the THREE.Clock warning from r3f is accepted).
4. `curl -I` on the Live_URL SHALL show every header of Requirement 6.
5. Lighthouse performance, accessibility and best practices SHALL each stay at least 90.

### Requirement 8: Docs and record

#### Acceptance Criteria

1. `product.md`, `README.md` and `docs/kiro-writeup-draft.md` SHALL say: the live motif step is a builder, not AI; the Bedrock path is built but off, and needs Bedrock model access.
2. THE journal entry SHALL have a "Surprise" heading, and the tally SHALL be updated.

## Decision log

| Q | Answer | Label |
|---|---|---|
| Where does the builder run in the web app? | As its own in-browser path, not through `requestMotif`: the panel loads a lazy chunk with the Describer and Builder (so the Chips can update while typing), builds the SVG and hands it to a new `place` action of `useMotifRequest`. `requestMotif({ local: true })` keeps returning the stand-in, which Upload a sketch still uses, so the deploy-static Property 1 and its tests stay as they are. | [decision] |
| A new `MotifResponse.source` value? | No. `@jacquard/motif`'s `MotifResponse` and the backend stay unchanged; the web app widens its own type with `"builder"`. | [decision] |
| How does "4-fold symmetry" map onto the setup's symmetry options? | The options are mirror symmetries, so four-way is `mirrorBoth`. The Builder also draws radial subjects with quarter-turn symmetry, which the lotus test checks on the raster (2.8); speck removal is not rotation-safe, so the final design is checked for `mirrorBoth`. | [decision] |
| The setup says mirror, the description says lotus. Which wins? | The description (and the Chips) decide the plan's symmetry. Placing the motif sets the loom setup's symmetry to match, so the setup shows what was used, and Undo puts both back (3.5). The setup's symmetry only ever applied to the next motif. | [decision] |
| Colour count: setup or description? | Named figure colours decide when 2 or more are named (plus the ground, named or not, so "a tree in green and brown" is 3 colours); otherwise the setup's count, both kept to 2 to 4 (the region limit of every built-in profile is 4). Placing raises the setup's count when the plan has more; it never lowers it. | [decision] |
| Mirror top to bottom on a peacock? | Found by Property 2 (seed 6102): a paisley border with `mirrorPicks` lost its figures, because no slot fits in the low half of a band centred on the middle pick. The Describer now drops the top-to-bottom part of the symmetry for figures that are not symmetric that way, with a note, instead of drawing them upside down or cut. | [decision] |
| Peacock: front or side view? | Side view, facing right, with the train behind it. The first front view (a fanned tail with eyes, mirror symmetry) was checked on the Live_URL at 48 by 48 and read as a teal bell, not a peacock. The side view is the common woven peacock; "two peacocks" or a mirror word gives a facing pair. | [decision] |
| What happens to an elephant with a mirror? | It is drawn in the Kept_Part, facing the centre, so the mirror makes two elephants facing each other, as in many woven borders. Cutting it in half would not be recognisable (2.5). | [decision] |
| Do the Chips edit the text? | No. They are overrides on top of the parsed text, shown as `select` controls with self-describing option text ("4 petals", "plain ground"); typing in the box clears them (1.7). Rewriting the user's text would lose their words. | [decision] |
| Which words count as "understood"? | Words that changed the plan, shown as phrases ("four petals", "plain ground"). Filler words ("a", "with", "motif") are neither understood nor listed as unused. | [decision] |
| Same input, same output across browsers? | Within one engine, exactly. Petal and fan curves use `Math.cos` and `Math.sin`, rounded to 2 decimals; `parseMotif` already uses them for circles, so the pipeline was never bit-identical across engines. | [decision] |
| Existing web tests that assert the static-build copy | The sketch-note assertion in `motif-local.test.tsx` changes with the copy (Requirement 4). Engine, export, motif and backend tests do not change. | [decision] |
| Sketch on the static build | Still the stand-in pattern from the file, labelled "Pattern from your file, not a tracing — edit it freely". The builder reads words only. | [decision] |
| Persistence key and limit | `jacquard.design` holding `{ version: 1, ... }`; limit 1,000,000 characters of JSON (a 240 by 400 design is about 200,000). Saved 400 ms after the last change and on `pagehide`. | [decision] |
| Gallery badge after a reload | Not restored: the badge is tied to the undo depth of the open, and undo history is not saved. The restored design keeps the example's weaves and palette. | [decision] |
| Where do the headers live? | `scripts/amplify-custom-headers.yml`, applied with `aws amplify update-app --custom-headers` in `scripts/deploy-web.sh` (manual deploys have no build spec to read `customHttp.yml` from). | [decision] |
