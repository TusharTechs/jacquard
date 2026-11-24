// The static deploy's motif path (deploy-static 1.1, 1.3, 1.4): with the local option the client
// never calls fetch and returns the stand-in, labelled as today; the sketch tab says plainly that a
// sketch is not traced (reworded in motif-builder, Requirement 4).
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MotifPanel } from "../src/components/motif-panel";
import { localMotifs, requestMotif } from "../src/lib/motif-client";
import type { MotifRequestControls } from "../src/lib/use-motif-request";
import { DEFAULT_SETUP } from "../src/state/setup-state";
import { installDom, textOf } from "./dom-setup";

const REQUEST = { input: { kind: "text" as const, prompt: "a lotus" }, colourCount: 3, symmetry: "mirrorEnds" as const, repeat: { ends: 48, picks: 48 } };

describe("local motifs", () => {
  it("are off in tests and dev, so the backend path stays (1.1)", () => {
    expect(localMotifs()).toBe(false);
  });

  it("make a stand-in motif without any network call", async () => {
    const fetchImpl = vi.fn();
    const result = await requestMotif(REQUEST, { local: true, fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.response.source).toBe("standIn");
      expect(result.response.palette.length).toBeGreaterThan(0);
    }
  });

  it("reject an invalid request the same way, with no network call", async () => {
    const fetchImpl = vi.fn();
    const result = await requestMotif({ ...REQUEST, colourCount: 1 }, { local: true, fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failure.kind).toBe("request");
  });

  it("the sketch tab says plainly that a sketch is not traced (1.4)", () => {
    installDom();
    const request = { state: { status: "idle" }, generate: vi.fn(), cancel: vi.fn(), reset: vi.fn() } as unknown as MotifRequestControls;
    render(<MotifPanel setup={DEFAULT_SETUP} online request={request} paletteColours={null} onStartBlank={vi.fn()} localStandIn />);
    fireEvent.click(screen.getByRole("tab", { name: "Upload sketch" }));
    const panel = screen.getByRole("tabpanel");
    // Reworded in motif-builder (Requirement 4): the static build never says "model".
    expect(textOf(panel)).toContain("Sketches are not traced here: you get a pattern made from the file instead.");
    expect(textOf(panel)).not.toMatch(/model/i);
    expect(within(panel).getByLabelText("Sketch image")).toBeTruthy();
  });
});
