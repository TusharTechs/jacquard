---
inclusion: fileMatch
fileMatchPattern: "apps/web/**"
---

# Design language (apps/web)

## Visual language

- Theme: "the loom room". The card as the central object: card-stock surfaces, walnut, brass, a grid of punched holes as the recurring motif, thread-colour accents. Materials, not gradients: no hue gradients, no glass blur, no purple, no generic AI look. Shading of one material (lighter and darker tones of the same colour) is allowed.
- One theme (no dark theme). The Kiroween nod is only the Opening: one screen, under 4 seconds, shown once, skippable.
- Flow: one clear path, Design → Check → Weave → Cards, each Step ending in one primary "Continue" action. Nothing decorative that adds a step or text.
- Colour: card-stock or walnut background, ink text, brass as the one accent. Design colours (the user's yarn colours) are the only saturated colours on screen so the design reads first.
- Type: a display serif (Fraunces) for headings, one sans-serif (Instrument Sans) for UI, one monospace (IBM Plex Mono) for numbers (hook, end, pick, card index). Self-hosted with Fontsource; no font CDN.
- Tokens: Tailwind v4 `@theme` plus custom properties in `apps/web/src/styles.css`. Components use tokens, never raw colours.
- Grid: point paper uses a 1px light line grid with a heavier line every 8 cells. Cell size is adjustable; the default fits the narrowest supported viewport without horizontal page scroll (the grid itself may scroll).
- Spacing: 4px base unit. Radii small and consistent.
- Motion: interface transitions (Step changes, dialogs, menus) at most 300ms. Moments may run up to 1.5s only when they explain something (a motif arriving cell by cell, violations pulsing, auto-fix placing its flips, cards punching, the 3D loom weaving, the Opening); they never block input and end at once on any edit. No other decorative animation. `prefers-reduced-motion: reduce` turns every animation, smooth scroll and autoplay off.
- Less text: short labels plus a Hint tooltip (hover, focus and tap); required notes (untested card format, WIF note, simulation note, suggestion labels, states) stay visible.

## Component rules

- Build components from a small shared set (Button, IconButton, Hint, Field, Panel, Dialog, Toaster, Tabs, Grid). Dialogs, menus, tooltips and sliders are Radix primitives; toasts are sonner; icons are lucide. Do not hand-style one-offs.
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
