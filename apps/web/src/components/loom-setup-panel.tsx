// Loom setup (11.1 to 11.3): profile, colour count, repeat, minimum feature, symmetry and
// "repeat across". Every limit comes from the engine's profiles through setup-state.ts.
// The settings sit in a <details> whose summary repeats the main values, so on a narrow screen the
// panel can fold to one line; the app opens it by default on wide screens.
import { useId } from "react";
import type { RefObject } from "react";
import type { Symmetry } from "@jacquard/motif";
import { PROFILE_NAMES, SYMMETRIES, resolveProfile, setupLimits } from "../state/setup-state";
import type { ProfileName, SetupAction, SetupState } from "../state/setup-state";
import { NumberSetting } from "./number-setting";
import { Field } from "./ui/field";
import { Hint } from "./ui/hint";
import { Panel } from "./ui/panel";

const SYMMETRY_LABELS: Readonly<Record<Symmetry, string>> = {
  none: "None",
  mirrorEnds: "Mirror left to right",
  mirrorPicks: "Mirror top to bottom",
  mirrorBoth: "Mirror both ways",
};

export interface LoomSetupPanelProps {
  readonly setup: SetupState;
  readonly onChange: (action: SetupAction) => void;
  /** The engine's REPEAT_NOT_DIVISIBLE message, when the current check returned it. */
  readonly repeatAcrossMessage: string | null;
  /** Whether the settings are shown; defaults to open. */
  readonly open?: boolean;
  readonly onOpenChange?: (open: boolean) => void;
  /** Lets the app focus the profile select (DESIGN_TOO_WIDE). */
  readonly profileRef?: RefObject<HTMLSelectElement | null>;
}

/** One-line summary of the setup, for example "240 hooks · 3 colours · 48×48". */
export function setupSummary(setup: SetupState): string {
  return `${setup.profile} hooks · ${setup.colourCount} colours · ${setup.repeat.ends}×${setup.repeat.picks}`;
}

export function LoomSetupPanel({ setup, onChange, repeatAcrossMessage, open = true, onOpenChange, profileRef }: LoomSetupPanelProps) {
  const limits = setupLimits(setup.profile);
  const profile = resolveProfile(setup.profile);
  const switchId = useId();
  const switchMessageId = useId();

  return (
    <Panel
      title="Loom setup"
      actions={
        <Hint topic="the loom setup">
          The repeat is counted in ends across and picks up. Colour count, symmetry and minimum feature apply to the next motif you
          generate.
        </Hint>
      }
    >
      <details
        className="setup-details"
        open={open}
        onToggle={(event) => {
          const next = event.currentTarget.open;
          if (next !== open) onOpenChange?.(next);
        }}
      >
        <summary className="setup-summary">
          <span className="mono">{setupSummary(setup)}</span>
          {setup.repeatAcross ? " · repeat across" : ""}
        </summary>
      <div className="stack">
        <Field label="Loom profile" hint={<>Up to <span className="mono">{profile.regionLimit}</span> regions on this profile.</>}>
          {(control) => (
            <select
              {...control}
              ref={profileRef}
              className="select"
              value={setup.profile}
              onChange={(event) => onChange({ type: "setProfile", profile: event.target.value as ProfileName })}
            >
              {PROFILE_NAMES.map((name) => (
                <option key={name} value={name}>
                  {name} hooks
                </option>
              ))}
            </select>
          )}
        </Field>
        <NumberSetting
          label="Colour count"
          value={setup.colourCount}
          min={limits.colourCount.min}
          max={limits.colourCount.max}
          hint={<>Background included. <span className="mono">{limits.colourCount.min}</span> to <span className="mono">{limits.colourCount.max}</span>.</>}
          onCommit={(colourCount) => onChange({ type: "setColourCount", colourCount })}
        />
        <div className="grid-2">
          <NumberSetting
            label="Repeat ends"
            value={setup.repeat.ends}
            min={limits.ends.min}
            max={limits.ends.max}
            onCommit={(ends) => onChange({ type: "setRepeatEnds", ends })}
          />
          <NumberSetting
            label="Repeat picks"
            value={setup.repeat.picks}
            min={limits.picks.min}
            max={limits.picks.max}
            onCommit={(picks) => onChange({ type: "setRepeatPicks", picks })}
          />
        </div>
        <NumberSetting
          label="Minimum feature"
          value={setup.minFeature}
          min={limits.minFeature.min}
          max={limits.minFeature.max}
          unit="cells"
          hint={<>Smaller areas merge into a neighbour. <span className="mono">{limits.minFeature.min}</span> to <span className="mono">{limits.minFeature.max}</span>.</>}
          onCommit={(minFeature) => onChange({ type: "setMinFeature", minFeature })}
        />
        <Field label="Symmetry">
          {(control) => (
            <select
              {...control}
              className="select"
              value={setup.symmetry}
              onChange={(event) => onChange({ type: "setSymmetry", symmetry: event.target.value as Symmetry })}
            >
              {SYMMETRIES.map((symmetry) => (
                <option key={symmetry} value={symmetry}>
                  {SYMMETRY_LABELS[symmetry]}
                </option>
              ))}
            </select>
          )}
        </Field>
        <div className="field">
          <div className="switch-row">
            <input
              id={switchId}
              type="checkbox"
              role="switch"
              checked={setup.repeatAcross}
              aria-describedby={repeatAcrossMessage === null ? undefined : switchMessageId}
              onChange={(event) => onChange({ type: "setRepeatAcross", repeatAcross: event.target.checked })}
            />
            <label className="field-label switch-label" htmlFor={switchId}>
              Repeat across all <span className="mono">{profile.hookCount}</span> hooks
            </label>
            <Hint topic="repeat across">Off: hooks past the repeat width stay down. On: the repeat fills every hook.</Hint>
          </div>
          {repeatAcrossMessage === null ? null : (
            <p className="field-error" id={switchMessageId} role="alert">
              {repeatAcrossMessage}
            </p>
          )}
        </div>
      </div>
      </details>
      <p className="note setup-note">
        The card format is a configurable loom profile. It has not been tested on a working loom.
      </p>
    </Panel>
  );
}
