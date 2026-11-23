// The export panel (6.1 to 6.5): card set (PDF and SVG), point paper (SVG) and WIF downloads.
// Cards and WIF never export silently while the float check reports violations and no fixed plan
// is current: a confirmation offers auto-fix or "Export anyway". When a fixed plan is current the
// exports use it and the panel says so. An export failure has its own message and a Retry.
// While the float check has not caught up with the latest edit (`checking`), Cards and WIF wait:
// their plan and violation count would describe an older design.
import { useEffect, useRef, useState } from "react";
import { CARD_SHEET_NOTE, profileSummary } from "@jacquard/export";
import type { YarnColours } from "@jacquard/export";
import type { Design, LiftPlan, LoomProfile } from "@jacquard/engine";
import { downloadFile } from "../lib/download";
import type { Downloader } from "../lib/download";
import { EXPORT_KINDS, EXPORT_LABELS, buildExportFile, usesLiftPlan } from "../lib/export-files";
import type { ExportKind } from "../lib/export-files";
import type { PlanSource } from "./simulator-panel";
import { Term } from "./term";
import { Button } from "./ui/button";
import { Dialog } from "./ui/dialog";
import { Panel } from "./ui/panel";
import type { PanelStatus } from "./ui/panel";

export const WIF_NOTE =
  "Not yet checked: the WIF file maps each hook to one shaft. Open it in another weaving program to check it before relying on it.";
export const FIXED_PLAN_NOTE = "Exports use the fixed lift plan from auto-fix";

export interface ExportPanelProps {
  /** The loom profile's short name, used in file names (for example "240"). */
  readonly profileName: string;
  readonly profile: LoomProfile;
  /** The plan to export: the fixed plan when auto-fix is current, else the design's. Null when there is none. */
  readonly plan: LiftPlan | null;
  readonly planSource: PlanSource;
  readonly design: Design;
  /** Region display colours, for the point paper. */
  readonly colours: readonly string[];
  readonly yarns: YarnColours;
  /** Float violations in the design's lift plan. */
  readonly violationCount: number;
  /** True while the float check still describes an older design than the one on the grid. */
  readonly checking?: boolean;
  /** True while there is nothing on the grid yet. */
  readonly blank: boolean;
  readonly onAutoFix: () => void;
  /** Saves a file; the browser download by default. */
  readonly download?: Downloader;
  /** Whether Cards (PDF) is the primary button; false where the Step has its own (Print cards). */
  readonly lead?: boolean;
}

