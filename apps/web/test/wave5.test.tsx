// Wave 5 (studio-experience 18.2, 19.1 to 19.3, 20.1): the View popover holds the secondary point
// paper controls and returns focus; Shortcuts from it returns focus to View; the setup is folded
// with an Edit summary; without 3D there is no Cloth view button; the new Opening line.
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PROFILE_120 } from "@jacquard/engine";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../src/app";
import { WeaveStep } from "../src/components/weave/weave-step";
import { defaultWeaves } from "../src/lib/default-weaves";
import { checkDesign } from "../src/lib/engine-check";
import { OPENING_LINE } from "../src/opening";
import { installDom, openView, stubGalleryFetch, textOf } from "./dom-setup";

beforeEach(() => {
  installDom();
  stubGalleryFetch();
});

describe("View popover (19.1, 19.2)", () => {
  it("keeps Undo, Redo, Fit and the region in the toolbar and the rest behind View", () => {
    render(<App />);
    for (const name of ["Undo", "Redo", "Fit"]) expect(screen.getByRole("button", { name })).toBeTruthy();
    expect(textOf(document.querySelector(".toolbar-region")!)).toContain("Painting region 0");
    for (const name of ["Zoom in", "Zoom out", "Paint", "Scroll", "Shortcuts"]) expect(screen.queryByRole("button", { name })).toBeNull();
    const view = screen.getByRole("button", { name: "View" });
    expect(view.getAttribute("aria-expanded")).toBe("false");
    openView();
    expect(view.getAttribute("aria-expanded")).toBe("true");
    for (const name of ["Zoom in", "Zoom out", "Paint", "Scroll", "Shortcuts"]) expect(screen.getByRole("button", { name })).toBeTruthy();
    expect(screen.getByLabelText(/Show region numbers/)).toBeTruthy();
  });

  it("Escape closes it and focus returns to View", async () => {
    render(<App />);
    const view = screen.getByRole("button", { name: "View" });
    act(() => view.focus());
    openView();
    fireEvent.keyDown(screen.getByRole("button", { name: "Zoom in" }), { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("button", { name: "Zoom in" })).toBeNull());
    expect(document.activeElement).toBe(view);
  });

  it("Shortcuts opens the dialog, and closing it returns focus to View", async () => {
    render(<App />);
    openView();
    fireEvent.click(screen.getByRole("button", { name: "Shortcuts" }));
    const dialog = [...document.querySelectorAll("dialog")].find((node) => node.hasAttribute("open"))!;
    expect(textOf(dialog)).toContain("Point paper shortcuts");
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: "View" })));
  });

  it("names Scroll mode on the button", () => {
    render(<App />);
    openView();
    fireEvent.click(screen.getByRole("button", { name: "Scroll" }));
    expect(screen.getByRole("button", { name: "View · Scroll" })).toBeTruthy();
  });
});

describe("Loom setup folded with Edit (19.3)", () => {
  it("is folded with its summary and Edit, and the setup chip opens it", () => {
    render(<App />);
    const details = document.querySelector<HTMLDetailsElement>(".setup-details")!;
    expect(details.open).toBe(false);
    expect(textOf(details.querySelector("summary")!)).toMatch(/240 hooks · 3 colours · 48×48.*Edit$/);
    fireEvent.click(screen.getByRole("button", { name: /^Loom setup: / }));
    expect(details.open).toBe(true);
    expect(textOf(details.querySelector("summary")!)).toMatch(/Done$/);
  });
});

describe("Cloth view without 3D (18.2)", () => {
  it("is not offered when there is no 3D loom", () => {
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("reduce"), media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
    const check = checkDesign({ design: [[0, 1, 0, 1, 1, 0, 1, 0]], weaves: defaultWeaves(2), profile: PROFILE_120, repeatAcross: false });
    if (!check.ok) throw new Error("fixture");
    render(
      <WeaveStep
        plan={check.plan}
        planSource="design"
        profile={PROFILE_120}
        yarns={{ warp: ["#2b2b2b"], weft: ["#d9a441"] }}
        violationCount={0}
        visible
        emptyReason="blank"
        webgl={false}
        onGoToFloatCheck={vi.fn()}
        onOpenGallery={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: "Cloth view" })).toBeNull();
  });
});

describe("Opening line (20.1)", () => {
  it("reads as the brief gives it", () => {
    expect(OPENING_LINE).toBe("In 1804, a loom read punch cards. Computers borrowed the idea. Handlooms still use it.");
  });
});
