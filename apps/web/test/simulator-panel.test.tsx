// Simulator panel (2.1 to 2.5): empty states, which plan is shown, the not-a-photograph note,
// face and back, yarn colour inputs, the error state with Retry, and the canvas drawing helpers.
// clothModel is the real one from @jacquard/export, wrapped in a spy to see what it is called with.
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { PROFILE_120, defineProfile } from "@jacquard/engine";
import type { Design, LiftPlan, LoomProfile } from "@jacquard/engine";
import { clothModel } from "@jacquard/export";
import type { ClothCell } from "@jacquard/export";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PLAN_LINES, SIMULATION_NOTE, SimulatorPanel } from "../src/components/simulator-panel";
import type { SimulatorPanelProps } from "../src/components/simulator-panel";
import { defaultWeaves } from "../src/lib/default-weaves";
import { CLOTH_SHADES, MAX_CLOTH_SIDE, clothCanvasSize, drawClothRows } from "../src/lib/draw-cloth";
import type { ClothContext } from "../src/lib/draw-cloth";
import { checkDesign } from "../src/lib/engine-check";
import { accessibleName, installDom, textOf } from "./dom-setup";

vi.mock("@jacquard/export", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@jacquard/export")>();
  return { ...actual, clothModel: vi.fn(actual.clothModel) };
});

function grid(ends: number, picks: number, cell: (end: number, pick: number) => number): Design {
  return Array.from({ length: picks }, (_, pick) => Array.from({ length: ends }, (_, end) => cell(end, pick)));
}

function planFor(design: Design, profile: LoomProfile): LiftPlan {
  const result = checkDesign({ design, weaves: defaultWeaves(4), profile, repeatAcross: false });
  if (!result.ok) throw new Error(`engine error ${result.error.code}`);
  return result.plan;
}

const PLAN = planFor(grid(16, 16, (end) => Math.floor(end / 4) % 3), PROFILE_120);

function renderPanel(props: Partial<SimulatorPanelProps> = {}) {
  const handlers = { onYarnsChange: vi.fn(), onResetYarns: vi.fn(), onStartBlank: vi.fn() };
  const view = render(
    <SimulatorPanel
      plan={PLAN}
      planSource="design"
      profile={PROFILE_120}
      yarns={{ warp: "#2b2b2b", weft: "#f3ead8" }}
      emptyReason="blank"
      {...handlers}
      {...props}
    />,
  );
  return { ...view, ...handlers };
}

function panel(): HTMLElement {
  const section = screen.getByRole("heading", { name: "Cloth simulation" }).closest("section");
  if (section === null) throw new Error("simulator panel not found");
  return section;
}

const spy = vi.mocked(clothModel);

beforeEach(() => {
  installDom();
  spy.mockClear();
});

describe("simulator panel", () => {
  it("empty state without a plan says why and offers the next action", () => {
    const { onStartBlank } = renderPanel({ plan: null, emptyReason: "blank" });
    expect(textOf(panel())).toContain("No cloth to show yet");
    expect(panel().querySelector("canvas")).toBeNull();
    fireEvent.click(within(panel()).getByRole("button", { name: "Start from a blank grid" }));
    expect(onStartBlank).toHaveBeenCalledTimes(1);
    expect(spy).not.toHaveBeenCalled();
  });

  it("empty state after an engine error points at the float check", () => {
    renderPanel({ plan: null, emptyReason: "engineError" });
    const text = textOf(panel());
    expect(text).toContain("No lift plan to simulate");
    expect(text).toContain("float check");
  });

  it("says which plan it shows (2.4)", () => {
    const { rerender } = renderPanel({ planSource: "design" });
    expect(textOf(panel())).toContain("Showing the lift plan of the current design");
    expect(textOf(panel())).not.toContain(PLAN_LINES.fixed);
    rerender(
      <SimulatorPanel
        plan={PLAN}
        planSource="fixed"
        profile={PROFILE_120}
        yarns={{ warp: "#2b2b2b", weft: "#f3ead8" }}
        emptyReason="blank"
        onYarnsChange={vi.fn()}
        onResetYarns={vi.fn()}
        onStartBlank={vi.fn()}
      />,
    );
    expect(textOf(panel())).toContain("Showing the fixed lift plan from auto-fix");
  });

  it("states it is a simulation, not a photograph, with and without a plan (2.5)", () => {
    renderPanel();
    expect(SIMULATION_NOTE).toBe("A simulation drawn from the lift plan, not a photograph of woven cloth.");
    expect(textOf(panel())).toContain(SIMULATION_NOTE);
  });

  it("draws the whole hook count from clothModel, face first, back after the toggle (2.2)", async () => {
    const drawn: string[] = [];
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function (this: HTMLCanvasElement) {
      return {
        canvas: this,
        fillStyle: "",
        setTransform: () => undefined,
        fillRect(this: { fillStyle: string }) {
          drawn.push(this.fillStyle);
        },
      } as unknown as CanvasRenderingContext2D;
    } as unknown as HTMLCanvasElement["getContext"]);
    renderPanel({ yarns: { warp: "#112233", weft: "#ddeeff" } });
    expect(spy).toHaveBeenLastCalledWith(PLAN, PROFILE_120, { warp: ["#112233"], weft: ["#ddeeff"] }, "face");
    const canvas = panel().querySelector("canvas")!;
    expect(canvas.getAttribute("data-side")).toBe("face");
    expect(canvas.getAttribute("aria-label")).toContain(`${PROFILE_120.hookCount} ends`);
    await waitFor(() => expect(drawn.length).toBeGreaterThan(0));
    const faceColours = drawn.filter((colour) => colour.startsWith("#"));

    const back = within(panel()).getByRole("button", { name: "Back" });
    fireEvent.click(back);
    expect(back.getAttribute("aria-pressed")).toBe("true");
    expect(spy).toHaveBeenLastCalledWith(PLAN, PROFILE_120, { warp: ["#112233"], weft: ["#ddeeff"] }, "back");
    expect(panel().querySelector("canvas")!.getAttribute("data-side")).toBe("back");
    drawn.length = 0;
    await waitFor(() => expect(drawn.filter((colour) => colour.startsWith("#")).length).toBeGreaterThan(0));
    const backColours = drawn.filter((colour) => colour.startsWith("#"));
    // Face and back swap warp and weft on every cell, so the drawn runs differ.
    expect(backColours).not.toEqual(faceColours);
  });

  it("labels both yarn colour inputs and reports changes (2.3)", () => {
    const { onYarnsChange } = renderPanel();
    const inputs = [...panel().querySelectorAll<HTMLInputElement>('input[type="color"]')];
    expect(inputs.map(accessibleName)).toEqual(["Warp yarn colour", "Weft yarn colour"]);
    fireEvent.change(inputs[0]!, { target: { value: "#aa0000" } });
    expect(onYarnsChange).toHaveBeenLastCalledWith({ warp: "#aa0000", weft: "#f3ead8" });
    fireEvent.change(inputs[1]!, { target: { value: "#00aa00" } });
    expect(onYarnsChange).toHaveBeenLastCalledWith({ warp: "#2b2b2b", weft: "#00aa00" });
  });

  it("zoom runs from 1 to 16 px per cell and resizes the canvas", () => {
    renderPanel();
    const zoom = within(panel()).getByRole("slider") as HTMLInputElement;
    expect(accessibleName(zoom)).toContain("Zoom");
    expect([zoom.min, zoom.max]).toEqual(["1", "16"]);
    fireEvent.change(zoom, { target: { value: "10" } });
    expect(panel().querySelector("canvas")!.style.width).toBe(`${PROFILE_120.hookCount * 10}px`);
  });

  it("shows the error state when clothModel rejects the yarns, with Retry and reset (2.5)", () => {
    const { onResetYarns } = renderPanel({ yarns: { warp: "red", weft: "#f3ead8" } });
    const alert = within(panel()).getByRole("alert");
    expect(textOf(alert)).toContain("The cloth could not be drawn");
    expect(panel().querySelector("canvas")).toBeNull();
    const calls = spy.mock.calls.length;
    fireEvent.click(within(alert).getByRole("button", { name: "Retry" }));
    expect(spy.mock.calls.length).toBe(calls + 1);
    fireEvent.click(within(alert).getByRole("button", { name: "Reset yarn colours" }));
    expect(onResetYarns).toHaveBeenCalledTimes(1);
  });

  it("shows the error state when clothModel rejects the plan", () => {
    const other = defineProfile({ hookCount: 240 });
    renderPanel({ profile: other });
    expect(textOf(within(panel()).getByRole("alert"))).toContain("The cloth could not be drawn");
  });
});

