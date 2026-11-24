// What the motif builder understood (motif-builder 3.2, 3.3): one chip per part of the plan, each a
// native select whose option text names its kind ("4 petals", "plain ground", "3 colours"), so the
// chip reads as a summary and is also its own control. A change is an override on top of the text
// (1.7); the panel clears overrides when the text changes.
import type { BuilderLayout, BuilderSize, BuilderSubject, MotifDescription, PlanOverrides, Symmetry } from "@jacquard/motif";
import { BUILDER_COLOURS, BUILDER_LAYOUTS, BUILDER_SIZES, BUILDER_SUBJECTS, COUNT_RANGES, FIGURE_SUBJECTS, picksSymmetric } from "@jacquard/motif";
import { Hint } from "./ui/hint";

const SUBJECT_LABELS: Readonly<Record<BuilderSubject, string>> = {
  lotus: "lotus",
  peacock: "peacock",
  star: "star",
  diamond: "diamond",
  paisley: "paisley",
  rosette: "rosette",
  tree: "tree",
  elephant: "elephant",
  border: "border",
  stripe: "stripes",
  check: "check",
  lattice: "lattice",
};

/** "single butta" is the builder's name for one motif in the repeat [to verify]. */
const LAYOUT_LABELS: Readonly<Record<BuilderLayout, string>> = {
  single: "single butta",
  border: "border",
  allOver: "all-over repeat",
};

const SIZE_LABELS: Readonly<Record<BuilderSize, string>> = { small: "small", medium: "medium", large: "large" };

export const SYMMETRY_CHIP_LABELS: Readonly<Record<Symmetry, string>> = {
  none: "no symmetry",
  mirrorEnds: "mirror",
  mirrorPicks: "mirror top to bottom",
  mirrorBoth: "four-way",
};

const SINGULAR: Readonly<Record<string, string>> = { petals: "petal", points: "point", stripes: "stripe", bands: "band", teeth: "tooth", cells: "cell" };

function countLabel(count: number, noun: string): string {
  return `${count} ${count === 1 ? (SINGULAR[noun] ?? noun) : noun}`;
}

function groundLabel(name: string): string {
  return name === "cream" ? "plain ground" : `${name} ground`;
}

/** The chip text in order, for the summary line and tests: "lotus · 4 petals · plain ground · 3 colours". */
export function chipSummary(description: MotifDescription): string {
  const { plan } = description;
  const parts = [SUBJECT_LABELS[plan.subject]];
  const range = COUNT_RANGES[plan.subject];
  if (range !== undefined && plan.count !== null) parts.push(countLabel(plan.count, range.noun));
  parts.push(groundLabel(plan.colours[0]?.name ?? "cream"), `${plan.colours.length} colours`);
  if (FIGURE_SUBJECTS.has(plan.subject)) parts.push(LAYOUT_LABELS[plan.layout], SIZE_LABELS[plan.size]);
  parts.push(SYMMETRY_CHIP_LABELS[plan.symmetry]);
  return parts.join(" · ");
}

export interface MotifChipsProps {
  readonly description: MotifDescription;
  readonly overrides: PlanOverrides;
  readonly onChange: (overrides: PlanOverrides) => void;
  /** The profile's region limit, at most 4. */
  readonly maxColours: number;
  readonly disabled?: boolean;
}

interface Chip {
  readonly key: string;
  readonly label: string;
  readonly value: string;
  readonly options: readonly { readonly value: string; readonly text: string }[];
  readonly set: (value: string) => PlanOverrides;
}

