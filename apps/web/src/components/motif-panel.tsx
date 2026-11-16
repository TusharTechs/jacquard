// The motif step (3.6, 3.7, 8.5, 12.1, 12.2): describe a motif or upload a sketch, ask the backend
// for a motif, and show the four states. A motif from the model is labelled as a suggestion; one
// from the stand-in is labelled as a stand-in. The design stays editable in every state.
import { useEffect, useId, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import type { MotifInput, MotifRequest } from "@jacquard/motif";
import type { MotifFailureKind } from "../lib/motif-client";
import type { MotifRequestControls } from "../lib/use-motif-request";
import type { SetupState } from "../state/setup-state";
import { Button } from "./ui/button";
import { Field } from "./ui/field";
import { Panel } from "./ui/panel";
import type { PanelStatus } from "./ui/panel";
import { Tabs } from "./ui/tabs";

/** Product limits from 1.3 [decision]. */
export const PROMPT_LIMIT = 500;
export const SKETCH_LIMIT_BYTES = 1_500_000;
const SKETCH_TYPES = ["image/png", "image/jpeg"] as const;
type SketchType = (typeof SKETCH_TYPES)[number];

const FAILURE_TITLES: Readonly<Record<MotifFailureKind, string>> = {
  model: "The motif model failed",
  invalidMotif: "The motif could not be used",
  network: "Could not reach the server",
  offline: "You are offline",
  cancelled: "Request cancelled",
  request: "The request needs a change",
};

interface Sketch {
  readonly name: string;
  readonly size: number;
  readonly mediaType: SketchType;
  readonly data: string;
  readonly previewUrl: string | null;
}

function isSketchType(type: string): type is SketchType {
  return (SKETCH_TYPES as readonly string[]).includes(type);
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunk) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunk));
  }
  return btoa(binary);
}

function formatSize(bytes: number): string {
  return bytes >= 1_000_000 ? `${(bytes / 1_000_000).toFixed(2)} MB` : `${Math.max(1, Math.round(bytes / 1000))} kB`;
}

function codePoints(text: string): number {
  return [...text].length;
}

export interface MotifPanelProps {
  readonly setup: SetupState;
  readonly online: boolean;
  readonly request: MotifRequestControls;
  /** Display colours of the current motif palette, or null before the first motif. */
  readonly paletteColours: readonly string[] | null;
  readonly onStartBlank: () => void;
}

