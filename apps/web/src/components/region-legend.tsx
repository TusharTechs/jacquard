// The paint region chooser: one radio per region with its swatch. Arrow keys move within the
// group (native radios); the number keys 1 to 8 choose region 0 to 7 while focus is on the point paper, its toolbar or this legend.
import { contrastText } from "../lib/palette";

export interface RegionLegendProps {
  readonly colours: readonly string[];
  readonly region: number;
  readonly onChange: (region: number) => void;
}

export function RegionLegend({ colours, region, onChange }: RegionLegendProps) {
  return (
    <fieldset className="legend" data-region-keys="">
      <legend>Paint region</legend>
      <div className="legend-options">
      {colours.map((colour, index) => (
        <label className="legend-option" key={index}>
          <input
            type="radio"
            name="paint-region"
            value={index}
            checked={index === region}
            onChange={() => onChange(index)}
            aria-keyshortcuts={index < 8 ? String(index + 1) : undefined}
          />
          <span className="legend-label">
            <span className="swatch" style={{ background: colour, color: contrastText(colour) }} aria-hidden="true" />
            <span>
              Region <span className="mono">{index}</span>
            </span>
            {index < 8 ? (
              <kbd className="legend-key" title={`Key ${index + 1}`} aria-hidden="true">
                {index + 1}
              </kbd>
            ) : null}
          </span>
        </label>
      ))}
      </div>
    </fieldset>
  );
}
