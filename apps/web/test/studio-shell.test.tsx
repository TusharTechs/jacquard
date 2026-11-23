// The Studio shell (studio-experience 2.2, 2.3, 2.7, 2.9, 3.2, 4.3, 5.1): the rail marks the
// current Step and records it in the URL; Back returns; Alt+1..4 choose Steps outside text entry;
// each Step but Cards has one Continue action; cross-Step actions move focus; a Hint opens on tap
// and closes on Escape; toasts can be dismissed.
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { App } from "../src/app";
import { FRAMING_LINE } from "../src/components/shell/top-bar";
import { Hint } from "../src/components/ui/hint";
import { installDom, openStep, stubGalleryFetch, textOf } from "./dom-setup";

beforeEach(() => {
  installDom();
  stubGalleryFetch();
});

function railLinks(): HTMLAnchorElement[] {
  return within(screen.getByRole("navigation", { name: "Steps" })).getAllByRole("link") as HTMLAnchorElement[];
}

function current(): string {
  const link = railLinks().find((node) => node.getAttribute("aria-current") === "step");
  return link === undefined ? "" : textOf(link.querySelector(".rail-label")!);
}

function visibleHeadings(): string[] {
  return screen.getAllByRole("heading", { level: 2 }).map(textOf);
}

describe("studio shell", () => {
  it("shows the four Steps in order and starts on Design", () => {
    render(<App />);
    expect(railLinks().map((link) => textOf(link.querySelector(".rail-label")!))).toEqual(["Design", "Check", "Weave", "Cards"]);
    expect(current()).toBe("Design");
    expect(visibleHeadings()).toEqual(expect.arrayContaining(["Gallery", "Motif", "Loom setup", "Point paper"]));
    expect(visibleHeadings()).not.toContain("Float check");
    expect(textOf(document.querySelector("header p")!)).toBe(FRAMING_LINE);
  });

  it("records the Step in the URL and Back returns to the previous one (2.3)", () => {
    render(<App />);
    openStep("Weave");
    expect(window.location.hash).toBe("#/weave");
    expect(current()).toBe("Weave");
    act(() => {
      window.history.replaceState(null, "", "#/check");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(current()).toBe("Check");
    expect(visibleHeadings()).toEqual(expect.arrayContaining(["Point paper", "Float check", "Cloth simulation", "Weave per region"]));
  });

  it("opens on the Step named in the URL", () => {
    window.history.replaceState(null, "", "#/cards");
    render(<App />);
    expect(current()).toBe("Cards");
    expect(visibleHeadings()).toContain("Export");
  });

  it("has one Continue action per Step, none on Cards (3.2)", () => {
    render(<App />);
    const next = (): HTMLButtonElement[] => screen.queryAllByRole("button", { name: /^Continue to / }) as HTMLButtonElement[];
    for (const [from, to] of [["Design", "Check"], ["Check", "Weave"], ["Weave", "Cards"]] as const) {
      expect(current()).toBe(from);
      expect(next()).toHaveLength(1);
      expect(textOf(next()[0]!)).toBe(`Continue to ${to}`);
      fireEvent.click(next()[0]!);
      expect(current()).toBe(to);
    }
    expect(next()).toHaveLength(0);
  });

  it("Alt+1 to Alt+4 choose the Steps, but not while typing (2.9)", () => {
    render(<App />);
    fireEvent.keyDown(document.body, { key: "¡", code: "Digit3", altKey: true });
    expect(current()).toBe("Weave");
    fireEvent.keyDown(document.body, { key: "™", code: "Digit2", altKey: true });
    expect(current()).toBe("Check");
    fireEvent.keyDown(document.body, { key: "£", code: "Digit1", altKey: true });
    expect(current()).toBe("Design");
    const prompt = screen.getByLabelText("Describe the motif");
    fireEvent.keyDown(prompt, { key: "¢", code: "Digit4", altKey: true });
    expect(current()).toBe("Design");
  });

  it("the point-paper empty state's gallery action focuses the gallery from the Check Step (2.7)", () => {
    render(<App />);
    openStep("Check");
    const empty = screen.getByRole("heading", { name: "Point paper" }).closest("section")!.querySelector(".panel-empty")!;
    fireEvent.click(within(empty as HTMLElement).getByRole("button", { name: "Open a gallery example" }));
    expect(current()).toBe("Design");
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Gallery" }));
  });

  it("every rail link names its status for screen readers", () => {
    render(<App />);
    const names = railLinks().map((link) => textOf(link));
    expect(names[0]).toContain("48 by 48");
    expect(names[1]).toContain("nothing to check yet");
  });

  it("toasts are dismissible (4.3)", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Start from a blank grid" }));
    act(() => {
      window.dispatchEvent(new Event("offline"));
    });
    act(() => {
      window.dispatchEvent(new Event("online"));
    });
    const close = await waitFor(() => screen.getAllByRole("button", { name: /close toast/i }));
    expect(close.length).toBeGreaterThan(0);
  });
});

describe("deferred Steps (14.2)", () => {
  it("mounts the current Step first, a visited Step at once, and the rest in idle time", async () => {
    render(<App deferHiddenSteps />);
    expect(screen.getByRole("heading", { name: "Gallery" })).toBeTruthy();
    // Opening a Step mounts it in the same change.
    openStep("Cards");
    expect(screen.getByRole("heading", { name: "Export" })).toBeTruthy();
    openStep("Design");
    // The others arrive without a visit.
    await waitFor(() => expect(screen.getByRole("heading", { name: "Float check", hidden: true })).toBeTruthy());
    await waitFor(() => expect(screen.getByRole("heading", { name: "Loom", hidden: true })).toBeTruthy());
  });
});

describe("Hint (5.1)", () => {
  it("opens on tap, names its topic, and closes on Escape", async () => {
    render(
      <p>
        Short label <Hint topic="auto-fix">The longer explanation.</Hint>
      </p>,
    );
    const button = screen.getByRole("button", { name: "About auto-fix" });
    expect(screen.queryByRole("tooltip")).toBeNull();
    fireEvent.click(button);
    expect(textOf(await screen.findByRole("tooltip"))).toContain("The longer explanation.");
    fireEvent.keyDown(button, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("tooltip")).toBeNull());
  });

  it("opens on keyboard focus", async () => {
    render(<Hint topic="floats">Explained.</Hint>);
    act(() => screen.getByRole("button", { name: "About floats" }).focus());
    expect(textOf(await screen.findByRole("tooltip"))).toContain("Explained.");
  });
});
