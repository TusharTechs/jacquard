// The whole app (12.1 to 12.4, 9.3, 9.5): framing copy, accessible names on every control, the
// offline banner with the editor still usable, and keyboard painting with undo and redo.
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { App } from "../src/app";
import { accessibleName, installDom, textOf } from "./dom-setup";

function readout(): string {
  const node = document.querySelector(".readout");
  if (node === null) throw new Error("readout not found");
  return textOf(node);
}

function button(name: string): HTMLButtonElement {
  return screen.getByRole("button", { name }) as HTMLButtonElement;
}

/** All text a visitor can read or hear: text nodes plus labels, titles and tooltips. */
function allCopy(): string {
  const attributes = [...document.body.querySelectorAll("[aria-label], [title], [alt]")].flatMap((node) =>
    ["aria-label", "title", "alt"].map((name) => node.getAttribute(name) ?? ""),
  );
  return [document.body.textContent ?? "", ...attributes].join(" ").replace(/\s+/g, " ");
}

beforeEach(() => {
  installDom();
});

describe("app", () => {
  it("renders every panel", () => {
    render(<App />);
    for (const name of ["Loom setup", "Motif", "Point paper", "Float check", "Weave per region"]) {
      expect(screen.getByRole("heading", { name })).toBeTruthy();
    }
    expect(screen.getByRole("application")).toBeTruthy();
  });

  it("opens by saying punch cards are dead as a computing medium (product.md)", () => {
    render(<App />);
    const lede = document.querySelector("header p");
    expect(lede).not.toBeNull();
    const firstSentence = textOf(lede!).split(/(?<=\.)\s/)[0] ?? "";
    expect(firstSentence).toMatch(/punch cards are dead as a computing medium/i);
  });

  it("says the tool assists designers and card punchers and never that it replaces them (12.3)", () => {
    render(<App />);
    const copy = allCopy();
    expect(copy).toMatch(/helps designers and card punchers/i);
    const near = /(replac\w*|substitut\w*)[^.]{0,80}(designer|puncher|cutter|weaver)|(designer|puncher|cutter|weaver)s?[^.]{0,80}(replac\w*|substitut\w*|obsolete|no longer need)/i;
    const sentences = copy.split(/(?<=[.!?])\s/);
    const offending = sentences.filter((sentence) => near.test(sentence));
    expect(offending).toEqual([]);
  });

  it("states no statistic: no percentages or counts of workers, hours or money (12.3)", () => {
    render(<App />);
    const copy = allCopy();
    expect(copy).not.toMatch(/\d+\s*%/);
    expect(copy).not.toMatch(/\d[\d,.]*\s*(lakh|million|billion|workers|weavers|hours|days|rupees|dollars|₹|\$)/i);
  });

  it("gives every button, input, select and textarea an accessible name", () => {
    render(<App />);
    const controls = [...document.body.querySelectorAll<HTMLElement>("button, input, select, textarea, [role='application']")];
    expect(controls.length).toBeGreaterThan(10);
    const unnamed = controls
      .filter((control) => accessibleName(control) === "")
      .map((control) => control.outerHTML.slice(0, 120));
    expect(unnamed).toEqual([]);
  });

  it("shows the offline banner and keeps the editor usable; back online offers generating again (12.4)", () => {
    render(<App />);
    expect(screen.queryByText("You are offline.")).toBeNull();
    act(() => {
      window.dispatchEvent(new Event("offline"));
    });
    expect(screen.getByText("You are offline.")).toBeTruthy();
    expect(textOf(document.body)).toContain("Generating needs the network. You can keep editing the grid by hand.");
    expect(button("Generate motif").disabled).toBe(true);

    const canvas = screen.getByRole("application");
    act(() => canvas.focus());
    fireEvent.keyDown(canvas, { key: "2" });
    fireEvent.keyDown(canvas, { key: " " });
    expect(readout()).toBe("end 0 · pick 0 · region 1");
    expect(button("Undo").disabled).toBe(false);

    act(() => {
      window.dispatchEvent(new Event("online"));
    });
    expect(screen.queryByText("You are offline.")).toBeNull();
    expect(textOf(document.body)).toContain("Back online. You can generate a motif again.");
  });

  it("paints from the keyboard, then undoes with Ctrl+Z and redoes with Ctrl+Shift+Z and Ctrl+Y (9.3, 9.5)", () => {
    render(<App />);
    const canvas = screen.getByRole("application");
    act(() => canvas.focus());
    expect(button("Undo").disabled).toBe(true);

    fireEvent.keyDown(canvas, { key: "ArrowRight" });
    fireEvent.keyDown(canvas, { key: "ArrowRight" });
    fireEvent.keyDown(canvas, { key: "ArrowUp" });
    expect(readout()).toBe("end 2 · pick 1 · region 0");

    fireEvent.keyDown(canvas, { key: "3" });
    expect(textOf(document.querySelector(".toolbar-region")!)).toContain("Painting region 2");
    fireEvent.keyDown(canvas, { key: " " });
    expect(readout()).toBe("end 2 · pick 1 · region 2");
    expect(button("Undo").disabled).toBe(false);

    fireEvent.keyDown(canvas, { key: "z", ctrlKey: true });
    expect(readout()).toBe("end 2 · pick 1 · region 0");
    expect(button("Undo").disabled).toBe(true);
    expect(button("Redo").disabled).toBe(false);

    fireEvent.keyDown(canvas, { key: "Z", ctrlKey: true, shiftKey: true });
    expect(readout()).toBe("end 2 · pick 1 · region 2");

    fireEvent.keyDown(canvas, { key: "z", ctrlKey: true });
    fireEvent.keyDown(canvas, { key: "y", ctrlKey: true });
    expect(readout()).toBe("end 2 · pick 1 · region 2");

    fireEvent.keyDown(canvas, { key: "Enter" });
    fireEvent.keyDown(canvas, { key: "ArrowDown" });
    expect(readout()).toBe("end 2 · pick 0 · region 0");
  });

  it("the REPEAT_NOT_DIVISIBLE action in the float panel turns repeat across off (10.4)", async () => {
    render(<App />);
    const setup = screen.getByRole("heading", { name: "Loom setup" }).closest("section")!;
    fireEvent.change(within(setup).getByLabelText("Loom profile"), { target: { value: "120" } });
    const toggle = within(setup).getByRole("switch") as HTMLInputElement;
    fireEvent.click(toggle);
    expect(toggle.checked).toBe(true);
    const floats = screen.getByRole("heading", { name: "Float check" }).closest("section")!;
    const action = await waitFor(() => within(floats).getByRole("button", { name: "Turn off repeat across" }));
    fireEvent.click(action);
    expect(toggle.checked).toBe(false);
    await waitFor(() => expect(within(floats).queryByRole("alert")).toBeNull());
  });

  it("in Scroll mode a one-finger drag does not paint; in Paint mode it does (9.2)", () => {
    render(<App />);
    const canvas = screen.getByRole("application");
    // jsdom reports a zero-sized box, so client coordinates are grid coordinates at 8px cells.
    const drag = (pointerId: number): void => {
      fireEvent.pointerDown(canvas, { pointerId, pointerType: "touch", isPrimary: true, clientX: 4, clientY: 380 });
      fireEvent.pointerMove(canvas, { pointerId, pointerType: "touch", isPrimary: true, clientX: 60, clientY: 380 });
      fireEvent.pointerUp(canvas, { pointerId, pointerType: "touch", isPrimary: true, clientX: 60, clientY: 380 });
    };
    // Region 1, so a painted cell differs from the blank grid and makes an undoable edit.
    fireEvent.keyDown(window, { key: "2" });
    fireEvent.click(button("Scroll"));
    expect(button("Scroll").getAttribute("aria-pressed")).toBe("true");
    expect(canvas.style.touchAction).toBe("pan-x pan-y pinch-zoom");
    drag(1);
    expect(button("Undo").disabled).toBe(true);
    fireEvent.click(button("Paint"));
    expect(canvas.style.touchAction).toBe("none");
    drag(2);
    expect(button("Undo").disabled).toBe(false);
  });
});
