// Shared setup for the component tests (jsdom). jsdom has no canvas, so getContext returns a
// no-op 2D context; every call on it does nothing. Testing Library's automatic cleanup needs
// vitest globals, which this package does not enable, so cleanup runs here after each test.
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

function noOpContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const target: Record<string | symbol, unknown> = { canvas };
  return new Proxy(target, {
    get(object, key) {
      if (key in object) return object[key];
      if (key === "measureText") return () => ({ width: 0 });
      return () => undefined;
    },
    set(object, key, value) {
      object[key] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
}

export function installDom(): void {
  const contexts = new WeakMap<HTMLCanvasElement, CanvasRenderingContext2D>();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function (this: HTMLCanvasElement) {
    let context = contexts.get(this);
    if (context === undefined) {
      context = noOpContext(this);
      contexts.set(this, context);
    }
    return context;
  } as unknown as HTMLCanvasElement["getContext"]);
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** Every visible text of an element, with whitespace collapsed. */
export function textOf(element: Element): string {
  return (element.textContent ?? "").replace(/\s+/g, " ").trim();
}

/**
 * A simplified accessible name: aria-labelledby, aria-label, a <label for>, a wrapping <label>,
 * the element's own text (buttons), then title. Enough to tell whether a control has any name.
 */
export function accessibleName(element: HTMLElement): string {
  const doc = element.ownerDocument;
  const labelledBy = element.getAttribute("aria-labelledby");
  if (labelledBy !== null) {
    const text = labelledBy
      .split(/\s+/)
      .map((id) => doc.getElementById(id))
      .filter((node): node is HTMLElement => node !== null)
      .map(textOf)
      .join(" ")
      .trim();
    if (text !== "") return text;
  }
  const label = element.getAttribute("aria-label");
  if (label !== null && label.trim() !== "") return label.trim();
  if (element.id !== "") {
    const forLabels = [...doc.querySelectorAll("label")].filter((node) => node.htmlFor === element.id);
    const text = forLabels.map(textOf).join(" ").trim();
    if (text !== "") return text;
  }
  const wrapping = element.closest("label");
  if (wrapping !== null && textOf(wrapping) !== "") return textOf(wrapping);
  if (element.tagName === "BUTTON" && textOf(element) !== "") return textOf(element);
  const title = element.getAttribute("title");
  if (title !== null && title.trim() !== "") return title.trim();
  return "";
}
