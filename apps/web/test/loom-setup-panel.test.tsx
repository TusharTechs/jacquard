// Loom setup (11.1 to 11.3): the untested-card-format note, and the engine's REPEAT_NOT_DIVISIBLE
// message next to the "repeat across" switch, tested through the whole app so the message really
// comes from the engine check.
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { App } from "../src/app";
import { LoomSetupPanel } from "../src/components/loom-setup-panel";
import { DEFAULT_SETUP } from "../src/state/setup-state";
import { installDom, textOf } from "./dom-setup";

function setupPanel(): HTMLElement {
  const section = screen.getByRole("heading", { name: "Loom setup" }).closest("section");
  if (section === null) throw new Error("loom setup panel not found");
  return section;
}

beforeEach(() => {
  installDom();
});

describe("loom setup panel", () => {
  it("says the card format is a configurable profile not tested on a working loom (11.3)", () => {
    render(<LoomSetupPanel setup={DEFAULT_SETUP} onChange={() => undefined} repeatAcrossMessage={null} />);
    const text = textOf(setupPanel());
    expect(text).toMatch(/card format is a configurable loom profile/i);
    expect(text).toMatch(/not been tested on a working loom/i);
  });

  it("offers the 120, 240 and 400 hook profiles (11.1)", () => {
    render(<LoomSetupPanel setup={DEFAULT_SETUP} onChange={() => undefined} repeatAcrossMessage={null} />);
    const select = within(setupPanel()).getByLabelText("Loom profile") as HTMLSelectElement;
    expect([...select.options].map((option) => option.value)).toEqual(["120", "240", "400"]);
  });

  it("shows REPEAT_NOT_DIVISIBLE next to the switch for 120 hooks, repeat across on, 48 ends (11.2)", async () => {
    render(<App />);
    const panel = setupPanel();
    fireEvent.change(within(panel).getByLabelText("Loom profile"), { target: { value: "120" } });
    const ends = within(panel).getByLabelText("Repeat ends") as HTMLInputElement;
    expect(ends.value).toBe("48");
    expect(120 % 48).not.toBe(0);
    const toggle = within(panel).getByRole("switch") as HTMLInputElement;
    expect(within(panel).queryByRole("alert")).toBeNull();
    fireEvent.click(toggle);
    expect(toggle.checked).toBe(true);

    const alert = await waitFor(() => within(setupPanel()).getByRole("alert"));
    expect(textOf(alert)).toMatch(/48/);
    expect(textOf(alert)).toMatch(/120/);
    // The message sits with the switch and describes it.
    expect(toggle.getAttribute("aria-describedby")).toBe(alert.id);
    expect(alert.closest(".field")).toBe(toggle.closest(".field"));

    // A width that divides 120 clears it.
    fireEvent.change(ends, { target: { value: "40" } });
    fireEvent.blur(ends);
    await waitFor(() => expect(within(setupPanel()).queryByRole("alert")).toBeNull());
  });
});
