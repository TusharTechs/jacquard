// Shared Field: a visible label, one control, an optional hint and an optional error. The control
// is given its id and the ids that describe it, so every control is labelled and described.
import { useId } from "react";
import type { ReactNode } from "react";

export interface FieldControlProps {
  readonly id: string;
  readonly "aria-describedby"?: string;
  readonly "aria-invalid"?: true;
}

export interface FieldProps {
  readonly label: ReactNode;
  readonly hint?: ReactNode;
  readonly error?: ReactNode;
  /** Extra content after the control on the same line, for example a unit or a count. */
  readonly aside?: ReactNode;
  readonly className?: string;
  readonly children: (control: FieldControlProps) => ReactNode;
}

export function Field({ label, hint, error, aside, className, children }: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const described = [hint === undefined ? "" : hintId, error === undefined || error === null || error === false ? "" : errorId]
    .filter(Boolean)
    .join(" ");
  const hasError = error !== undefined && error !== null && error !== false;
  const control: FieldControlProps = {
    id,
    ...(described === "" ? {} : { "aria-describedby": described }),
    ...(hasError ? { "aria-invalid": true as const } : {}),
  };
  return (
    <div className={["field", hasError ? "field-has-error" : "", className ?? ""].filter(Boolean).join(" ")}>
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <div className="field-row">
        {children(control)}
        {aside === undefined ? null : <span className="field-aside">{aside}</span>}
      </div>
      {hint === undefined ? null : (
        <p className="field-hint" id={hintId}>
          {hint}
        </p>
      )}
      {hasError ? (
        <p className="field-error" id={errorId}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
