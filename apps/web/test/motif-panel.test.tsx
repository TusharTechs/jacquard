// Motif panel states through the whole app (3.6, 3.7, 8.5, 12.1, 12.2): empty, loading with a
// cancel that aborts the request and keeps the design, the three kinds of error with a retry, and
// the stand-in and suggestion labels. `fetch` is replaced with a fake; nothing leaves the test.
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { standInMotif } from "@jacquard/motif";
import type { MotifRequest } from "@jacquard/motif";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../src/app";
import { installDom, textOf } from "./dom-setup";

type FakeFetch = ReturnType<typeof vi.fn<(url: string, init?: RequestInit) => Promise<Response>>>;

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function stubFetch(answer: (url: string, init?: RequestInit) => Promise<Response>): FakeFetch {
  const fake = vi.fn(answer);
  vi.stubGlobal("fetch", fake);
  return fake;
}

/** A fetch that never answers until its signal aborts, as a slow backend would. */
function hangingFetch(): FakeFetch {
  return stubFetch(
    (_url, init) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      }),
  );
}

function motifPanel(): HTMLElement {
  const heading = screen.getByRole("heading", { name: "Motif" });
  const section = heading.closest("section");
  if (section === null) throw new Error("motif panel section not found");
  return section;
}

function pointPaper(): HTMLElement {
  return screen.getByRole("application");
}

function readout(): string {
  const node = document.querySelector(".readout");
  if (node === null) throw new Error("readout not found");
  return textOf(node);
}

/** Paints end 0, pick 0 with region 1 from the keyboard; returns the readout. */
function paintFirstCell(): string {
  const canvas = pointPaper();
  act(() => canvas.focus());
  fireEvent.keyDown(canvas, { key: "2" });
  fireEvent.keyDown(canvas, { key: " " });
  return readout();
}

function describeAndGenerate(prompt = "a lozenge border"): void {
  const panel = motifPanel();
  fireEvent.change(within(panel).getByLabelText("Describe the motif"), { target: { value: prompt } });
  fireEvent.click(within(panel).getByRole("button", { name: "Generate motif" }));
}

function requestBody(fake: FakeFetch, call = 0): MotifRequest {
  const init = fake.mock.calls[call]?.[1];
  return JSON.parse(String(init?.body)) as MotifRequest;
}

beforeEach(() => {
  installDom();
});

describe("motif panel: empty state (12.1)", () => {
  it("offers describe, upload and a blank grid", () => {
    stubFetch(() => Promise.reject(new Error("no request expected")));
    render(<App />);
    const panel = motifPanel();
    expect(within(panel).getByText("No motif yet")).toBeTruthy();
    expect(within(panel).getByRole("button", { name: "Describe a motif" })).toBeTruthy();
    expect(within(panel).getByRole("button", { name: "Upload a sketch" })).toBeTruthy();
    expect(within(panel).getByRole("button", { name: "Start from a blank grid" })).toBeTruthy();
  });

  it("Generate is disabled until there is a description", () => {
    render(<App />);
    const generate = within(motifPanel()).getByRole("button", { name: "Generate motif" }) as HTMLButtonElement;
    expect(generate.disabled).toBe(true);
    fireEvent.change(within(motifPanel()).getByLabelText("Describe the motif"), { target: { value: "a star" } });
    expect(generate.disabled).toBe(false);
  });
});

describe("motif panel: loading and cancel (3.7)", () => {
  it("shows progress and a Cancel that aborts the request and keeps the previous design", async () => {
    const fake = hangingFetch();
    render(<App />);
    expect(paintFirstCell()).toContain("region 1");

    describeAndGenerate();
    const panel = motifPanel();
    expect(fake).toHaveBeenCalledTimes(1);
    expect(fake.mock.calls[0]?.[0]).toBe("/api/motif");
    expect(requestBody(fake).input).toEqual({ kind: "text", prompt: "a lozenge border" });

    const progress = within(panel).getByRole("status");
    expect(textOf(progress)).toContain("Asking for a motif");
    expect(panel.getAttribute("aria-busy")).toBe("true");
    const signal = fake.mock.calls[0]?.[1]?.signal;
    expect(signal).toBeTruthy();
    expect(signal?.aborted).toBe(false);

    fireEvent.click(within(panel).getByRole("button", { name: "Cancel" }));
    expect(signal?.aborted).toBe(true);
    await waitFor(() => expect(textOf(motifPanel())).toContain("The motif request was cancelled. Your design is unchanged."));
    expect(motifPanel().getAttribute("aria-busy")).toBeNull();

    // The painted cell is still there.
    const canvas = pointPaper();
    act(() => canvas.focus());
    fireEvent.keyDown(canvas, { key: "ArrowRight" });
    fireEvent.keyDown(canvas, { key: "ArrowLeft" });
    expect(readout()).toBe("end 0 · pick 0 · region 1");
  });
});

