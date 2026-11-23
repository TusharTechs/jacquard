// The Weave Step without WebGL (studio-experience 3.4, 6.6, 7.1 to 7.6, 8.2, 8.3): the loom says
// it could not start in 3D, and the transport, readout and card strip still work from the engine's
// cards; autoplay is on unless motion is reduced; sound is off until switched on.
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { PROFILE_120 } from "@jacquard/engine";
import type { Design } from "@jacquard/engine";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NO_WEBGL_MESSAGE, WeaveStep } from "../src/components/weave/weave-step";
import type { WeaveStepProps } from "../src/components/weave/weave-step";
import { defaultWeaves } from "../src/lib/default-weaves";
import { checkDesign } from "../src/lib/engine-check";
import { buildLoomModel, liftedCount } from "../src/lib/loom-model";
import { installDom, textOf } from "./dom-setup";

function grid(ends: number, picks: number, cell: (end: number, pick: number) => number): Design {
  return Array.from({ length: picks }, (_, pick) => Array.from({ length: ends }, (_, end) => cell(end, pick)));
}

const check = checkDesign({ design: grid(16, 12, (end, pick) => ((end >> 2) + pick) % 2), weaves: defaultWeaves(2), profile: PROFILE_120, repeatAcross: false });
if (!check.ok) throw new Error("fixture");
const PLAN = check.plan;
const YARNS = { warp: ["#2b2b2b"], weft: ["#d9a441"] };
const MODEL = (() => {
  const built = buildLoomModel(PLAN, PROFILE_120, YARNS);
  if (!built.ok) throw new Error("fixture");
  return built.value;
})();

function renderStep(props: Partial<WeaveStepProps> = {}) {
  const handlers = { onOpenGallery: vi.fn(), onGoToFloatCheck: vi.fn() };
  const view = render(
    <WeaveStep
      plan={PLAN}
      planSource="design"
      profile={PROFILE_120}
      yarns={YARNS}
      violationCount={0}
      visible
      emptyReason="blank"
      webgl={false}
      {...handlers}
      {...props}
    />,
  );
  return { ...view, ...handlers };
}

function readout(): string {
  return textOf(document.querySelector(".loom-readout")!);
}

function reducedMotion(reduce: boolean): void {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: reduce && query.includes("prefers-reduced-motion"),
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}

beforeEach(() => {
  installDom();
});

