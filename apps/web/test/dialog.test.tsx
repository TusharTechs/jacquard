// Shared Dialog: focus returns to the element focused before opening, and falls back to
// `fallbackFocus` when that element is disabled or gone, so it never lands on the page body.
import { fireEvent, render, screen } from "@testing-library/react";
import { useRef, useState } from "react";
import { beforeEach, describe, expect, it } from "vitest";
import { Dialog } from "../src/components/ui/dialog";
import { installDom } from "./dom-setup";

function Harness({ opener }: { opener: "stays" | "disabled" | "removed" }) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const heading = useRef<HTMLHeadingElement | null>(null);
  return (
    <section>
      <h2 ref={heading} tabIndex={-1}>
        Panel heading
      </h2>
      {opener === "removed" && done ? null : (
        <button type="button" disabled={opener === "disabled" && done} onClick={() => setOpen(true)}>
          Open
        </button>
      )}
      <Dialog open={open} title="Confirm" onClose={() => setOpen(false)} fallbackFocus={heading}>
        <button
          type="button"
          onClick={() => {
            setDone(true);
            setOpen(false);
          }}
        >
          Go
        </button>
      </Dialog>
    </section>
  );
}

function openAndConfirm(): void {
  const opener = screen.getByRole("button", { name: "Open" });
  opener.focus();
  fireEvent.click(opener);
  fireEvent.click(screen.getByRole("button", { name: "Go" }));
}

beforeEach(() => {
  installDom();
});

describe("dialog focus", () => {
  it("returns focus to the opener when it can take focus", () => {
    render(<Harness opener="stays" />);
    openAndConfirm();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Open" }));
  });

  it.each(["disabled", "removed"] as const)("falls back to the panel heading when the opener is %s", (opener) => {
    render(<Harness opener={opener} />);
    openAndConfirm();
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Panel heading" }));
    expect(document.activeElement).not.toBe(document.body);
  });
});
