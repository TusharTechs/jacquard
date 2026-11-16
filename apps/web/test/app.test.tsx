// The whole app (12.1 to 12.4, 9.3, 9.5): framing copy, accessible names on every control, the
// offline banner with the editor still usable, and keyboard painting with undo and redo.
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
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
  it("shows the cloth simulator and the export panel, empty until there is a design (2.5, 6.1)", () => {
    render(<App />);
    const simulator = screen.getByRole("heading", { name: "Cloth simulation" }).closest("section")!;
    const exports = screen.getByRole("heading", { name: "Export" }).closest("section")!;
    expect(textOf(simulator)).toContain("No cloth to show yet");
    expect(textOf(exports)).toContain("Nothing to export yet");
    fireEvent.click(within(exports).getByRole("button", { name: "Start from a blank grid" }));
    expect(textOf(simulator)).toContain("Showing the lift plan of the current design");
    expect(simulator.querySelector("canvas")).not.toBeNull();
    expect(within(exports).getByRole("button", { name: "Cards (PDF)" })).toBeTruthy();
    // The weft yarn starts as region 0's display colour; the warp is a dark neutral.
    const [warp, weft] = [...simulator.querySelectorAll<HTMLInputElement>('input[type="color"]')];
    expect(warp!.value).toBe("#2b2b2b");
    expect(weft!.value).toBe("#f3ead8");
  });
  it("exporting cards right after a stroke that adds violations never downloads without the gate (6.2)", async () => {
    const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    render(<App />);
    const weaves = screen.getByRole("heading", { name: "Weave per region" }).closest("section")!;
    fireEvent.change(within(weaves).getByLabelText("Region 0"), { target: { value: "satin-8-3-warp" } });
    const canvas = screen.getByRole("application");
    fireEvent.keyDown(window, { key: "2" });
    fireEvent.pointerDown(canvas, { pointerId: 1, pointerType: "mouse", isPrimary: true, button: 0, buttons: 1, clientX: 164, clientY: 4 });
    fireEvent.pointerMove(canvas, { pointerId: 1, pointerType: "mouse", isPrimary: true, buttons: 1, clientX: 164, clientY: 380 });
    fireEvent.pointerUp(canvas, { pointerId: 1, pointerType: "mouse", isPrimary: true, clientX: 164, clientY: 380 });
    // No waiting for the float check: click straight after the stroke.
    const exports = screen.getByRole("heading", { name: "Export" }).closest("section")!;
    const cards = within(exports).getByRole("button", { name: "Cards (PDF)" });
    fireEvent.click(cards);
    const gate = (): HTMLElement | null =>
      [...document.querySelectorAll("dialog")].find((node) => node.hasAttribute("open") && textOf(node).includes("The float check reports violations")) ?? null;
    // Either the button waits for the check, or the gate is open; a click is never a silent export.
    if (cards.getAttribute("aria-disabled") === "true") {
      expect(textOf(exports)).toContain("Checking floats…");
      await waitFor(() => expect(cards.getAttribute("aria-disabled")).toBeNull());
      fireEvent.click(cards);
    }
    await waitFor(() => expect(gate()).not.toBeNull());
    expect(textOf(gate()!)).toMatch(/\d+ float violations?/);
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(anchorClick).not.toHaveBeenCalled();
  });
  it("after auto-fix the simulator and the exports use the fixed lift plan (2.4, 6.3)", async () => {
    render(<App />);
    // Region 0 warp-faced satin 8 with one end of region 1 gives floats past the limit of 8.
    const weaves = screen.getByRole("heading", { name: "Weave per region" }).closest("section")!;
    fireEvent.change(within(weaves).getByLabelText("Region 0"), { target: { value: "satin-8-3-warp" } });
    const canvas = screen.getByRole("application");
    fireEvent.keyDown(window, { key: "2" });
    fireEvent.pointerDown(canvas, { pointerId: 1, pointerType: "mouse", isPrimary: true, button: 0, buttons: 1, clientX: 164, clientY: 4 });
    fireEvent.pointerMove(canvas, { pointerId: 1, pointerType: "mouse", isPrimary: true, buttons: 1, clientX: 164, clientY: 380 });
    fireEvent.pointerUp(canvas, { pointerId: 1, pointerType: "mouse", isPrimary: true, clientX: 164, clientY: 380 });
    const floats = screen.getByRole("heading", { name: "Float check" }).closest("section")!;
    const autoFix = await waitFor(() => within(floats).getByRole("button", { name: "Auto-fix" }));
    const simulator = screen.getByRole("heading", { name: "Cloth simulation" }).closest("section")!;
    const exports = screen.getByRole("heading", { name: "Export" }).closest("section")!;
    expect(textOf(simulator)).toContain("Showing the lift plan of the current design");
    expect(textOf(exports)).toMatch(/\d+ float violations? in the lift plan/);
    fireEvent.click(autoFix);
    await waitFor(() => expect(textOf(simulator)).toContain("Showing the fixed lift plan from auto-fix"));
    expect(textOf(exports)).toContain("Exports use the fixed lift plan from auto-fix");
  });
});
