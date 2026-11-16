// Export panel (6.1 to 6.5): every download with its file name and content, the violation gate
// with "Run auto-fix" and "Export anyway", the fixed-plan note, the export failure state with
// Retry, and both notes. Files come from the real @jacquard/export functions; only the browser
// download is replaced by an injected function.
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { PROFILE_120, PROFILE_240, defineProfile } from "@jacquard/engine";
import type { Design, LiftPlan, LoomProfile } from "@jacquard/engine";
import { CARD_SHEET_NOTE } from "@jacquard/export";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import { ExportPanel, FIXED_PLAN_NOTE, WIF_NOTE } from "../src/components/export-panel";
import type { ExportPanelProps } from "../src/components/export-panel";
import { defaultWeaves } from "../src/lib/default-weaves";
import { downloadFile } from "../src/lib/download";
import type { DownloadFile } from "../src/lib/download";
import { checkDesign } from "../src/lib/engine-check";
import { regionColours } from "../src/lib/palette";
import { installDom, textOf } from "./dom-setup";

function grid(ends: number, picks: number, cell: (end: number, pick: number) => number): Design {
  return Array.from({ length: picks }, (_, pick) => Array.from({ length: ends }, (_, end) => cell(end, pick)));
}

function checked(design: Design, profile: LoomProfile): { plan: LiftPlan; violations: number } {
  const result = checkDesign({ design, weaves: defaultWeaves(4), profile, repeatAcross: false });
  if (!result.ok) throw new Error(`engine error ${result.error.code}`);
  return { plan: result.plan, violations: result.violations.length };
}

const CLEAN_DESIGN = grid(16, 16, () => 0);
const CLEAN = checked(CLEAN_DESIGN, PROFILE_120);
/** A small float limit makes the twill and satin regions break it. */
const STRICT = defineProfile({ hookCount: 120, maxFloat: 2 });
const STRIPES = grid(16, 16, (end) => Math.floor(end / 4) % 3);
const BAD = checked(STRIPES, STRICT);

type DownloadMock = Mock<(file: DownloadFile) => void>;

function renderPanel(props: Partial<Omit<ExportPanelProps, "download">> & { download?: DownloadMock } = {}) {
  const download: DownloadMock = props.download ?? vi.fn<(file: DownloadFile) => void>();
  const handlers = { onAutoFix: vi.fn() };
  const view = render(
    <ExportPanel
      profileName="120"
      profile={PROFILE_120}
      plan={CLEAN.plan}
      planSource="design"
      design={CLEAN_DESIGN}
      colours={regionColours(null, 3)}
      yarns={{ warp: ["#2b2b2b"], weft: ["#f3ead8"] }}
      violationCount={CLEAN.violations}
      blank={false}
      {...handlers}
      {...props}
      download={download}
    />,
  );
  return { ...view, ...handlers, download };
}

function panel(): HTMLElement {
  const section = screen.getByRole("heading", { name: "Export" }).closest("section");
  if (section === null) throw new Error("export panel not found");
  return section;
}

function click(name: string): void {
  fireEvent.click(within(panel()).getByRole("button", { name }));
}

async function blobText(blob: Blob): Promise<string> {
  if (typeof blob.text === "function") return blob.text();
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.readAsText(blob);
  });
}

beforeEach(() => {
  installDom();
});

