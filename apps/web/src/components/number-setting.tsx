// A whole-number setting built on Field. Typing keeps a draft; the value is committed on blur or
// Enter, so typing "120" does not clamp at "1" on the way. The reducer clamps the committed value.
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Field } from "./ui/field";

export interface NumberSettingProps {
  readonly label: ReactNode;
  readonly value: number;
  readonly min: number;
  readonly max: number;
  readonly hint?: ReactNode;
  readonly unit?: ReactNode;
  readonly onCommit: (value: number) => void;
}

export function NumberSetting({ label, value, min, max, hint, unit, onCommit }: NumberSettingProps) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);

  const commit = (): void => {
    const parsed = Number(draft);
    if (draft.trim() === "" || !Number.isFinite(parsed)) {
      setDraft(String(value));
      return;
    }
    onCommit(parsed);
    // If the reducer clamps to the same value, the effect does not run; show the stored value.
    setDraft(String(Math.min(Math.max(Math.round(parsed), min), max)));
  };

  return (
    <Field label={label} hint={hint ?? <>From <span className="mono">{min}</span> to <span className="mono">{max}</span>.</>} aside={unit}>
      {(control) => (
        <input
          {...control}
          className="input input-number"
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          step={1}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") commit();
          }}
        />
      )}
    </Field>
  );
}
