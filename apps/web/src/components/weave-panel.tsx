// Weave per region (10.5): one row per region, its swatch and number, and a choice from the fixed
// list. The engine validates and evaluates every weave; its seam warnings are shown as they come.
import type { Warning, Weave, WeaveAssignment } from "@jacquard/engine";
import { WEAVE_CHOICES, weaveChoiceOf } from "../lib/default-weaves";
import { Field } from "./ui/field";
import { Panel } from "./ui/panel";

export interface WeavePanelProps {
  readonly regions: readonly number[];
  readonly colours: readonly string[];
  readonly weaves: WeaveAssignment;
  readonly warnings: readonly Warning[];
  readonly onChange: (region: number, weave: Weave) => void;
}

function warningText(warning: Warning): string {
  return `Region ${warning.region}: the weave repeats every ${warning.period} ${warning.dimension}, which does not divide the ${warning.size} ${warning.dimension} of the repeat, so a seam may show where the repeat joins if the region reaches the edge.`;
}

export function WeavePanel({ regions, colours, weaves, warnings, onChange }: WeavePanelProps) {
  return (
    <Panel title="Weave per region">
      <ul className="weave-rows">
        {regions.map((region) => {
          const weave = weaves[region];
          const choice = weave === undefined ? undefined : weaveChoiceOf(weave);
          return (
            <li className="weave-row" key={region}>
              <span className="swatch" style={{ background: colours[region] ?? "transparent" }} aria-hidden="true" />
              <Field label={<>Region <span className="mono">{region}</span></>}>
                {(control) => (
                  <select
                    {...control}
                    className="select"
                    value={choice?.id ?? ""}
                    onChange={(event) => {
                      const next = WEAVE_CHOICES.find((item) => item.id === event.target.value);
                      if (next !== undefined) onChange(region, next.weave);
                    }}
                  >
                    {choice === undefined ? (
                      <option value="" disabled>
                        Choose a weave
                      </option>
                    ) : null}
                    {WEAVE_CHOICES.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
            </li>
          );
        })}
      </ul>
      {warnings.length === 0 ? null : (
        <ul className="warning-list" aria-label="Weave warnings">
          {warnings.map((warning, index) => (
            <li key={index}>{warningText(warning)}</li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
