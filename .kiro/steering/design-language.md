---
inclusion: fileMatch
fileMatchPattern: "apps/web/**"
---

# Design language (apps/web)

## Visual language

- Theme: the card as the central object. Pale card-stock surfaces, a grid of punched holes as the recurring motif, thread-colour accents. A Halloween nod is allowed only in the gallery framing; the app itself stays calm and craft-like.
- Colour: neutral card-stock background, near-black text, one accent. Design colours (the user's yarn colours) are the only saturated colours on screen so the design reads first.
- Type: one sans-serif for UI, one monospace for numbers (hook, end, pick, card index).
- Grid: point paper uses a 1px light line grid with a heavier line every 8 cells. Cell size is adjustable; the default fits the narrowest supported viewport without horizontal page scroll (the grid itself may scroll).
- Spacing: 4px base unit. Radii small and consistent.
- Motion: short (under 200ms), none that blocks use. Respect `prefers-reduced-motion`.

## Component rules

- Build components from a small shared set (Button, Field, Panel, Dialog, Toast, Tabs, Grid). Do not hand-style one-offs.
- Every control has a visible label, a keyboard path and a focus ring. Colour is never the only signal: float violations use colour plus a marker shape.
- Contrast meets WCAG AA. Hit targets are at least 44px on touch.
- Weaving terms show a short plain-language tooltip on first use (end, pick, float, lift plan). Keep wording from `weaving-domain.md`.
- Anything the model produced is labelled as a suggestion the designer can edit.
- No weaving logic in components; call the engine.
- Copy follows the framing rules in `product.md`: assist, never replace; no unverified numbers.

## Required states

Every screen and panel that loads or shows data defines all four:

- **Empty**: says what goes here and offers the next action (describe a motif, upload a sketch, open a gallery example).
- **Loading**: skeleton or progress for model calls, with a cancel action. Engine work that exceeds 100ms shows progress.
- **Error**: plain message, what the user can do next, and a retry. Distinguish model failure, invalid design (typed engine errors, shown with the offending cells highlighted), and export failure. Never show raw stack traces or keys.
- **Mobile**: usable at 360px width. Panels stack, the point paper scrolls and pinch-zooms, and exports remain reachable. Touch-up editing works with touch input.

Also handle: offline or slow network (clear message, design stays editable), and results where the float check reports violations (show them, offer auto-fix, never silently export).