describe("motif panel: error states (3.6)", () => {
  const cases = [
    { name: "model unavailable (503)", status: 503, code: "MODEL_UNAVAILABLE", title: "The motif model failed", action: "Retry" },
    { name: "model timeout (504)", status: 504, code: "MODEL_TIMEOUT", title: "The motif model failed", action: "Retry" },
    { name: "invalid motif (502)", status: 502, code: "MOTIF_SVG_INVALID", title: "The motif could not be used", action: "Generate again" },
  ] as const;

  async function errorText(
    answer: (url: string, init?: RequestInit) => Promise<Response>,
    action: "Retry" | "Generate again" = "Retry",
  ): Promise<{ text: string; title: string; fake: FakeFetch }> {
    const fake = stubFetch(answer);
    render(<App />);
    paintFirstCell();
    describeAndGenerate();
    const alert = await waitFor(() => within(motifPanel()).getByRole("alert"));
    const text = textOf(alert);
    const title = textOf(alert.querySelector(".state-title") ?? alert);
    // A retry is offered and, with nothing changed, sends the same request again.
    const retry = within(alert).getByRole("button", { name: action }) as HTMLButtonElement;
    expect(retry.disabled).toBe(false);
    fireEvent.click(retry);
    await waitFor(() => expect(fake).toHaveBeenCalledTimes(2));
    expect(requestBody(fake, 1)).toEqual(requestBody(fake, 0));
    await waitFor(() => within(motifPanel()).getByRole("alert"));
    // The design is untouched and still editable.
    const canvas = pointPaper();
    act(() => canvas.focus());
    fireEvent.keyDown(canvas, { key: "ArrowRight" });
    fireEvent.keyDown(canvas, { key: "ArrowLeft" });
    expect(readout()).toBe("end 0 · pick 0 · region 1");
    fireEvent.keyDown(canvas, { key: "1" });
    fireEvent.keyDown(canvas, { key: " " });
    expect(readout()).toBe("end 0 · pick 0 · region 0");
    return { text, title, fake };
  }

  for (const entry of cases) {
    it(`shows a ${entry.name} with its own wording and a retry`, async () => {
      const { text } = await errorText(
        () => Promise.resolve(jsonResponse(entry.status, { code: entry.code, message: "server text" })),
        entry.action,
      );
      expect(text).toContain(entry.title);
      expect(text).not.toContain("server text");
    });
  }

  it("shows a network failure when fetch rejects, with a retry", async () => {
    const { text } = await errorText(() => Promise.reject(new TypeError("Failed to fetch")));
    expect(text).toContain("Could not reach the server");
  });

  it("uses different wording for each kind of failure", async () => {
    const results: { text: string; title: string }[] = [];
    for (const entry of cases) {
      results.push(await errorText(() => Promise.resolve(jsonResponse(entry.status, { code: entry.code, message: "x" })), entry.action));
      cleanup();
    }
    results.push(await errorText(() => Promise.reject(new TypeError("Failed to fetch"))));
    // Every case has its own message; model, invalid motif and network each have their own title.
    expect(new Set(results.map((result) => result.text)).size).toBe(results.length);
    const [unavailable, timeout, invalid, network] = results.map((result) => result.title);
    expect(unavailable).toBe(timeout);
    expect(new Set([unavailable, invalid, network]).size).toBe(3);
  });
});

describe("motif panel: retry uses the current settings (3.6)", () => {
  it("Retry rebuilds the request from the current prompt and colour count", async () => {
    const fake = stubFetch(() => Promise.resolve(jsonResponse(503, { code: "MODEL_UNAVAILABLE", message: "x" })));
    render(<App />);
    describeAndGenerate("a lozenge border");
    await waitFor(() => within(motifPanel()).getByRole("alert"));
    expect(requestBody(fake, 0).colourCount).toBe(3);
    const setup = screen.getByRole("heading", { name: "Loom setup" }).closest("section")!;
    const colours = within(setup).getByLabelText("Colour count") as HTMLInputElement;
    fireEvent.change(colours, { target: { value: "4" } });
    fireEvent.blur(colours);
    fireEvent.change(within(motifPanel()).getByLabelText("Describe the motif"), { target: { value: "a peacock" } });
    fireEvent.click(within(within(motifPanel()).getByRole("alert")).getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(fake).toHaveBeenCalledTimes(2));
    expect(requestBody(fake, 1).colourCount).toBe(4);
    expect(requestBody(fake, 1).input).toEqual({ kind: "text", prompt: "a peacock" });
  });

  it("labels the action Generate again when the motif could not be used", async () => {
    stubFetch(() => Promise.resolve(jsonResponse(502, { code: "MOTIF_SVG_INVALID", message: "x" })));
    render(<App />);
    describeAndGenerate();
    const alert = await waitFor(() => within(motifPanel()).getByRole("alert"));
    expect(within(alert).queryByRole("button", { name: "Retry" })).toBeNull();
    expect(within(alert).getByRole("button", { name: "Generate again" })).toBeTruthy();
  });
});

describe("motif panel: source labels (8.5, 12.2)", () => {
  async function generateWith(source: "standIn" | "model"): Promise<string> {
    stubFetch((_url, init) => {
      const request = JSON.parse(String(init?.body)) as MotifRequest;
      return Promise.resolve(jsonResponse(200, { svg: standInMotif(request), palette: ["#ffffff", "#8c2f39", "#2f4b7c"], source }));
    });
    render(<App />);
    describeAndGenerate();
    await waitFor(() => expect(within(motifPanel()).queryByText(/edit it freely/)).not.toBeNull());
    return textOf(motifPanel());
  }

  it("labels a stand-in motif as a stand-in, not as a model suggestion", async () => {
    const text = await generateWith("standIn");
    expect(text).toContain("Stand-in motif");
    expect(text).not.toContain("Suggestion from the model");
    // The design changed and Undo brings back the blank grid (9.8).
    const undo = screen.getByRole("button", { name: "Undo" }) as HTMLButtonElement;
    expect(undo.disabled).toBe(false);
  });

  it("labels a model motif as a suggestion the designer can edit", async () => {
    const text = await generateWith("model");
    expect(text).toContain("Suggestion from the model — edit it freely");
    expect(text).not.toContain("Stand-in");
  });
});