export function MotifChips({ description, overrides, onChange, maxColours, disabled = false }: MotifChipsProps) {
  const { plan } = description;
  const range = COUNT_RANGES[plan.subject];
  const figure = FIGURE_SUBJECTS.has(plan.subject);
  const symmetries: readonly Symmetry[] = picksSymmetric(plan.subject, plan.count)
    ? ["none", "mirrorEnds", "mirrorPicks", "mirrorBoth"]
    : ["none", "mirrorEnds"];
  const colourCounts = Array.from({ length: Math.max(0, Math.min(4, maxColours) - 1) }, (_, index) => index + 2);
  const chips: Chip[] = [
    {
      key: "subject",
      label: "Motif subject",
      value: plan.subject,
      options: BUILDER_SUBJECTS.map((subject) => ({ value: subject, text: SUBJECT_LABELS[subject] })),
      // A new subject starts from its own count.
      set: (value) => {
        const { count: _count, ...rest } = overrides;
        return { ...rest, subject: value as BuilderSubject };
      },
    },
  ];
  if (range !== undefined && plan.count !== null) {
    chips.push({
      key: "count",
      label: `Number of ${range.noun}`,
      value: String(plan.count),
      options: Array.from({ length: range.max - range.min + 1 }, (_, index) => {
        const count = range.min + index;
        return { value: String(count), text: countLabel(count, range.noun) };
      }),
      set: (value) => ({ ...overrides, count: Number(value) }),
    });
  }
  chips.push(
    {
      key: "ground",
      label: "Ground colour",
      value: plan.colours[0]?.name ?? "cream",
      options: BUILDER_COLOURS.map((colour) => ({ value: colour.name, text: groundLabel(colour.name) })),
      set: (value) => ({ ...overrides, ground: value }),
    },
    {
      key: "colours",
      label: "Colour count, with the ground",
      value: String(plan.colours.length),
      options: colourCounts.map((count) => ({ value: String(count), text: `${count} colours` })),
      set: (value) => ({ ...overrides, colourCount: Number(value) }),
    },
  );
  if (figure) {
    chips.push(
      {
        key: "layout",
        label: "Motif layout",
        value: plan.layout,
        options: BUILDER_LAYOUTS.map((layout) => ({ value: layout, text: LAYOUT_LABELS[layout] })),
        set: (value) => ({ ...overrides, layout: value as BuilderLayout }),
      },
      {
        key: "size",
        label: "Motif size",
        value: plan.size,
        options: BUILDER_SIZES.map((size) => ({ value: size, text: SIZE_LABELS[size] })),
        set: (value) => ({ ...overrides, size: value as BuilderSize }),
      },
    );
  }
  chips.push({
    key: "symmetry",
    label: "Motif symmetry",
    value: plan.symmetry,
    options: symmetries.map((symmetry) => ({ value: symmetry, text: SYMMETRY_CHIP_LABELS[symmetry] })),
    set: (value) => ({ ...overrides, symmetry: value as Symmetry }),
  });

  return (
    <div className="motif-chips">
      <div role="group" aria-label="What the motif builder understood" className="chip-row">
        <span className="chip-row-label small">
          Understood:{" "}
          <Hint topic="the chips">Each part is a menu: change it to steer the motif. Typing in the box starts again from your words.</Hint>
        </span>
        {chips.map((chip, index) => (
          // A separator stays on the line of the chip it comes before.
          <span key={chip.key} className="chip-item">
            {index > 0 ? (
              <span className="chip-separator" aria-hidden="true">
                ·
              </span>
            ) : null}
            <select
              className="chip"
              name={`motif-${chip.key}`}
              aria-label={chip.label}
              value={chip.value}
              disabled={disabled}
              onChange={(event) => onChange(chip.set(event.target.value))}
            >
              {chip.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.text}
                </option>
              ))}
            </select>
          </span>
        ))}
      </div>
      <div className="small muted chip-notes">
        {description.fellBack ? <p>No subject word was found, so this is a rosette. Choose a subject above, or name one.</p> : null}
        <p>
          {description.understood.length > 0 ? `Words used: ${description.understood.join(", ")}.` : "No words used yet."}
          {description.unused.length > 0 ? ` Not used: ${description.unused.join(", ")}.` : ""}
        </p>
        {description.notes.map((note) => (
          <p key={note}>{note}</p>
        ))}
      </div>
    </div>
  );
}