interface Failure {
  readonly kind: ExportKind;
  readonly message: string;
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

export function ExportPanel({
  profileName,
  profile,
  plan,
  planSource,
  design,
  colours,
  yarns,
  violationCount,
  checking = false,
  blank,
  onAutoFix,
  download = downloadFile,
  lead = true,
}: ExportPanelProps) {
  const [confirm, setConfirm] = useState<ExportKind | null>(null);
  const [pending, setPending] = useState<ExportKind | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement | null>(null);

  const gated = violationCount > 0 && planSource !== "fixed";
  /** Cards and WIF wait for the float check, so they never use a plan the gate has not seen. */
  const waiting = (kind: ExportKind): boolean => usesLiftPlan(kind) && checking;

  // The export runs after the next paint, so "Preparing…" is on screen while a large file is built.
  useEffect(() => {
    if (pending === null || waiting(pending)) return;
    const kind = pending;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const run = (): void => {
      setPending(null);
      try {
        const built = buildExportFile(kind, { profileName, profile, plan, design, colours, yarns });
        if (!built.ok) {
          setFailure({ kind, message: built.error.message });
          return;
        }
        download(built.file);
        setFailure(null);
        setSaved(built.file.name);
      } catch {
        setFailure({ kind, message: "Something went wrong while making or saving the file." });
      }
    };
    const frame = requestAnimationFrame(() => {
      timer = setTimeout(run, 0);
    });
    return () => {
      cancelAnimationFrame(frame);
      if (timer !== undefined) clearTimeout(timer);
    };
  }, [pending, checking, profileName, profile, plan, design, colours, yarns, download]);

  const start = (kind: ExportKind): void => {
    setSaved(null);
    setFailure(null);
    setPending(kind);
  };

  const request = (kind: ExportKind): void => {
    // aria-disabled buttons stay focusable, so their clicks are ignored here.
    if (pending !== null || waiting(kind)) return;
    if (usesLiftPlan(kind) && gated) {
      setConfirm(kind);
      return;
    }
    start(kind);
  };

  let status: PanelStatus = "ready";
  if (blank) status = "empty";
  else if (pending !== null) status = "loading";
  else if (failure !== null) status = "error";

  return (
    <Panel
      title="Export"
      headingRef={headingRef}
      status={status}
      empty={
        <p className="small">Nothing to export yet. The card set, the point-paper sheet and the WIF file are made once there is a design.</p>
      }
      loading={
        pending === null ? undefined : (
          <>
            <p className="small">Preparing {EXPORT_LABELS[pending]}…</p>
            <div className="progress" aria-hidden="true" />
          </>
        )
      }
      error={
        failure === null ? undefined : (
          <>
            <p className="state-title">The export failed</p>
            <p className="small">
              {EXPORT_LABELS[failure.kind]} could not be made: {failure.message}
            </p>
            <p className="small">This is a problem making the file. Your design and lift plan are unchanged. Try again.</p>
            <div className="state-actions">
              <Button small onClick={() => start(failure.kind)}>
                Retry
              </Button>
              <Button small variant="quiet" onClick={() => setFailure(null)}>
                Dismiss
              </Button>
            </div>
          </>
        )
      }
    >
      {blank ? null : (
        <div className="stack">
          {plan === null ? (
            <p className="note">
              Cards and the WIF file need a lift plan, and the engine could not build one for this design. The float check says
              what to change. The point-paper sheet can still be saved.
            </p>
          ) : checking ? (
            <p className="status-line small">Checking floats…</p>
          ) : planSource === "fixed" ? (
            <p className="status-line small">
              <span className="marker-ok" aria-hidden="true" />
              {FIXED_PLAN_NOTE}
            </p>
          ) : gated ? (
            <p className="status-line small">
              <span className="marker-triangle" aria-hidden="true" />
              {plural(violationCount, "float violation", "float violations")} in the lift plan. Cards and WIF ask before
              exporting.
            </p>
          ) : (
            <p className="small muted">Exports use the lift plan of the current design.</p>
          )}
          <div className="export-buttons">
            {EXPORT_KINDS.map((kind) => (
              <Button
                key={kind}
                variant={lead && kind === "cardsPdf" ? "primary" : "secondary"}
                disabled={usesLiftPlan(kind) && plan === null}
                aria-disabled={pending !== null || waiting(kind) ? true : undefined}
                onClick={() => request(kind)}
              >
                {EXPORT_LABELS[kind]}
              </Button>
            ))}
          </div>
          {saved === null ? null : (
            <p className="small" role="status">
              Download started: <span className="mono">{saved}</span>. If nothing downloaded, check your browser&apos;s download
              settings.
            </p>
          )}
          <p className="note">{CARD_SHEET_NOTE}</p>
          <p className="small muted">{profileSummary(profile)}</p>
          <p className="note">
            {WIF_NOTE} <Term name="shaft">What is a shaft?</Term>
          </p>
        </div>
      )}
      <Dialog
        open={confirm !== null}
        title="The float check reports violations"
        closeLabel="Cancel"
        onClose={() => setConfirm(null)}
        fallbackFocus={headingRef}
      >
        {confirm === null ? null : (
          <div className="stack">
            <p>
              The lift plan has {plural(violationCount, "float violation", "float violations")}. {EXPORT_LABELS[confirm]} made from it
              carries those long floats. Auto-fix can flip lift-plan cells to remove them; your regions stay as they are.
            </p>
            <div className="state-actions">
              <Button
                variant="primary"
                onClick={() => {
                  setConfirm(null);
                  onAutoFix();
                }}
              >
                Run auto-fix
              </Button>
              <Button
                onClick={() => {
                  const kind = confirm;
                  setConfirm(null);
                  start(kind);
                }}
              >
                Export anyway
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </Panel>
  );
}
