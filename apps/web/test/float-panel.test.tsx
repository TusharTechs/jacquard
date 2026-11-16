// Float panel states (10.2, 10.3, 12.1): empty, clean, violations listed with direction, side,
// pick, end and length, auto-fix with the flipped-cell count, and AUTOFIX_FAILED with what
// remains. Every check result and fix comes from the engine; the panel only shows it.
import { fireEvent, render, screen, within } from "@testing-library/react";
import { PROFILE_120, autoFix, defineProfile } from "@jacquard/engine";
import type { Design, LoomProfile } from "@jacquard/engine";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FloatPanel } from "../src/components/float-panel";
import type { FloatPanelProps } from "../src/components/float-panel";
import { defaultWeaves } from "../src/lib/default-weaves";
import { checkDesign, fixDesign } from "../src/lib/engine-check";
import type { CheckResult } from "../src/lib/engine-check";
import type { FixState } from "../src/lib/fix-state";
import { installDom, textOf } from "./dom-setup";

function grid(ends: number, picks: number, cell: (end: number, pick: number) => number): Design {
  return Array.from({ length: picks }, (_, pick) => Array.from({ length: ends }, (_, end) => cell(end, pick)));
}

function checked(design: Design, profile: LoomProfile): Extract<CheckResult, { ok: true }> {
  const result = checkDesign({ design, weaves: defaultWeaves(4), profile, repeatAcross: false });
  if (!result.ok) throw new Error(`engine error ${result.error.code}`);
  return result;
}

function renderPanel(props: Partial<FloatPanelProps> & Pick<FloatPanelProps, "check" | "profile">) {
  const handlers = { onAutoFix: vi.fn(), onUndo: vi.fn(), onNextViolation: vi.fn(), onTurnOffRepeatAcross: vi.fn(), onChooseProfile: vi.fn() };
  const view = render(<FloatPanel checking={false} fix={{ status: "none" }} canUndo={false} {...handlers} {...props} />);
  return { ...view, ...handlers };
}

function floatPanel(): HTMLElement {
  const section = screen.getByRole("heading", { name: "Float check" }).closest("section");
  if (section === null) throw new Error("float panel not found");
  return section;
}

/** A small float limit makes the 1/3 twill and satin regions break it. */
const STRICT = defineProfile({ hookCount: 120, maxFloat: 2 });
const STRIPES = grid(16, 16, (end) => Math.floor(end / 4) % 3);

beforeEach(() => {
  installDom();
});

