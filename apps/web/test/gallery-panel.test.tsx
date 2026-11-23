// The gallery through the whole app (Phase G review, findings 1, 4 and 5). `fetch` serves the
// committed files from public/gallery; nothing leaves the test.
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { standInMotif } from "@jacquard/motif";
import type { MotifRequest } from "@jacquard/motif";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App, GALLERY_BADGE } from "../src/app";
import { GALLERY_ERROR } from "../src/components/gallery-panel";
import { galleryFile, installDom, openStep, stubGalleryFetch, textOf } from "./dom-setup";

interface IndexEntry {
  readonly id: string;
  readonly title: string;
  readonly profile: string;
  readonly ends: number;
  readonly picks: number;
}

const INDEX = JSON.parse(galleryFile("index.json")) as IndexEntry[];

function section(name: string): HTMLElement {
  const node = screen.getByRole("heading", { name }).closest("section");
  if (node === null) throw new Error(`${name} panel not found`);
  return node;
}

function summary(): string {
  const id = screen.getByRole("application").getAttribute("aria-describedby");
  return textOf(document.getElementById(id ?? "")!);
}

function card(title: string): HTMLElement {
  const node = within(section("Gallery")).getByRole("heading", { name: title }).closest("li");
  if (node === null) throw new Error(`card ${title} not found`);
  return node;
}

function setupValues(): { profile: string; ends: string; picks: string } {
  const setup = section("Loom setup");
  return {
    profile: (within(setup).getByLabelText("Loom profile") as HTMLSelectElement).value,
    ends: (within(setup).getByLabelText("Repeat ends") as HTMLInputElement).value,
    picks: (within(setup).getByLabelText("Repeat picks") as HTMLInputElement).value,
  };
}

async function openButton(title: string): Promise<HTMLButtonElement> {
  return (await waitFor(() => within(section("Gallery")).getByRole("button", { name: `Open example: ${title}` }))) as HTMLButtonElement;
}

beforeEach(() => {
  installDom();
});

