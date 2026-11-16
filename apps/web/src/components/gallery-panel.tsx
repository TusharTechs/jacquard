// The gallery (Phase G): examples a first-time visitor can open and edit. The files are
// fetched when the panel mounts and checked in lib/gallery.ts. Each card shows the title, the
// profile, the repeat size, a small point-paper thumbnail and the engine's float check of the
// example as it opens (some examples need auto-fix before cutting). Opening an example is handled by the
// app, which replaces the grid as one undoable edit. Every example was made by the stand-in
// generator, not a model, and the panel says so.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Ref } from "react";
import { drawPointPaper } from "../lib/draw-point-paper";
import { checkDesign } from "../lib/engine-check";
import { exampleWeaves, loadGallery } from "../lib/gallery";
import type { GalleryExample, LoadedGallery } from "../lib/gallery";
import { regionColours } from "../lib/palette";
import { resolveProfile } from "../state/setup-state";
import { Term } from "./term";
import { Button } from "./ui/button";
import { Panel } from "./ui/panel";
import type { PanelStatus } from "./ui/panel";

export const GALLERY_ERROR =
  "The gallery examples could not be loaded. You can still describe a motif or start from a blank grid.";
/** Thumbnail side in CSS pixels [decision]. */
const THUMB_SIDE = 96;
const SKELETON_CARDS = 4;
const NO_MARKS = new Map<string, never>();

/** The engine's float count for each example as it opens, or null when the check could not run. */
type ExampleChecks = ReadonlyMap<string, number | null>;

function checkExamples(gallery: LoadedGallery): ExampleChecks {
  const checks = new Map<string, number | null>();
  for (const [id, example] of gallery.examples) {
    const result = checkDesign({
      design: example.design,
      weaves: exampleWeaves(example),
      profile: resolveProfile(example.setup.profile),
      repeatAcross: example.setup.repeatAcross,
    });
    checks.set(id, result.ok ? result.violations.length : null);
  }
  return checks;
}

function FloatStatus({ violations }: { readonly violations: number | null | undefined }) {
  if (violations === undefined) return null;
  if (violations === null) return <p className="small">The float check could not run on this example.</p>;
  if (violations === 0) return <p className="small">No floats over the limit</p>;
  return (
    <p className="small">
      <span className="marker-triangle" aria-hidden="true" /> <span className="mono">{violations}</span> float{" "}
      {violations === 1 ? "violation" : "violations"}: auto-fix needed
    </p>
  );
}

type LoadState =
  | { readonly status: "loading" }
  | { readonly status: "error" }
  | { readonly status: "ready"; readonly gallery: LoadedGallery };

function GalleryThumb({ example }: { readonly example: GalleryExample }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const picks = example.design.length;
  const ends = example.design[0]?.length ?? 0;
  useLayoutEffect(() => {
    const canvas = ref.current;
    if (canvas === null) return;
    drawPointPaper(canvas, {
      design: example.design,
      colours: regionColours(example.palette, example.palette.length),
      cellSize: Math.max(1, Math.floor(THUMB_SIDE / Math.max(ends, picks, 1))),
      pixelRatio: typeof window === "undefined" ? 1 : window.devicePixelRatio || 1,
      marks: NO_MARKS,
      errorCell: null,
      cursor: null,
      hover: null,
    });
  }, [example, ends, picks]);
  return (
    <canvas
      ref={ref}
      className="gallery-thumb"
      role="img"
      aria-label={`Point paper of ${example.title}, ${ends} ends by ${picks} picks in ${example.palette.length} colours`}
    />
  );
}

export interface GalleryPanelProps {
  /** Puts the example on the grid. */
  readonly onOpen: (example: GalleryExample) => void;
  /** The id of the example last opened, while it is still on the grid. */
  readonly openId: string | null;
  /** The panel heading, so the empty states elsewhere can move focus here. */
  readonly headingRef?: Ref<HTMLHeadingElement>;
}

export function GalleryPanel({ onOpen, openId, headingRef }: GalleryPanelProps) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: "loading" });
    loadGallery({ signal: controller.signal }).then(
      (gallery) => {
        if (!controller.signal.aborted) setState({ status: "ready", gallery });
      },
      () => {
        if (!controller.signal.aborted) setState({ status: "error" });
      },
    );
    return () => controller.abort();
  }, [attempt]);

  const checks = useMemo<ExampleChecks>(
    () => (state.status === "ready" ? checkExamples(state.gallery) : new Map()),
    [state],
  );
  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  let status: PanelStatus = "ready";
  if (state.status === "loading") status = "loading";
  else if (state.status === "error") status = "error";
  else if (state.gallery.entries.length === 0) status = "empty";

  return (
    <Panel
      title="Gallery"
      headingRef={headingRef}
      status={status}
      empty={
        <>
          <p className="state-title">No gallery examples</p>
          <p className="small">There are no examples to open. You can still describe a motif or start from a blank grid.</p>
        </>
      }
      loading={
        <>
          <p className="small">Loading the gallery examples…</p>
          <ul className="gallery-grid" aria-hidden="true">
            {Array.from({ length: SKELETON_CARDS }, (_, index) => (
              <li className="gallery-card gallery-skeleton" key={index}>
                <span className="skeleton-block skeleton-thumb" />
                <span className="skeleton-block skeleton-line" />
                <span className="skeleton-block skeleton-line skeleton-short" />
              </li>
            ))}
          </ul>
        </>
      }
      error={
        <>
          <p className="small">{GALLERY_ERROR}</p>
          <div className="state-actions">
            <Button small variant="primary" onClick={retry}>
              Retry
            </Button>
          </div>
        </>
      }
    >
      {state.status === "ready" && state.gallery.entries.length > 0 ? (
        <div className="stack">
          <p className="small muted">
            Examples to open and edit. Each opens with the engine's float check. Each card shows the loom profile, the repeat
            in <Term name="end">ends</Term> by <Term name="pick">picks</Term> and what the float check finds. The motifs were
            made by the stand-in generator, not a model.
          </p>
          <ul className="gallery-grid" aria-label="Gallery examples">
            {state.gallery.entries.map((entry) => {
              const example = state.gallery.examples.get(entry.id);
              return (
                <li className="gallery-card" key={entry.id}>
                  {example === undefined ? <span className="skeleton-block skeleton-thumb" aria-hidden="true" /> : <GalleryThumb example={example} />}
                  <h3 className="gallery-title">{entry.title}</h3>
                  <p className="small">
                    <span className="mono">{entry.profile}</span> hooks ·{" "}
                    <span className="mono">
                      {entry.ends}×{entry.picks}
                    </span>
                  </p>
                  <FloatStatus violations={checks.get(entry.id)} />
                  {openId === entry.id ? <p className="small muted">On the grid now</p> : null}
                  <Button
                    small
                    variant={openId === entry.id ? "secondary" : "primary"}
                    disabled={example === undefined}
                    aria-label={`Open example: ${entry.title}`}
                    onClick={() => {
                      if (example !== undefined) onOpen(example);
                    }}
                  >
                    Open example
                  </Button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </Panel>
  );
}