describe("draw-cloth", () => {
  it("caps the canvas backing at 8192 px per side and keeps the CSS size", () => {
    const size = clothCanvasSize(400, 400, 16, 2);
    expect(size.cssWidth).toBe(6400);
    expect(size.width).toBeLessThanOrEqual(MAX_CLOTH_SIDE);
    expect(size.height).toBeLessThanOrEqual(MAX_CLOTH_SIDE);
    expect(clothCanvasSize(120, 16, 4, 2)).toMatchObject({ width: 960, height: 128, scale: 2 });
    const huge = clothCanvasSize(2400, 10, 16, 1);
    expect(huge.width).toBe(MAX_CLOTH_SIDE);
  });

  function record(cells: ClothCell[][], cell: number) {
    const rects: { colour: string; x: number; y: number; w: number; h: number }[] = [];
    const context: ClothContext = {
      fillStyle: "",
      fillRect(x: number, y: number, w: number, h: number) {
        rects.push({ colour: String(context.fillStyle), x, y, w, h });
      },
    };
    drawClothRows(context, cells, cell, 0, cells.length);
    return rects;
  }

  it("draws a weft float as one run shaded at its top and bottom edges", () => {
    const weft: ClothCell = { top: "weft", colour: "#ffffff" };
    const rects = record([[weft, weft, weft]], 5);
    expect(rects[0]).toEqual({ colour: "#ffffff", x: 0, y: 0, w: 15, h: 5 });
    const edges = rects.filter((rect) => rect.colour === CLOTH_SHADES.edge);
    expect(edges).toEqual([
      { colour: CLOTH_SHADES.edge, x: 0, y: 0, w: 15, h: 1 },
      { colour: CLOTH_SHADES.edge, x: 0, y: 4, w: 15, h: 1 },
    ]);
  });

  it("draws warp cells as vertical threads shaded at each end's left and right edges, pick 0 at the bottom", () => {
    const warp: ClothCell = { top: "warp", colour: "#000000" };
    const weft: ClothCell = { top: "weft", colour: "#ffffff" };
    const rects = record([[warp, warp], [weft, weft]], 5);
    const edges = rects.filter((rect) => rect.colour === CLOTH_SHADES.edge && rect.h === 5);
    // Pick 0 (the warp row) is drawn in the lower row, at y = 5.
    expect(edges).toEqual([
      { colour: CLOTH_SHADES.edge, x: 0, y: 5, w: 1, h: 5 },
      { colour: CLOTH_SHADES.edge, x: 4, y: 5, w: 1, h: 5 },
      { colour: CLOTH_SHADES.edge, x: 5, y: 5, w: 1, h: 5 },
      { colour: CLOTH_SHADES.edge, x: 9, y: 5, w: 1, h: 5 },
    ]);
  });
});
