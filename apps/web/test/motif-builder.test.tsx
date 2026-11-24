// The motif builder in the whole app (motif-builder 3.1 to 3.6, 4.1, 4.2, 5.1, 5.5), with the
// static build's local motif path turned on: Chips while typing, the builder label, the loom setup
// following the plan with Undo bringing everything back, no "model" anywhere in the motif panel,
// and the design surviving a remount when persistence is on.
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../src/app";
import { SAVED_DESIGN_KEY } from "../src/lib/saved-design";
import { installDom, stubGalleryFetch, textOf } from "./dom-setup";

vi.mock("../src/lib/motif-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/motif-client")>();
  return { ...actual, localMotifs: () => true };
});

beforeEach(() => {
  installDom();
  stubGalleryFetch();
  window.localStorage.clear();
});

function section(name: string): HTMLElement {
  const node = screen.getByRole("heading", { name }).closest("section");
  if (node === null) throw new Error(`${name} panel not found`);
  return node;
}

function chipText(): string {
  const group = within(section("Motif")).getByRole("group", { name: "What the motif builder understood" });
  return [...group.querySelectorAll("select")].map((select) => select.selectedOptions[0]?.textContent ?? "").join(" · ");
}

async function describeMotif(text: string): Promise<void> {
  fireEvent.change(within(section("Motif")).getByLabelText("Describe the motif"), { target: { value: text } });
  await waitFor(() => within(section("Motif")).getByRole("group", { name: "What the motif builder understood" }));
}

function generate(): void {
  fireEvent.click(within(section("Motif")).getByRole("button", { name: "Generate motif" }));
}

function setupSymmetry(): string {
  return (within(section("Loom setup")).getByLabelText("Symmetry") as HTMLSelectElement).value;
}

describe("motif builder chips (3.2, 3.3)", () => {
  it("show what was understood while typing, starting with lotus · 4 petals · plain ground · 3 colours", async () => {
    render(<App />);
    await describeMotif("a lotus with four petals on a plain ground");
    expect(chipText().startsWith("lotus · 4 petals · plain ground · 3 colours")).toBe(true);
    expect(textOf(section("Motif"))).toContain("Words used: lotus, four petals, plain ground.");
  });

  it("change the plan, and typing clears the change (1.7)", async () => {
    render(<App />);
    await describeMotif("a lotus with four petals");
    fireEvent.change(within(section("Motif")).getByLabelText("Motif subject"), { target: { value: "peacock" } });
    expect(chipText().startsWith("peacock · plain ground")).toBe(true);
    expect(within(section("Motif")).queryByLabelText("Number of petals")).toBeNull();
    fireEvent.change(within(section("Motif")).getByLabelText("Describe the motif"), { target: { value: "a lotus with five petals" } });
    expect(chipText().startsWith("lotus · 5 petals")).toBe(true);
  });

  it("say when no subject word was found and list the words not used (1.3)", async () => {
    render(<App />);
    await describeMotif("a blue thing");
    const text = textOf(section("Motif"));
    expect(text).toContain("No subject word was found, so this is a rosette.");
    expect(text).toContain("Not used: thing.");
    expect(chipText().startsWith("rosette")).toBe(true);
  });
});

describe("placing a builder motif (3.4, 3.5, 4.1)", () => {
  it("labels it, sets the loom setup from the plan, and Undo brings back grid, setup and palette", async () => {
    render(<App />);
    expect(textOf(section("Motif"))).not.toMatch(/model/i);
    expect(setupSymmetry()).toBe("mirrorEnds");
    await describeMotif("a lotus with four petals on a plain ground");
    expect(textOf(section("Motif"))).not.toMatch(/model/i);
    generate();
    await waitFor(() => expect(textOf(section("Motif"))).toContain("Motif builder, not AI — edit it freely"));
    expect(textOf(section("Motif"))).not.toMatch(/model/i);
    expect(setupSymmetry()).toBe("mirrorBoth");
    expect(within(section("Motif")).getByRole("list", { name: "Motif palette" }).querySelectorAll("li")).toHaveLength(3);
    const undo = screen.getByRole("button", { name: "Undo" }) as HTMLButtonElement;
    expect(undo.disabled).toBe(false);
    act(() => undo.click());
    await waitFor(() => expect(setupSymmetry()).toBe("mirrorEnds"));
    expect(within(section("Motif")).queryByRole("list", { name: "Motif palette" })).toBeNull();
  });

  it("the sketch tab never says model either (4.1, 4.2)", () => {
    render(<App />);
    fireEvent.click(within(section("Motif")).getByRole("tab", { name: "Upload sketch" }));
    const text = textOf(section("Motif"));
    expect(text).toContain("Sketches are not traced here: you get a pattern made from the file instead.");
    expect(text).not.toMatch(/model/i);
  });

  it("is the same design for the same description and setup (3.6)", async () => {
    const { unmount } = render(<App />);
    await describeMotif("an eight-point star");
    generate();
    await waitFor(() => expect(textOf(section("Motif"))).toContain("Motif builder, not AI"));
    const first = textOf(within(section("Motif")).getByRole("list", { name: "Motif palette" }));
    unmount();
    render(<App />);
    await describeMotif("an eight-point star");
    generate();
    await waitFor(() => expect(textOf(section("Motif"))).toContain("Motif builder, not AI"));
    expect(textOf(within(section("Motif")).getByRole("list", { name: "Motif palette" }))).toBe(first);
  });
});

describe("saving the design (5.1, 5.5, 5.7)", () => {
  it("brings the design back after a remount, and Start from a blank grid forgets it", async () => {
    const first = render(<App persist />);
    await describeMotif("a peacock");
    generate();
    await waitFor(() => expect(textOf(section("Motif"))).toContain("Motif builder, not AI"));
    await waitFor(() => expect(window.localStorage.getItem(SAVED_DESIGN_KEY)).not.toBeNull(), { timeout: 2000 });
    first.unmount();

    render(<App persist />);
    // Restored: the palette and the setup, but no undo history (5.2).
    expect(within(section("Motif")).getByRole("list", { name: "Motif palette" }).querySelectorAll("li")).toHaveLength(3);
    expect(setupSymmetry()).toBe("mirrorEnds");
    expect((screen.getByRole("button", { name: "Undo" }) as HTMLButtonElement).disabled).toBe(true);

    act(() => (screen.getAllByRole("button", { name: "Start from a blank grid" })[0] as HTMLButtonElement).click());
    expect(window.localStorage.getItem(SAVED_DESIGN_KEY)).toBeNull();
  });

  it("is off unless asked for, so tests share no state (5.7)", async () => {
    render(<App />);
    await describeMotif("a peacock");
    generate();
    await waitFor(() => expect(textOf(section("Motif"))).toContain("Motif builder, not AI"));
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(window.localStorage.getItem(SAVED_DESIGN_KEY)).toBeNull();
  });
});