describe("gallery panel", () => {
  it("shows a skeleton of four cards while the files load", () => {
    stubGalleryFetch(() => new Promise<Response>(() => undefined));
    render(<App />);
    const gallery = section("Gallery");
    expect(gallery.getAttribute("aria-busy")).toBe("true");
    expect(textOf(within(gallery).getByRole("status"))).toContain("Loading the gallery examples");
    expect(gallery.querySelectorAll(".gallery-skeleton")).toHaveLength(4);
    expect(within(gallery).queryAllByRole("button")).toHaveLength(0);
  });

  it("lists every example with its title, profile, size and a labelled thumbnail", async () => {
    stubGalleryFetch();
    render(<App />);
    await openButton(INDEX[0]!.title);
    const gallery = section("Gallery");
    const cards = within(within(gallery).getByRole("list", { name: "Gallery examples" })).getAllByRole("listitem");
    expect(cards).toHaveLength(INDEX.length);
    INDEX.forEach((entry, index) => {
      const card = cards[index]!;
      expect(within(card).getByRole("heading", { name: entry.title })).toBeTruthy();
      expect(textOf(card)).toContain(`${entry.profile} hooks`);
      expect(textOf(card)).toContain(`${entry.ends}×${entry.picks}`);
      const thumb = within(card).getByRole("img");
      expect(thumb.tagName).toBe("CANVAS");
      expect(thumb.getAttribute("aria-label")).toContain(`${entry.title}, ${entry.ends} ends by ${entry.picks} picks`);
      expect(within(card).getByRole("button", { name: `Open example: ${entry.title}` })).toBeTruthy();
    });
    expect(textOf(gallery)).toContain("stand-in generator, not a model");
  });

  it("Open example replaces the grid as one undo step and sets the example's setup", async () => {
    stubGalleryFetch();
    render(<App />);
    const temple = INDEX.find((entry) => entry.id === "temple-stripe")!;
    const example = JSON.parse(galleryFile("temple-stripe.json")) as { design: number[][]; palette: string[] };
    const undo = screen.getByRole("button", { name: "Undo" }) as HTMLButtonElement;
    expect(undo.disabled).toBe(true);
    expect(summary()).toContain("48 ends by 48 picks");

    fireEvent.click(await openButton(temple.title));

    expect(summary()).toContain(`${temple.ends} ends by ${temple.picks} picks`);
    const ones = example.design.flat().filter((cell) => cell === 1).length;
    expect(summary()).toContain(`region 1: ${ones} cells`);
    const setup = section("Loom setup");
    expect((within(setup).getByLabelText("Loom profile") as HTMLSelectElement).value).toBe(temple.profile);
    expect((within(setup).getByLabelText("Repeat ends") as HTMLInputElement).value).toBe(String(temple.ends));
    expect((within(setup).getByLabelText("Repeat picks") as HTMLInputElement).value).toBe(String(temple.picks));
    expect((within(setup).getByLabelText("Colour count") as HTMLInputElement).value).toBe(String(example.palette.length));
    // The example's palette is shown as the region colours.
    expect(textOf(section("Motif"))).toContain(example.palette[1]!);

    // One edit: a single Undo brings back the blank 48 by 48 grid and empties the undo stack.
    expect(undo.disabled).toBe(false);
    fireEvent.click(undo);
    expect(summary()).toContain("48 ends by 48 picks");
    expect(summary()).toContain("region 0: 2304 cells");
    expect(undo.disabled).toBe(true);
  });

  it("labels an open example as made by the stand-in and never shows its prompt as model input", async () => {
    stubGalleryFetch();
    render(<App />);
    const paper = section("Point paper");
    expect(textOf(paper)).not.toContain(GALLERY_BADGE);
    fireEvent.click(await openButton("Lotus border"));
    expect(textOf(paper)).toContain(GALLERY_BADGE);
    expect(textOf(section("Gallery"))).toContain("On the grid now");
    const prompt = within(section("Motif")).getByLabelText("Describe the motif") as HTMLTextAreaElement;
    expect(prompt.value).toBe("");
    expect(textOf(section("Motif"))).not.toMatch(/suggestion from the model/i);
    // Undoing the open takes the example, and its badge, off the grid.
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(textOf(paper)).not.toContain(GALLERY_BADGE);
  });

  it("ignores the stored check: the float check runs on the opened design", async () => {
    stubGalleryFetch();
    render(<App />);
    const peacock = JSON.parse(galleryFile("peacock-butta.json")) as { check: { violationsBefore: number } };
    expect(peacock.check.violationsBefore).toBeGreaterThan(0);
    fireEvent.click(await openButton("Peacock butta"));
    openStep("Check");
    const floats = section("Float check");
    await waitFor(() => expect(within(floats).getByRole("button", { name: "Auto-fix" })).toBeTruthy());
    const count = peacock.check.violationsBefore;
    expect(textOf(floats)).toContain(`${count} ${count === 1 ? "violation" : "violations"}`);
  });

  it("invalid JSON shows the error state with Retry, and Retry loads the gallery", async () => {
    let broken = true;
    stubGalleryFetch((url) =>
      broken && url.endsWith("/gallery/index.json") ? Promise.resolve(new Response("[{ not json", { status: 200 })) : undefined,
    );
    render(<App />);
    const alert = await waitFor(() => within(section("Gallery")).getByRole("alert"));
    expect(textOf(alert.querySelector("p")!)).toBe(GALLERY_ERROR);
    broken = false;
    await act(async () => {
      fireEvent.click(within(alert).getByRole("button", { name: "Retry" }));
    });
    await openButton("Star lattice");
    expect(within(section("Gallery")).queryByRole("alert")).toBeNull();
  });

  it("an example in the wrong shape is rejected at the boundary", async () => {
    const bad = JSON.parse(galleryFile("lotus-border.json")) as Record<string, unknown>;
    bad.palette = ["red", "#2f5d50", "#d9c86a"];
    stubGalleryFetch((url) =>
      url.endsWith("/gallery/lotus-border.json") ? Promise.resolve(new Response(JSON.stringify(bad), { status: 200 })) : undefined,
    );
    render(<App />);
    const alert = await waitFor(() => within(section("Gallery")).getByRole("alert"));
    expect(textOf(alert)).toContain(GALLERY_ERROR);
    expect(within(alert).getByRole("button", { name: "Retry" })).toBeTruthy();
  });

  it("opening an example after a stand-in motif leaves no motif suggestion label", async () => {
    // Gallery files come from the committed files; motif requests get a stand-in answer.
    const gallery = stubGalleryFetch();
    vi.stubGlobal("fetch", (url: string, init?: RequestInit): Promise<Response> => {
      if (String(url).includes("/gallery/")) return gallery(url, init);
      const request = JSON.parse(String(init?.body)) as MotifRequest;
      const body = { svg: standInMotif(request), palette: ["#ffffff", "#8c2f39", "#2f4b7c"], source: "standIn" };
      return Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } }));
    });
    render(<App />);
    const motif = section("Motif");
    fireEvent.change(within(motif).getByLabelText("Describe the motif"), { target: { value: "a lozenge border" } });
    fireEvent.click(within(motif).getByRole("button", { name: "Generate motif" }));
    await waitFor(() => expect(textOf(section("Motif"))).toContain("Stand-in motif"));
    expect(textOf(section("Motif"))).toContain("Motif palette");

    fireEvent.click(await openButton("Lotus border"));
    const after = textOf(section("Motif"));
    expect(after).not.toMatch(/stand-in motif/i);
    expect(after).not.toMatch(/suggestion from the model/i);
    expect(after).not.toMatch(/edit it freely/i);
    expect(after).toContain("Palette of the gallery example");
    expect(within(section("Motif")).getByRole("list", { name: "Palette of the gallery example" })).toBeTruthy();
  });

  it("each card shows the engine's float check: Peacock butta needs auto-fix, Temple stripe has no long floats", async () => {
    stubGalleryFetch();
    render(<App />);
    await openButton("Peacock butta");
    const peacock = textOf(card("Peacock butta"));
    expect(peacock).toMatch(/\d+ float violations?: auto-fix needed/);
    expect(card("Peacock butta").querySelector(".marker-triangle")).not.toBeNull();
    expect(peacock).not.toContain("No floats over the limit");
    const temple = textOf(card("Temple stripe"));
    expect(temple).toContain("No floats over the limit");
    expect(temple).not.toContain("auto-fix needed");
    const intro = textOf(section("Gallery"));
    expect(intro).toContain("Each opens with the engine's float check");
    expect(intro).not.toMatch(/finished examples/i);
  });

  it("Undo after opening an example restores the previous profile and repeat, and Redo re-applies the example's", async () => {
    stubGalleryFetch();
    render(<App />);
    const temple = INDEX.find((entry) => entry.id === "temple-stripe")!;
    const start = setupValues();
    expect(start).toEqual({ profile: "240", ends: "48", picks: "48" });
    fireEvent.click(await openButton(temple.title));
    const opened = { profile: temple.profile, ends: String(temple.ends), picks: String(temple.picks) };
    expect(setupValues()).toEqual(opened);
    expect(textOf(section("Motif"))).toContain("Palette of the gallery example");

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(setupValues()).toEqual(start);
    expect(summary()).toContain("48 ends by 48 picks");
    // The grid and the setup agree again: no size-mismatch note.
    expect(textOf(section("Point paper"))).not.toContain("Resize grid to the repeat");
    expect(within(section("Motif")).queryByRole("list", { name: /palette/i })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Redo" }));
    expect(setupValues()).toEqual(opened);
    expect(summary()).toContain(`${temple.ends} ends by ${temple.picks} picks`);
    expect(textOf(section("Point paper"))).toContain(GALLERY_BADGE);
    expect(textOf(section("Motif"))).toContain("Palette of the gallery example");
  });
});
