// Shared Panel: a titled section with optional actions. The `status` slot shows the panel's empty,
// loading or error state above its content (design-language.md, required states). Loading marks
// the panel busy; an error is announced as an alert. With `headingRef` the heading takes
// tabIndex -1, so code can move focus to it (a focus target that is never disabled).
import { useId } from "react";
import type { ReactNode, Ref } from "react";

export type PanelStatus = "ready" | "empty" | "loading" | "error";

export interface PanelProps {
  readonly title: ReactNode;
  readonly actions?: ReactNode;
  readonly status?: PanelStatus;
  readonly empty?: ReactNode;
  readonly loading?: ReactNode;
  readonly error?: ReactNode;
  readonly className?: string;
  readonly children?: ReactNode;
  readonly headingRef?: Ref<HTMLHeadingElement>;
}

export function Panel({ title, actions, status = "ready", empty, loading, error, className, children, headingRef }: PanelProps) {
  const headingId = useId();
  let slot: ReactNode = null;
  if (status === "empty" && empty !== undefined) {
    slot = <div className="panel-state panel-empty">{empty}</div>;
  } else if (status === "loading" && loading !== undefined) {
    slot = (
      <div className="panel-state panel-loading" role="status">
        {loading}
      </div>
    );
  } else if (status === "error" && error !== undefined) {
    slot = (
      <div className="panel-state panel-error" role="alert">
        {error}
      </div>
    );
  }
  return (
    <section
      className={["panel", className ?? ""].filter(Boolean).join(" ")}
      aria-labelledby={headingId}
      aria-busy={status === "loading" ? true : undefined}
    >
      <header className="panel-header">
        <h2 className="panel-title" id={headingId} ref={headingRef} tabIndex={headingRef === undefined ? undefined : -1}>
          {title}
        </h2>
        {actions === undefined ? null : <div className="panel-actions">{actions}</div>}
      </header>
      {slot}
      {children}
    </section>
  );
}