export function MotifPanel({ setup, online, request, paletteColours, onStartBlank }: MotifPanelProps) {
  const [tab, setTab] = useState<"text" | "sketch">("text");
  const [prompt, setPrompt] = useState("");
  const [sketch, setSketch] = useState<Sketch | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const promptRef = useRef<HTMLTextAreaElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const hintId = useId();
  const { state } = request;

  useEffect(() => {
    if (state.status !== "loading") return;
    setElapsed(0);
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - state.startedAt) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [state]);

  useEffect(() => () => {
    if (sketch?.previewUrl) URL.revokeObjectURL(sketch.previewUrl);
  }, [sketch]);

  const promptLength = codePoints(prompt);
  const promptTooLong = promptLength > PROMPT_LIMIT;
  const loading = state.status === "loading";

  const input: MotifInput | null =
    tab === "text"
      ? prompt.trim() === "" || promptTooLong
        ? null
        : { kind: "text", prompt }
      : sketch === null
        ? null
        : { kind: "sketch", mediaType: sketch.mediaType, data: sketch.data };

  const blockedReason = !online
    ? "Generating needs the network. You can keep editing the grid by hand."
    : input === null
      ? tab === "text"
        ? "Describe a motif to generate it."
        : "Choose a PNG or JPEG sketch to generate from it."
      : null;

  const generate = (): void => {
    if (input === null || !online) return;
    const body: MotifRequest = {
      input,
      colourCount: setup.colourCount,
      symmetry: setup.symmetry,
      repeat: { ends: setup.repeat.ends, picks: setup.repeat.picks },
    };
    request.generate(body);
  };

  const onFile = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    setFileError(null);
    if (file === undefined) return;
    if (!isSketchType(file.type)) {
      setSketch(null);
      setFileError("That file is not a PNG or JPEG image. Choose a PNG or JPEG sketch.");
      event.target.value = "";
      return;
    }
    if (file.size > SKETCH_LIMIT_BYTES) {
      setSketch(null);
      setFileError(`That file is ${formatSize(file.size)}. Choose a sketch of at most 1.5 MB.`);
      event.target.value = "";
      return;
    }
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const previewUrl = typeof URL.createObjectURL === "function" ? URL.createObjectURL(file) : null;
      setSketch({ name: file.name, size: file.size, mediaType: file.type, data: toBase64(bytes), previewUrl });
    } catch {
      setSketch(null);
      setFileError("That file could not be read. Choose it again, or choose another file.");
    }
  };

  const describe = (): void => {
    setTab("text");
    requestAnimationFrame(() => promptRef.current?.focus());
  };
  const upload = (): void => {
    setTab("sketch");
    requestAnimationFrame(() => fileRef.current?.click());
  };

  let status: PanelStatus = "ready";
  if (state.status === "idle") status = "empty";
  else if (state.status === "loading") status = "loading";
  else if (state.status === "error") status = "error";

  const describeTab = (
    <Field
      label="Describe the motif"
      hint="For example: a lotus with four petals on a plain ground."
      error={promptTooLong ? `Shorten the description to ${PROMPT_LIMIT} characters or fewer.` : undefined}
      aside={
        <span className="mono" aria-live="polite">
          {promptLength}/{PROMPT_LIMIT}
        </span>
      }
    >
      {(control) => (
        <textarea
          {...control}
          ref={promptRef}
          className="textarea"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) generate();
          }}
        />
      )}
    </Field>
  );

  const sketchTab = (
    <div className="stack">
      <Field label="Sketch image" hint="PNG or JPEG, at most 1.5 MB." error={fileError ?? undefined}>
        {(control) => (
          <input
            {...control}
            ref={fileRef}
            className="file-input"
            type="file"
            accept="image/png,image/jpeg"
            onChange={(event) => void onFile(event)}
          />
        )}
      </Field>
      {sketch === null ? null : (
        <div className="stack">
          <p className="small">
            Chosen: {sketch.name} (<span className="mono">{formatSize(sketch.size)}</span>)
          </p>
          {sketch.previewUrl === null ? null : <img className="sketch-preview" src={sketch.previewUrl} alt="Preview of the chosen sketch" />}
        </div>
      )}
    </div>
  );

  return (
    <Panel
      title="Motif"
      status={status}
      empty={
        <>
          <p className="state-title">No motif yet</p>
          <p className="small">
            Describe a motif or upload a sketch and the model suggests a clean motif at your repeat size. Or paint the grid
            yourself.
          </p>
          <div className="state-actions">
            <Button small onClick={describe}>
              Describe a motif
            </Button>
            <Button small onClick={upload}>
              Upload a sketch
            </Button>
            <Button small onClick={onStartBlank}>
              Start from a blank grid
            </Button>
          </div>
        </>
      }
      loading={
        <>
          <p className="state-title">
            {state.status === "loading" && state.inputKind === "sketch" ? "Sending your sketch for a motif" : "Asking for a motif"}
            … <span className="mono">{elapsed} s</span>
          </p>
          <div className="progress" aria-hidden="true" />
          <p className="small">You can keep editing the grid. Cancel keeps your current design.</p>
          <div className="state-actions">
            <Button small onClick={request.cancel}>
              Cancel
            </Button>
          </div>
        </>
      }
      error={
        state.status === "error" ? (
          <>
            <p className="state-title">{FAILURE_TITLES[state.failure.kind]}</p>
            <p className="small">{state.failure.message}</p>
            <div className="state-actions">
              <Button small variant="primary" onClick={request.retry} disabled={!online || request.lastRequest === null}>
                {online ? "Retry" : "Retry when you are back online"}
              </Button>
              <Button small onClick={onStartBlank}>
                Start from a blank grid
              </Button>
            </div>
          </>
        ) : undefined
      }
    >
      <div className="stack">
        {state.status === "cancelled" ? (
          <div className="note" role="status">
            <p>{state.message}</p>
            <Button small variant="quiet" onClick={request.retry} disabled={!online}>
              Try again
            </Button>
          </div>
        ) : null}
        {state.status === "success" ? (
          <div className="stack">
            <p className="label-suggestion">
              {state.source === "standIn"
                ? "Stand-in motif (model not connected) — edit it freely"
                : "Suggestion from the model — edit it freely"}
            </p>
            {state.source === "standIn" && state.inputKind === "sketch" ? (
              <p className="small muted">The stand-in does not trace your sketch. It picks a pattern from the file’s bytes.</p>
            ) : null}
          </div>
        ) : null}
        {paletteColours === null ? null : (
          <div>
            <p className="small field-label">Motif palette</p>
            <ul className="palette" aria-label="Motif palette">
              {paletteColours.map((colour, index) => (
                <li key={index}>
                  <span className="swatch" style={{ background: colour }} aria-hidden="true" />
                  <span>
                    Region <span className="mono">{index}</span> <span className="mono muted">{colour}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <Tabs
          label="Motif input"
          selected={tab}
          onSelect={(id) => setTab(id === "sketch" ? "sketch" : "text")}
          items={[
            { id: "text", label: "Describe", panel: describeTab },
            { id: "sketch", label: "Upload sketch", panel: sketchTab },
          ]}
        />
        <div className="state-actions">
          <Button variant="primary" onClick={generate} disabled={loading || blockedReason !== null} aria-describedby={hintId}>
            {loading ? "Generating…" : "Generate motif"}
          </Button>
        </div>
        <p className="small muted" id={hintId}>
          {blockedReason ?? `Uses ${setup.colourCount} colours, a ${setup.repeat.ends} by ${setup.repeat.picks} repeat. The new motif replaces the grid; Undo brings the old one back.`}
        </p>
      </div>
    </Panel>
  );
}
