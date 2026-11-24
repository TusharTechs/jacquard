// The Cards Step (studio-experience 12.1 to 12.4, 3.2, 3.3): the chain is a keyboard listbox in
// lacing order, the selected card shows its number and punched count from the engine's card,
// "Print cards" leads and prints every card; and the first-minute path from an empty Studio to
// printing takes at most six activations with no typing.
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { PROFILE_120, buildCards } from "@jacquard/engine";
import type { Design } from "@jacquard/engine";
import { CARD_SHEET_NOTE } from "@jacquard/export";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../src/app";
import { CardsStep } from "../src/components/cards/cards-step";
import { defaultWeaves } from "../src/lib/default-weaves";
import { checkDesign } from "../src/lib/engine-check";
import { installDom, stubGalleryFetch, textOf } from "./dom-setup";

function grid(ends: number, picks: number, cell: (end: number, pick: number) => number): Design {
  return Array.from({ length: picks }, (_, pick) => Array.from({ length: ends }, (_, end) => cell(end, pick)));
}

const check = checkDesign({ design: grid(16, 10, (end, pick) => ((end >> 1) + pick) % 2), weaves: defaultWeaves(2), profile: PROFILE_120, repeatAcross: false });
if (!check.ok) throw new Error("fixture");
const PLAN = check.plan;
const CARDS = (() => {
  const built = buildCards(PLAN, PROFILE_120);
  if (!built.ok) throw new Error("fixture");
  return built.value.cards;
})();

function renderStep(violationCount = 0) {
  const handlers = { onOpenGallery: vi.fn(), onGoToDesign: vi.fn(), onGoToFloatCheck: vi.fn(), onAutoFix: vi.fn() };
  render(
    <CardsStep
      plan={PLAN}
      profile={PROFILE_120}
      profileName="120"
      blank={false}
      planSource="design"
      violationCount={violationCount}
      checking={false}
      {...handlers}
    />,
  );
  return handlers;
}

beforeEach(() => {
  installDom();
});

describe("cards step", () => {
  it("leads with Print cards and shows card 1 large with its punched count (3.2, 12.1, 12.2)", () => {
    renderStep();
    const print = screen.getByRole("button", { name: "Print cards" });
    expect(print.className).toContain("btn-primary");
    const holes = CARDS[0]!.punched.filter(Boolean).length;
    expect(screen.getByRole("img", { name: `Card 1 of ${CARDS.length}, ${holes} ${holes === 1 ? "hole" : "holes"} punched` })).toBeTruthy();
  });

  it("the chain is a listbox in lacing order, moved by arrows, Home and End (12.2)", () => {
    renderStep();
    const list = screen.getByRole("listbox", { name: "Card chain, in lacing order" });
    const selected = (): string => textOf(document.querySelector(".chain-number")!);
    expect(selected()).toBe("Card 1");
    const options = within(list).getAllByRole("option");
    expect(options.length).toBe(Math.min(24, CARDS.length));
    fireEvent.keyDown(list, { key: "ArrowRight" });
    expect(selected()).toBe("Card 2");
    expect(list.getAttribute("aria-activedescendant")).toBe(within(list).getByRole("option", { selected: true }).id);
    fireEvent.keyDown(list, { key: "End" });
    expect(selected()).toBe(`Card ${CARDS.length}`);
    fireEvent.keyDown(list, { key: "ArrowRight" });
    expect(selected()).toBe("Card 1");
    fireEvent.click(within(list).getByRole("option", { name: /^Card 4, / }));
    expect(selected()).toBe("Card 4");
  });

  it("prints every card, numbered in lacing order, with the untested-format note (12.3)", () => {
    const print = vi.fn();
    vi.stubGlobal("print", print);
    renderStep();
    fireEvent.click(screen.getByRole("button", { name: "Print cards" }));
    expect(print).toHaveBeenCalledTimes(1);
    const sheet = document.querySelector(".print-sheet")!;
    expect(sheet.parentElement).toBe(document.body);
    expect(textOf(sheet)).toContain(CARD_SHEET_NOTE);
    const printed = [...sheet.querySelectorAll("svg[data-card]")].map((node) => Number(node.getAttribute("data-card")));
    expect(printed).toEqual(CARDS.map((card) => card.number));
    const punched = [...sheet.querySelectorAll("svg[data-card]")].map((node) => Number(node.getAttribute("data-punched")));
    expect(punched).toEqual(CARDS.map((card) => card.punched.filter(Boolean).length));
    act(() => {
      window.dispatchEvent(new Event("afterprint"));
    });
    expect(document.querySelector(".print-sheet")).toBeNull();
  });

  it("never prints long floats without asking: auto-fix or Print anyway (6.2 gate)", () => {
    const print = vi.fn();
    vi.stubGlobal("print", print);
    const { onAutoFix } = renderStep(3);
    expect(textOf(document.body)).toContain("3 float violations in the lift plan. Print asks first.");
    fireEvent.click(screen.getByRole("button", { name: "Print cards" }));
    expect(print).not.toHaveBeenCalled();
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Print anyway" }));
    expect(print).toHaveBeenCalledTimes(1);
    expect(textOf(document.querySelector(".print-sheet")!)).toContain("which has 3 float violations");
    fireEvent.click(screen.getByRole("button", { name: "Print cards" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Auto-fix and print" }));
    expect(onAutoFix).toHaveBeenCalledTimes(1);
    expect(print).toHaveBeenCalledTimes(1);
  });

  it("the chain's options give their place in the whole set", () => {
    renderStep();
    const option = within(screen.getByRole("listbox")).getByRole("option", { selected: true });
    expect(option.getAttribute("aria-setsize")).toBe(String(CARDS.length));
    expect(option.getAttribute("aria-posinset")).toBe("1");
  });

  it("the browser's print command renders the sheet too", () => {
    renderStep();
    act(() => {
      window.dispatchEvent(new Event("beforeprint"));
    });
    expect(document.querySelectorAll(".print-sheet svg[data-card]")).toHaveLength(CARDS.length);
  });
});

describe("first minute (3.3)", () => {
  it("from the empty Studio to printing in at most six activations, no typing", async () => {
    stubGalleryFetch();
    const print = vi.fn();
    vi.stubGlobal("print", print);
    render(<App />);
    let activations = 0;
    const press = (element: HTMLElement): void => {
      activations += 1;
      fireEvent.click(element);
    };
    press(await waitFor(() => screen.getByRole("button", { name: "Open example: Temple stripe" })));
    press(screen.getByRole("button", { name: "Continue to Check" }));
    press(screen.getByRole("button", { name: "Continue to Weave" }));
    // The loom is on screen with the woven design's cards.
    expect(textOf(document.querySelector(".loom-readout")!)).toMatch(/^Card \d+ of \d+/);
    press(screen.getByRole("button", { name: "Continue to Cards" }));
    press(screen.getByRole("button", { name: "Print cards" }));
    expect(print).toHaveBeenCalledTimes(1);
    expect(activations).toBeLessThanOrEqual(6);
    expect(document.querySelectorAll(".print-sheet svg[data-card]").length).toBeGreaterThan(0);
  });
});
