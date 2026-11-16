// Builds each export file (6.1) by calling @jacquard/export. No weaving logic here: the card
// sheets, point paper and WIF text come from the export package; this file names them and wraps
// them in a Blob. An ExportError is passed on as a failure, never thrown.
import { cardSheetPdf, cardSheetSvg, pointPaperSvg, writeWif } from "@jacquard/export";
import type { ExportError, YarnColours } from "@jacquard/export";
import type { Design, LiftPlan, LoomProfile } from "@jacquard/engine";
import type { DownloadFile } from "./download";

export type ExportKind = "cardsPdf" | "cardsSvg" | "pointPaper" | "wif";

export const EXPORT_KINDS: readonly ExportKind[] = ["cardsPdf", "cardsSvg", "pointPaper", "wif"];

export const EXPORT_LABELS: Readonly<Record<ExportKind, string>> = {
  cardsPdf: "Cards (PDF)",
  cardsSvg: "Cards (SVG)",
  pointPaper: "Point paper (SVG)",
  wif: "WIF file",
};

/** Cards and WIF carry the lift plan, so the violation gate applies to them (6.2). */
export function usesLiftPlan(kind: ExportKind): boolean {
  return kind !== "pointPaper";
}

/** File names from 6.1, for example `jacquard-240-cards.pdf`. */
export function exportFileName(kind: ExportKind, profileName: string): string {
  const profile = profileName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "custom";
  switch (kind) {
    case "cardsPdf":
      return `jacquard-${profile}-cards.pdf`;
    case "cardsSvg":
      return `jacquard-${profile}-cards.svg`;
    case "pointPaper":
      return `jacquard-${profile}-point-paper.svg`;
    case "wif":
      return `jacquard-${profile}.wif`;
  }
}

export interface ExportInput {
  readonly profileName: string;
  readonly profile: LoomProfile;
  /** Null when the engine could not build a lift plan. */
  readonly plan: LiftPlan | null;
  readonly design: Design;
  readonly colours: readonly string[];
  readonly yarns: YarnColours;
}

export type ExportFileResult =
  | { readonly ok: true; readonly file: DownloadFile }
  | { readonly ok: false; readonly error: ExportError | { readonly code: "NO_PLAN"; readonly message: string } };

const MIME: Readonly<Record<ExportKind, string>> = {
  cardsPdf: "application/pdf",
  cardsSvg: "image/svg+xml",
  pointPaper: "image/svg+xml",
  wif: "text/plain;charset=utf-8",
};

/** Calls the export function for `kind` and wraps its output in a named Blob. */
export function buildExportFile(kind: ExportKind, input: ExportInput): ExportFileResult {
  const title = `JACQUARD design, ${input.profileName}-hook loom profile`;
  const name = exportFileName(kind, input.profileName);
  if (kind === "pointPaper") {
    const svg = pointPaperSvg(input.design, input.colours, { title });
    return svg.ok ? { ok: true, file: { name, blob: new Blob([svg.value], { type: MIME[kind] }) } } : { ok: false, error: svg.error };
  }
  if (input.plan === null) {
    return { ok: false, error: { code: "NO_PLAN", message: "There is no lift plan to export." } };
  }
  switch (kind) {
    case "cardsPdf": {
      const pdf = cardSheetPdf(input.plan, input.profile, { title });
      if (!pdf.ok) return { ok: false, error: pdf.error };
      // Copy into a plain ArrayBuffer-backed array, which every Blob implementation accepts.
      const bytes = new Uint8Array(pdf.value.length);
      bytes.set(pdf.value);
      return { ok: true, file: { name, blob: new Blob([bytes], { type: MIME[kind] }) } };
    }
    case "cardsSvg": {
      const svg = cardSheetSvg(input.plan, input.profile, { title });
      return svg.ok ? { ok: true, file: { name, blob: new Blob([svg.value], { type: MIME[kind] }) } } : { ok: false, error: svg.error };
    }
    case "wif": {
      const wif = writeWif(input.plan, input.profile, input.yarns, { title });
      return wif.ok ? { ok: true, file: { name, blob: new Blob([wif.value], { type: MIME[kind] }) } } : { ok: false, error: wif.error };
    }
  }
}
