// The Opening (studio-experience 10.1 to 10.5): shown once, on the first visit to Design; Skip,
// Escape and a click end it and focus moves to the Studio; it ends by itself in under 4 seconds;
// the menu replays it.
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OPENING_EVENT, OPENING_KEY, OPENING_LINE, OPENING_MS, Opening } from "../src/opening";
import { installDom } from "./dom-setup";

function Studio() {
  return (
    <div className="studio">
      <h1 id="studio-title" tabIndex={-1}>
        JACQUARD
      </h1>
      <button type="button">In the studio</button>
    </div>
  );
}

beforeEach(() => {
  installDom();
  localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("opening", () => {
  it("shows the line on the first visit, with Skip focused and the Studio inert (10.1, 10.2)", () => {
    render(
      <>
        <Studio />
        <Opening />
      </>,
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog.textContent).toContain(OPENING_LINE);
    expect(OPENING_MS).toBeLessThan(4000);
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Skip" }));
    expect(document.querySelector(".studio")!.hasAttribute("inert")).toBe(true);
  });

  it("Skip ends it, remembers it and focuses the Studio title (10.2, 10.3)", async () => {
    render(
      <>
        <Studio />
        <Opening />
      </>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Skip" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(localStorage.getItem(OPENING_KEY)).not.toBeNull();
    expect(document.querySelector(".studio")!.hasAttribute("inert")).toBe(false);
    await new Promise((resolve) => requestAnimationFrame(resolve));
    expect(document.activeElement).toBe(document.getElementById("studio-title"));
  });

  it("Escape and Enter end it", () => {
    const { unmount } = render(<Opening />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    unmount();
    localStorage.clear();
    render(<Opening />);
    fireEvent.keyDown(window, { key: "Enter" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("ends by itself in under 4 seconds", () => {
    vi.useFakeTimers();
    render(<Opening />);
    expect(screen.getByRole("dialog")).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(OPENING_MS);
    });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("is not shown again, nor when the URL names another Step (10.3)", () => {
    localStorage.setItem(OPENING_KEY, "1");
    const { unmount } = render(<Opening />);
    expect(screen.queryByRole("dialog")).toBeNull();
    unmount();
    localStorage.clear();
    window.history.replaceState(null, "", "#/check");
    render(<Opening />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("the menu's replay event shows it again", () => {
    localStorage.setItem(OPENING_KEY, "1");
    render(<Opening />);
    act(() => {
      window.dispatchEvent(new CustomEvent(OPENING_EVENT));
    });
    expect(screen.getByRole("dialog").textContent).toContain(OPENING_LINE);
  });
});