describe("float panel", () => {
  it("empty state is a one-line note that says what goes here, with no button", () => {
    renderPanel({ check: null, profile: PROFILE_120 });
    const panel = floatPanel();
    const empty = panel.querySelector(".panel-empty");
    expect(empty).not.toBeNull();
    expect(textOf(empty!)).toContain("Nothing to check yet");
    expect(empty!.querySelectorAll("p")).toHaveLength(1);
    expect(within(panel).queryAllByRole("button")).toHaveLength(0);
  });

  it("clean state says no float is over the limit and offers no auto-fix", () => {
    const check = checked(grid(16, 16, () => 0), PROFILE_120);
    expect(check.violations).toHaveLength(0);
    renderPanel({ check, profile: PROFILE_120 });
    const panel = floatPanel();
    expect(textOf(within(panel).getByRole("status"))).toContain("No floats over the limit");
    expect(within(panel).queryByRole("button", { name: "Auto-fix" })).toBeNull();
  });

  it("lists every violation with direction, side, pick, end and length (10.2)", () => {
    const check = checked(STRIPES, STRICT);
    const floats = check.violations.filter((violation) => violation.kind === "float");
    expect(floats.length).toBeGreaterThan(0);
    renderPanel({ check, profile: STRICT });
    const panel = floatPanel();
    const count = check.violations.length;
    expect(textOf(within(panel).getByRole("status"))).toContain(`${count} ${count === 1 ? "violation" : "violations"}`);
    const items = within(within(panel).getByRole("list", { name: "Float violations" })).getAllByRole("listitem").map(textOf);
    expect(items).toHaveLength(Math.min(count, 200));
    const first = floats[0]!;
    if (first.kind !== "float") throw new Error("expected a float");
    expect(items).toContain(`${first.direction} · ${first.side} · pick ${first.pick} · end ${first.end} · length ${first.length}`);
    for (const item of items) expect(item).toMatch(/^(warp|weft) · (face|back) · /);
  });

  it("Auto-fix calls the handler and the report shows the flipped cells (10.3)", () => {
    const check = checked(STRIPES, STRICT);
    const fixed = fixDesign(check.plan, STRICT);
    if (!fixed.ok) throw new Error(`autoFix failed: ${fixed.error.code}`);
    expect(fixed.flips.length).toBeGreaterThan(0);
    const { rerender, onAutoFix } = renderPanel({ check, profile: STRICT });
    fireEvent.click(within(floatPanel()).getByRole("button", { name: "Auto-fix" }));
    expect(onAutoFix).toHaveBeenCalledTimes(1);

    const fix: FixState = {
      status: "fixed",
      plan: fixed.plan,
      flips: fixed.flips,
      remaining: 0,
      source: { design: STRIPES, weaves: defaultWeaves(4), profile: STRICT, repeatAcross: false },
    };
    rerender(
      <FloatPanel
        check={check}
        checking={false}
        profile={STRICT}
        fix={fix}
        canUndo={false}
        onAutoFix={onAutoFix}
        onUndo={vi.fn()}
        onTurnOffRepeatAcross={vi.fn()}
        onChooseProfile={vi.fn()}
      />,
    );
    const n = fixed.flips.length;
    expect(textOf(floatPanel())).toContain(`Auto-fix flipped ${n} ${n === 1 ? "lift-plan cell" : "lift-plan cells"}`);
    expect(textOf(floatPanel())).toContain("0 violations");
  });

  it("after auto-fix the fixed result is the headline and the earlier list is folded in a details element (10.3)", () => {
    const check = checked(STRIPES, STRICT);
    const fixed = fixDesign(check.plan, STRICT);
    if (!fixed.ok) throw new Error(`autoFix failed: ${fixed.error.code}`);
    const fix: FixState = {
      status: "fixed",
      plan: fixed.plan,
      flips: fixed.flips,
      remaining: 0,
      source: { design: STRIPES, weaves: defaultWeaves(4), profile: STRICT, repeatAcross: false },
    };
    renderPanel({ check, profile: STRICT, fix });
    const panel = floatPanel();
    const n = fixed.flips.length;
    expect(textOf(within(panel).getByRole("status"))).toBe(`Fixed lift plan: 0 violations · ${n} ${n === 1 ? "cell" : "cells"} flipped`);
    const list = within(panel).getByRole("list", { name: "Float violations" });
    const details = list.closest("details");
    expect(details).not.toBeNull();
    expect(details!.open).toBe(false);
    expect(textOf(details!.querySelector("summary")!)).toBe(`Before auto-fix (${check.violations.length})`);
    // Auto-fix is not offered again while the fixed plan is current, and no export is promised.
    expect(within(panel).queryByRole("button", { name: "Auto-fix" })).toBeNull();
    expect(textOf(panel)).toContain("kept until you edit the design");
    expect(textOf(panel)).not.toContain("kept for export");
  });

  it("chooses the error action from the engine error code (10.4)", () => {
    // REPEAT_NOT_DIVISIBLE: 120 hooks and a 48-end repeat with repeat across on.
    const repeat = checkDesign({ design: grid(48, 8, () => 0), weaves: defaultWeaves(4), profile: PROFILE_120, repeatAcross: true });
    if (repeat.ok || repeat.error.code !== "REPEAT_NOT_DIVISIBLE") throw new Error("expected REPEAT_NOT_DIVISIBLE from the engine");
    const first = renderPanel({ check: repeat, profile: PROFILE_120, canUndo: true });
    fireEvent.click(within(floatPanel()).getByRole("button", { name: "Turn off repeat across" }));
    expect(first.onTurnOffRepeatAcross).toHaveBeenCalledTimes(1);
    expect(within(floatPanel()).queryByRole("button", { name: "Undo last change" })).toBeNull();
    first.unmount();

    // DESIGN_TOO_WIDE: 130 ends on 120 hooks.
    const wide = checkDesign({ design: grid(130, 8, () => 0), weaves: defaultWeaves(4), profile: PROFILE_120, repeatAcross: false });
    if (wide.ok || wide.error.code !== "DESIGN_TOO_WIDE") throw new Error("expected DESIGN_TOO_WIDE from the engine");
    const second = renderPanel({ check: wide, profile: PROFILE_120, canUndo: true });
    fireEvent.click(within(floatPanel()).getByRole("button", { name: "Choose a larger profile" }));
    expect(second.onChooseProfile).toHaveBeenCalledTimes(1);
    second.unmount();

    // Any other error keeps Undo.
    const other = checkDesign({ design: grid(8, 8, () => 9), weaves: defaultWeaves(4), profile: PROFILE_120, repeatAcross: false });
    if (other.ok) throw new Error("expected an engine error");
    const third = renderPanel({ check: other, profile: PROFILE_120, canUndo: true });
    fireEvent.click(within(floatPanel()).getByRole("button", { name: "Undo last change" }));
    expect(third.onUndo).toHaveBeenCalledTimes(1);
  });

  it("AUTOFIX_FAILED shows the violations that remain (10.3)", () => {
    // One pick: every end is up or down for the whole repeat, so no flip can bind it.
    const design = grid(8, 1, () => 0);
    const check = checked(design, PROFILE_120);
    expect(check.violations.length).toBeGreaterThan(0);
    const result = autoFix(check.plan, PROFILE_120);
    if (result.ok || result.error.code !== "AUTOFIX_FAILED") throw new Error("expected AUTOFIX_FAILED from the engine");
    const fix: FixState = {
      status: "failed",
      error: result.error,
      source: { design, weaves: defaultWeaves(4), profile: PROFILE_120, repeatAcross: false },
    };
    const { onUndo, onNextViolation } = renderPanel({ check, profile: PROFILE_120, fix, canUndo: true });
    const alert = within(floatPanel()).getByRole("alert");
    expect(textOf(alert)).toContain("Auto-fix could not remove every violation");
    fireEvent.click(within(alert).getByRole("button", { name: "Undo last change" }));
    expect(onUndo).toHaveBeenCalledTimes(1);
    fireEvent.click(within(alert).getByRole("button", { name: "Go to next violation" }));
    expect(onNextViolation).toHaveBeenCalledTimes(1);
    expect(within(alert).queryByRole("button", { name: "Retry" })).toBeNull();
    // The scrollable list is a named, focusable region.
    const scroll = within(alert).getByRole("region", { name: "Violations left after auto-fix, scrollable" });
    expect(scroll.tabIndex).toBe(0);
    const left = within(within(alert).getByRole("list", { name: "Violations left after auto-fix" })).getAllByRole("listitem");
    expect(left).toHaveLength(Math.min(result.error.remaining.length, 200));
    expect(textOf(left[0]!)).toMatch(/unbound · length \d+$/);
  });

  it("an auto-fix error offers Retry, Undo last change and Go to next violation", () => {
    const failing = checkDesign({ design: grid(8, 8, () => 9), weaves: defaultWeaves(4), profile: PROFILE_120, repeatAcross: false });
    if (failing.ok) throw new Error("expected an engine error");
    const design = grid(16, 16, (end) => Math.floor(end / 4) % 3);
    const check = checked(design, STRICT);
    expect(check.violations.length).toBeGreaterThan(0);
    const fix: FixState = { status: "error", error: failing.error, source: { design, weaves: defaultWeaves(4), profile: STRICT, repeatAcross: false } };
    const { onAutoFix, onUndo, onNextViolation } = renderPanel({ check, profile: STRICT, fix, canUndo: true });
    const alert = within(floatPanel()).getByRole("alert");
    expect(textOf(alert)).toContain("Auto-fix stopped with an error");
    fireEvent.click(within(alert).getByRole("button", { name: "Retry" }));
    expect(onAutoFix).toHaveBeenCalledTimes(1);
    fireEvent.click(within(alert).getByRole("button", { name: "Undo last change" }));
    expect(onUndo).toHaveBeenCalledTimes(1);
    fireEvent.click(within(alert).getByRole("button", { name: "Go to next violation" }));
    expect(onNextViolation).toHaveBeenCalledTimes(1);
  });

  it("an engine error shows its message in plain words, not as an empty list (10.4)", () => {
    const check: CheckResult = checkDesign({ design: grid(8, 8, () => 9), weaves: defaultWeaves(4), profile: PROFILE_120, repeatAcross: false });
    expect(check.ok).toBe(false);
    if (check.ok) return;
    renderPanel({ check, profile: PROFILE_120, canUndo: true });
    const alert = within(floatPanel()).getByRole("alert");
    expect(textOf(alert)).toContain("The engine could not check this design");
    expect(textOf(alert)).toContain(check.error.message);
    expect(textOf(alert)).not.toMatch(/at .*\.ts:\d+/);
  });
});