describe("export panel", () => {
  it("has no violations in the clean fixture and gates nothing", () => {
    expect(CLEAN.violations).toBe(0);
    expect(BAD.violations).toBeGreaterThan(0);
  });

  it.each([
    ["Cards (PDF)", "jacquard-120-cards.pdf", "%PDF-1.4"],
    ["Cards (SVG)", "jacquard-120-cards.svg", "<svg"],
    ["Point paper (SVG)", "jacquard-120-point-paper.svg", "<svg"],
    ["WIF file", "jacquard-120.wif", "[WIF]"],
  ])("%s downloads %s with content (6.1)", async (label, name, marker) => {
    const { download } = renderPanel();
    click(label);
    await waitFor(() => expect(download).toHaveBeenCalledTimes(1));
    const file = download.mock.calls[0]![0] as DownloadFile;
    expect(file.name).toBe(name);
    expect(file.blob.size).toBeGreaterThan(0);
    expect(await blobText(file.blob)).toContain(marker);
    expect(textOf(panel())).toContain(`Download started: ${name}. If nothing downloaded, check your browser's download settings.`);
  });

  it("uses the profile name in file names", async () => {
    const plan = checked(CLEAN_DESIGN, PROFILE_240).plan;
    const { download } = renderPanel({ profileName: "240", profile: PROFILE_240, plan });
    click("Cards (PDF)");
    await waitFor(() => expect(download).toHaveBeenCalledTimes(1));
    expect((download.mock.calls[0]![0] as DownloadFile).name).toBe("jacquard-240-cards.pdf");
  });

  it("with violations and no fixed plan, cards ask first; Export anyway downloads (6.2)", async () => {
    const { download } = renderPanel({ profile: STRICT, plan: BAD.plan, design: STRIPES, violationCount: BAD.violations });
    expect(textOf(panel())).toContain(`${BAD.violations} float violations`);
    click("Cards (PDF)");
    const dialog = screen.getByRole("dialog");
    expect(textOf(dialog)).toContain(`${BAD.violations} float violations`);
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(download).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Export anyway" }));
    await waitFor(() => expect(download).toHaveBeenCalledTimes(1));
    expect((download.mock.calls[0]![0] as DownloadFile).name).toBe("jacquard-120-cards.pdf");
  });

  it("Run auto-fix in the confirmation calls the fix handler and exports nothing (6.2)", async () => {
    const { download, onAutoFix } = renderPanel({ profile: STRICT, plan: BAD.plan, design: STRIPES, violationCount: BAD.violations });
    click("WIF file");
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Run auto-fix" }));
    expect(onAutoFix).toHaveBeenCalledTimes(1);
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(download).not.toHaveBeenCalled();
  });

  it("the point paper is not gated: it is a picture of the design", async () => {
    const { download } = renderPanel({ profile: STRICT, plan: BAD.plan, design: STRIPES, violationCount: BAD.violations });
    click("Point paper (SVG)");
    await waitFor(() => expect(download).toHaveBeenCalledTimes(1));
    expect(within(panel()).queryByRole("button", { name: "Export anyway" })).toBeNull();
  });

  it("with a fixed plan current, says exports use it and does not ask (6.3)", async () => {
    const { download } = renderPanel({ profile: STRICT, plan: BAD.plan, design: STRIPES, violationCount: BAD.violations, planSource: "fixed" });
    expect(FIXED_PLAN_NOTE).toBe("Exports use the fixed lift plan from auto-fix");
    expect(textOf(panel())).toContain(FIXED_PLAN_NOTE);
    click("Cards (SVG)");
    await waitFor(() => expect(download).toHaveBeenCalledTimes(1));
    expect(within(panel()).queryByRole("button", { name: "Export anyway" })).toBeNull();
  });

  it("an export function error shows the export failure state with Retry (6.4)", async () => {
    // A 120-hook plan with a 240-hook profile: the engine rejects it inside cardSheetSvg.
    const { download } = renderPanel({ profileName: "240", profile: PROFILE_240 });
    click("Cards (SVG)");
    const alert = await waitFor(() => within(panel()).getByRole("alert"));
    expect(textOf(alert)).toContain("The export failed");
    expect(textOf(alert)).toContain("Cards (SVG) could not be made");
    expect(textOf(alert)).not.toMatch(/at \w+ \(|\.ts:\d+/);
    expect(download).not.toHaveBeenCalled();
    fireEvent.click(within(alert).getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(textOf(within(panel()).getByRole("alert"))).toContain("Cards (SVG) could not be made"));
  });

  it("a download that throws shows the failure state; Retry succeeds (6.4)", async () => {
    const download = vi.fn<(file: DownloadFile) => void>().mockImplementationOnce(() => {
      throw new Error("blocked");
    });
    renderPanel({ download });
    click("WIF file");
    const alert = await waitFor(() => within(panel()).getByRole("alert"));
    expect(textOf(alert)).toContain("The export failed");
    expect(textOf(alert)).not.toContain("blocked");
    fireEvent.click(within(alert).getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(download).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(within(panel()).queryByRole("alert")).toBeNull());
    expect((download.mock.calls[1]![0] as DownloadFile).name).toBe("jacquard-120.wif");
  });

  it("shows the untested-card-format note and the WIF to-verify note (6.5)", () => {
    renderPanel();
    const text = textOf(panel());
    expect(CARD_SHEET_NOTE).toContain("has not been tested on a working loom");
    expect(text).toContain(CARD_SHEET_NOTE);
    expect(WIF_NOTE).toBe(
      "Not yet checked: the WIF file maps each hook to one shaft. Open it in another weaving program to check it before relying on it.",
    );
    expect(text).toContain(WIF_NOTE);
    const shaft = within(panel()).getByRole("button", { name: "What is a shaft?" });
    expect(textOf(document.getElementById(shaft.getAttribute("aria-describedby")!)!)).toBe(
      "Shaft: on a shaft loom, a frame that lifts every warp end threaded on it. In this WIF each hook gets its own shaft.",
    );
  });

  it("while the float check is catching up, Cards and WIF wait and say so; the gate then appears (6.2)", async () => {
    // The check still describes the clean design, but the grid already has violations.
    const props = { profile: STRICT, plan: CLEAN.plan, design: STRIPES, violationCount: 0, checking: true };
    const { download, rerender, onAutoFix } = renderPanel(props);
    expect(textOf(panel())).toContain("Checking floats…");
    for (const name of ["Cards (PDF)", "Cards (SVG)", "WIF file"]) {
      const button = within(panel()).getByRole("button", { name });
      expect(button.getAttribute("aria-disabled")).toBe("true");
      fireEvent.click(button);
    }
    expect(within(panel()).getByRole("button", { name: "Point paper (SVG)" }).getAttribute("aria-disabled")).toBeNull();
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(download).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
    // The check catches up: the same click now opens the gate instead of exporting.
    rerender(
      <ExportPanel
        profileName="120"
        colours={regionColours(null, 3)}
        yarns={{ warp: ["#2b2b2b"], weft: ["#f3ead8"] }}
        blank={false}
        planSource="design"
        onAutoFix={onAutoFix}
        download={download}
        {...props}
        plan={BAD.plan}
        violationCount={BAD.violations}
        checking={false}
      />,
    );
    expect(textOf(panel())).not.toContain("Checking floats…");
    click("Cards (PDF)");
    expect(textOf(screen.getByRole("dialog"))).toContain(`${BAD.violations} float violations`);
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(download).not.toHaveBeenCalled();
  });

  it("after Export anyway, focus returns to the export button, which stays focusable while preparing", async () => {
    const { download } = renderPanel({ profile: STRICT, plan: BAD.plan, design: STRIPES, violationCount: BAD.violations });
    const opener = within(panel()).getByRole("button", { name: "Cards (PDF)" }) as HTMLButtonElement;
    opener.focus();
    fireEvent.click(opener);
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Export anyway" }));
    expect(document.activeElement).toBe(opener);
    expect(opener.disabled).toBe(false);
    expect(opener.getAttribute("aria-disabled")).toBe("true");
    await waitFor(() => expect(download).toHaveBeenCalledTimes(1));
    expect(document.activeElement).toBe(opener);
  });

  it("without a lift plan, cards and WIF are disabled and the point paper still works", () => {
    renderPanel({ plan: null });
    for (const name of ["Cards (PDF)", "Cards (SVG)", "WIF file"]) {
      expect((within(panel()).getByRole("button", { name }) as HTMLButtonElement).disabled).toBe(true);
    }
    expect((within(panel()).getByRole("button", { name: "Point paper (SVG)" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("empty state is a one-line note with no button; the blank grid is offered by the motif and point-paper area", () => {
    renderPanel({ blank: true });
    const empty = panel().querySelector(".panel-empty");
    expect(empty).not.toBeNull();
    expect(textOf(empty!)).toContain("Nothing to export yet");
    expect(empty!.querySelectorAll("p")).toHaveLength(1);
    expect(within(panel()).queryAllByRole("button")).toHaveLength(0);
  });
});

describe("downloadFile", () => {
  it("clicks a temporary anchor with the file name and revokes the object URL", async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.download).toBe("jacquard-120.wif");
      expect(this.href).toBe("blob:test-1");
      expect(document.body.contains(this)).toBe(true);
    });
    const createObjectURL = vi.fn(() => "blob:test-1");
    const revokeObjectURL = vi.fn();
    const blob = new Blob(["x"]);
    downloadFile({ name: "jacquard-120.wif", blob }, { document, createObjectURL, revokeObjectURL });
    expect(createObjectURL).toHaveBeenCalledWith(blob);
    expect(click).toHaveBeenCalledTimes(1);
    expect(document.querySelector("a[download]")).toBeNull();
    await waitFor(() => expect(revokeObjectURL).toHaveBeenCalledWith("blob:test-1"));
  });
});
