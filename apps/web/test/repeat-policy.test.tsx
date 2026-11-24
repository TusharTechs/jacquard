// Repeat across in the Studio (studio-experience 17.1, 17.2): the first grid opens with repeat on
// when it fits; a profile change re-applies the rule until the user chooses; the user's choice
// stays; every gallery example opens with repeat on and its card's claim is the engine's check of
// it as it opens.
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { App } from "../src/app";
import { checkDesign } from "../src/lib/engine-check";
import { exampleWeaves, parseGalleryExample } from "../src/lib/gallery";
import { resolveProfile } from "../src/state/setup-state";
import { galleryFile, installDom, stubGalleryFetch, textOf } from "./dom-setup";

beforeEach(() => {
  installDom();
  stubGalleryFetch();
});

function setupPanel(): HTMLElement {
  return screen.getByRole("heading", { name: "Loom setup" }).closest("section")!;
}

function repeatSwitch(): HTMLInputElement {
  return within(setupPanel()).getByRole("switch") as HTMLInputElement;
}

describe("repeat across follows the design", () => {
  it("opens on: 48 ends fit 240 hooks; 120 hooks turn it off; back to 240 turns it on", () => {
    render(<App />);
    expect(repeatSwitch().checked).toBe(true);
    fireEvent.change(within(setupPanel()).getByLabelText("Loom profile"), { target: { value: "120" } });
    expect(repeatSwitch().checked).toBe(false);
    fireEvent.change(within(setupPanel()).getByLabelText("Loom profile"), { target: { value: "240" } });
    expect(repeatSwitch().checked).toBe(true);
  });

  it("keeps the user's choice through a profile change, until a new design arrives", () => {
    render(<App />);
    fireEvent.click(repeatSwitch());
    expect(repeatSwitch().checked).toBe(false);
    fireEvent.change(within(setupPanel()).getByLabelText("Loom profile"), { target: { value: "400" } });
    fireEvent.change(within(setupPanel()).getByLabelText("Loom profile"), { target: { value: "240" } });
    expect(repeatSwitch().checked).toBe(false);
    fireEvent.click(screen.getAllByRole("button", { name: "Start from a blank grid" })[0]!);
    expect(repeatSwitch().checked).toBe(true);
  });

  it.each(["lotus-border", "peacock-butta", "temple-stripe", "star-lattice"])(
    "%s opens with repeat on, and its card states the engine's check with repeat on (17.2)",
    async (id) => {
      const example = parseGalleryExample(JSON.parse(galleryFile(`${id}.json`)));
      expect(example.setup.repeatAcross).toBe(true);
      const check = checkDesign({ design: example.design, weaves: exampleWeaves(example), profile: resolveProfile(example.setup.profile), repeatAcross: true });
      expect(check.ok).toBe(true);
      if (!check.ok) return;
      render(<App />);
      const open = await waitFor(() => screen.getByRole("button", { name: `Open example: ${example.title}` }));
      const card = open.closest("li")!;
      const count = check.violations.length;
      if (count === 0) expect(textOf(card)).toContain("No floats over the limit");
      else expect(textOf(card)).toContain(`${count} float ${count === 1 ? "violation" : "violations"}: auto-fix needed`);
      fireEvent.click(open);
      expect(repeatSwitch().checked).toBe(true);
    },
  );
});
