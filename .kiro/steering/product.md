---
inclusion: always
---

# JACQUARD: product

## What it is

The first computer programs were punch cards written for looms in 1804. Computing abandoned them as a medium. Handlooms did not. JACQUARD brings the punch card back as something AI can write: the user describes or sketches a motif and gets a loom-ready design, a simulated cloth, and the card set to weave it.

Entry for Kiroween 2026, category Resurrection. Deadline Fri Dec 4, 2026, 2:00 PM PT.

## Who it is for

- Handloom designers who draw motifs and plan weaves.
- Card punchers (card cutters) who turn a design into a physical card set.
- Weaving students and hobbyists who want to see how a design becomes cards.

The builder is not a weaver. Do not write copy that implies weaving expertise or real-loom testing.

## Framing rules (from PLAN.md)

- Say in the first line that punch cards are dead as a computing medium.
- The tool assists the designer and the card puncher. Never say it replaces them.
- No unverified statistics. The only sourced figure is the handloom census count (about 35 lakh workers, 2019-20). Time and cost per design are not sourced; do not state them.
- State plainly that the card format is a configurable loom profile and has not been tested on a working loom.
- The model writes a clean, limited-colour vector motif. The deterministic engine does the weaving work. Never present a pixelated AI picture as a design.
- Hosting is on AWS. Model keys stay behind a backend proxy.

## Must ship

- Input: text prompt or uploaded sketch, turned into a motif.
- Loom setup: hook count, region limit, repeat size.
- Point paper editor with manual touch-up.
- Weave engine: reduction of the motif to weave regions on the grid, a binding weave per region, float check with highlighted violations and auto-fix.
- Fabric simulator.
- Export: punch-card set (SVG and PDF, numbered, in lacing order), graph-paper sheet, WIF file.
- Gallery of three or four finished examples.

## Stretch

- Physically punched sample card and a woven swatch.
- Hindi interface.
- Extra-weft (brocade) designs with more than one card per row.

## Out of scope

- Accounts, payments, marketplace.
- Electronic-jacquard file formats.
- Claims of loom compatibility that have not been tested.
- Hosting on Vercel, Netlify or Lovable.