describe("weave step", () => {
  it("without WebGL says so in one line and keeps the controls (6.6)", () => {
    reducedMotion(true);
    renderStep();
    expect(screen.getByText(NO_WEBGL_MESSAGE)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Play" })).toBeTruthy();
    expect(readout()).toContain("Card 1");
    expect(readout()).toContain(`of ${PLAN.pickCount}`);
    expect(document.querySelector(".loom-stage canvas")).toBeNull();
  });

  it("starts weaving by itself when it opens (3.4)", () => {
    reducedMotion(false);
    renderStep();
    expect(screen.getByRole("button", { name: "Pause" })).toBeTruthy();
  });

  it("does not start by itself with reduced motion (7.5)", () => {
    reducedMotion(true);
    renderStep();
    expect(screen.getByRole("button", { name: "Play" })).toBeTruthy();
  });

  it("steps pick by pick: card n weaves pick n - 1 and the lifted count comes from the engine's card (7.1, 7.2)", () => {
    reducedMotion(true);
    renderStep();
    const next = screen.getByRole("button", { name: "Next pick" });
    for (let pick = 1; pick < 4; pick += 1) {
      fireEvent.click(next);
      const lifted = liftedCount(MODEL, pick);
      expect(readout()).toBe(`Card ${pick + 1} of ${PLAN.pickCount} · pick ${pick} · ${lifted} ${lifted === 1 ? "hook" : "hooks"} lifted`);
      const plan = PLAN.lifts[pick]!.filter(Boolean).length;
      expect(lifted).toBe(plan);
    }
    fireEvent.click(screen.getByRole("button", { name: "Previous pick" }));
    expect(readout()).toContain("Card 3");
    // A step is announced once, in words.
    expect(textOf(document.querySelector(".loom-side [aria-live='polite']")!)).toBe(
      `Card 3 of ${PLAN.pickCount}, pick 2, ${liftedCount(MODEL, 2)} ${liftedCount(MODEL, 2) === 1 ? "hook" : "hooks"} lifted`,
    );
  });

  it("the scrubber moves by keyboard and the strip marks the card on the loom (7.1, 7.2)", () => {
    reducedMotion(true);
    renderStep();
    const thumb = screen.getByRole("slider", { name: "Pick" });
    act(() => thumb.focus());
    fireEvent.keyDown(thumb, { key: "End" });
    expect(readout()).toContain(`Card ${PLAN.pickCount}`);
    fireEvent.keyDown(thumb, { key: "Home" });
    expect(readout()).toContain("Card 1");
    const strip = screen.getByRole("list", { name: /lacing order/ });
    const current = within(strip).getByRole("button", { current: true });
    expect(current.getAttribute("aria-label")).toMatch(/^Card 1, \d+ holes? punched, on the loom$/);
    // The strip wraps: the card before card 1 is the last card.
    const labels = within(strip).getAllByRole("button").map((button) => button.getAttribute("aria-label"));
    expect(labels[0]).toMatch(new RegExp(`^Card ${PLAN.pickCount}, `));
    fireEvent.click(within(strip).getByRole("button", { name: /^Card 3, / }));
    expect(readout()).toContain("Card 3");
  });

  it("offers four speeds, one pressed (7.1)", () => {
    reducedMotion(true);
    renderStep();
    const speeds = within(screen.getByRole("group", { name: "Speed" })).getAllByRole("button");
    expect(speeds.map(textOf)).toEqual(["0.5×", "1×", "2×", "4×"]);
    expect(speeds.map((button) => button.getAttribute("aria-pressed"))).toEqual(["false", "true", "false", "false"]);
    fireEvent.click(speeds[3]!);
    expect(speeds[3]!.getAttribute("aria-pressed")).toBe("true");
  });

  it("sound is off until switched on, a toggle with a constant name (8.2, 8.3)", () => {
    reducedMotion(true);
    renderStep();
    const sound = screen.getByRole("button", { name: "Sound" });
    expect(sound.getAttribute("aria-pressed")).toBe("false");
  });

  it("the step buttons stay focusable at either end (aria-disabled, not disabled)", () => {
    reducedMotion(true);
    renderStep();
    const previous = screen.getByRole("button", { name: "Previous pick" }) as HTMLButtonElement;
    expect(previous.disabled).toBe(false);
    expect(previous.getAttribute("aria-disabled")).toBe("true");
    act(() => previous.focus());
    fireEvent.click(previous);
    expect(document.activeElement).toBe(previous);
    expect(readout()).toContain("Card 1");
  });

  it("paused at pick 0, the shed is open: the readout's lifted hooks are the hooks raised", () => {
    reducedMotion(true);
    renderStep();
    expect(readout()).toContain(`${liftedCount(MODEL, 0)} ${liftedCount(MODEL, 0) === 1 ? "hook" : "hooks"} lifted`);
  });

  it("the blank state offers a gallery example", () => {
    reducedMotion(true);
    const { onOpenGallery } = renderStep({ plan: null, emptyReason: "blank" });
    fireEvent.click(screen.getByRole("button", { name: "Open a gallery example" }));
    expect(onOpenGallery).toHaveBeenCalledTimes(1);
  });

  it("names the plan it weaves and links violations to the float check (7.3, 7.4)", () => {
    reducedMotion(true);
    const { onGoToFloatCheck } = renderStep({ violationCount: 3 });
    expect(textOf(document.body)).toContain("Showing the lift plan of the current design");
    expect(textOf(document.body)).toContain("3 float violations in this plan.");
    fireEvent.click(screen.getByRole("button", { name: "Go to the float check" }));
    expect(onGoToFloatCheck).toHaveBeenCalledTimes(1);
  });

  it("shows the simulator's empty states without a plan (7.6)", () => {
    reducedMotion(true);
    const { rerender, onGoToFloatCheck } = renderStep({ plan: null });
    expect(textOf(document.querySelector(".panel-empty")!)).toContain("Nothing to weave yet");
    rerender(
      <WeaveStep
        plan={null}
        planSource="design"
        profile={PROFILE_120}
        yarns={YARNS}
        violationCount={0}
        visible
        emptyReason="engineError"
        webgl={false}
        onOpenGallery={vi.fn()}
        onGoToFloatCheck={onGoToFloatCheck}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Go to the float check" }));
    expect(onGoToFloatCheck).toHaveBeenCalledTimes(1);
  });
});
