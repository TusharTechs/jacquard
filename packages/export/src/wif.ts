// WIF writer and reader (Requirement 3). See design.md, "WIF".
//
// [to verify] The mapping of a Jacquard lift plan into WIF 1.1 is one shaft per figuring hook,
// warp end h threaded on shaft h + 1, and one [LIFTPLAN] line per pick listing the lifted shafts
// (no tie-up, no treadling). It has not yet been confirmed by opening an exported file in a weaving
// tool we did not write (3.7). The section names come from secondary descriptions of WIF 1.1,
// because the published text could not be fetched (requirements.md, Decision log).
//
// Spare hooks are not shafts; idle hooks are threaded and never lifted [decision].
import { defineProfile, err, ok, validatePlan, type LiftPlan, type LoomProfile } from "@jacquard/engine";
import { checkYarns } from "./cloth.js";
import { hexToRgb } from "./text.js";
import { checkPlan, exportError, type ExportResult, type YarnColours } from "./types.js";

export interface WifOptions {
  /** Written to `[TEXT] Title`. Default "JACQUARD". */
  readonly title?: string;
}

/** Name of the private section that carries what WIF has no field for (design.md, "WIF"). */
const PRIVATE_SECTION = "JACQUARD";

/** A title on one line, without the brackets that start an INI section. */
function cleanTitle(title: string): string {
  return title
    .replace(/[\r\n]+/g, " ")
    .replace(/\[/g, "(")
    .replace(/\]/g, ")");
}

/**
 * Writes WIF 1.1 text for a lift plan (3.1 to 3.4). The plan and profile go through the engine
 * checks first and their error is returned unchanged (4.8); then the yarns are checked (1.4).
 * Sections and keys are written in the order of design.md, with `\r\n` line endings and no date.
 * A private `[JACQUARD]` section at the end carries `DesignWidth` and `RepeatAcross` for the round
 * trip (3.5); other WIF readers ignore unknown sections. The inputs are not modified.
 */
export function writeWif(
  plan: LiftPlan,
  profile: LoomProfile,
  yarns: YarnColours,
  options: WifOptions = {},
): ExportResult<string> {
  const checked = checkPlan(plan, profile);
  if (!checked.ok) return err(checked.error);
  const yarnCheck = checkYarns(yarns);
  if (!yarnCheck.ok) return err(yarnCheck.error);

  const { hookCount, pickCount } = plan;
  const warpCount = yarns.warp.length;
  const weftCount = yarns.weft.length;
  const lines: string[] = [
    "[WIF]",
    "Version=1.1",
    "Developers=JACQUARD",
    "Source Program=JACQUARD",
    "Source Version=0.1",
    "[CONTENTS]",
    "COLOR PALETTE=true",
    "TEXT=true",
    "WEAVING=true",
    "WARP=true",
    "WEFT=true",
    "COLOR TABLE=true",
    "THREADING=true",
    "LIFTPLAN=true",
    "WARP COLORS=true",
    "WEFT COLORS=true",
    "[TEXT]",
    `Title=${cleanTitle(options.title ?? "JACQUARD")}`,
    "[WEAVING]",
    `Shafts=${hookCount}`,
    "Treadles=0",
    "Rising Shed=true",
    "[WARP]",
    `Threads=${hookCount}`,
    "Color=1",
    "[WEFT]",
    `Threads=${pickCount}`,
    `Color=${1 + warpCount}`,
    "[COLOR PALETTE]",
    `Entries=${warpCount + weftCount}`,
    "Form=RGB",
    "Range=0,255",
    "[COLOR TABLE]",
  ];
  const colours = [...yarns.warp, ...yarns.weft];
  colours.forEach((colour, index) => lines.push(`${index + 1}=${hexToRgb(colour).join(",")}`));
  lines.push("[WARP COLORS]");
  for (let end = 0; end < hookCount; end += 1) lines.push(`${end + 1}=${1 + (end % warpCount)}`);
  lines.push("[WEFT COLORS]");
  for (let pick = 0; pick < pickCount; pick += 1) {
    lines.push(`${pick + 1}=${1 + warpCount + (pick % weftCount)}`);
  }
  lines.push("[THREADING]");
  for (let end = 0; end < hookCount; end += 1) lines.push(`${end + 1}=${end + 1}`);
  lines.push("[LIFTPLAN]");
  for (let pick = 0; pick < pickCount; pick += 1) {
    const row = plan.lifts[pick] as readonly boolean[];
    const shafts: number[] = [];
    for (let hook = 0; hook < hookCount; hook += 1) if (row[hook] === true) shafts.push(hook + 1);
    lines.push(`${pick + 1}=${shafts.join(",")}`);
  }
  lines.push(`[${PRIVATE_SECTION}]`);
  lines.push(`DesignWidth=${plan.designWidth}`);
  lines.push(`RepeatAcross=${plan.repeatAcross ? "true" : "false"}`);
  return ok(lines.map((line) => `${line}\r\n`).join(""));
}

type Sections = Map<string, Map<string, string>>;

function wifInvalid(detail: string): ExportResult<never> {
  return err(exportError("WIF_INVALID", `The WIF file cannot be read as a lift plan: ${detail}.`, detail));
}

/**
 * Splits INI text into sections of keys. Section and key names are upper-cased (WIF names are
 * case-insensitive); values are trimmed. Blank lines, `;` comment lines and lines before the first
 * section are ignored. A section that appears twice is merged, the later key winning.
 */
function parseSections(text: string): Sections {
  const sections: Sections = new Map();
  let current: Map<string, string> | undefined;
  for (const raw of text.split(/\r\n|\n|\r/)) {
    const line = raw.trim();
    if (line === "" || line.startsWith(";")) continue;
    const header = /^\[(.*)\]$/.exec(line);
    if (header !== null) {
      const name = (header[1] as string).trim().toUpperCase();
      current = sections.get(name) ?? new Map<string, string>();
      sections.set(name, current);
      continue;
    }
    if (current === undefined) continue;
    const at = line.indexOf("=");
    if (at < 0) continue;
    current.set(line.slice(0, at).trim().toUpperCase(), line.slice(at + 1).trim());
  }
  return sections;
}

/** A positive integer written as plain digits, or undefined. */
function positiveInteger(text: string | undefined): number | undefined {
  if (text === undefined || !/^[0-9]+$/.test(text)) return undefined;
  const value = Number(text);
  return Number.isSafeInteger(value) && value > 0 ? value : undefined;
}

/**
 * Reads a WIF file back to a lift plan (3.5, 3.6). Needs `[WEAVING] Shafts`, `[WEFT] Threads`,
 * `[THREADING]` with end i on shaft i for every end (`[WARP] Threads` must equal `Shafts` when
 * given), and `[LIFTPLAN]` with shafts in 1 to `Shafts`. A pick with no `[LIFTPLAN]` line lifts
 * nothing. `Rising Shed=false` is rejected, because the liftplan would then list lowered shafts.
 * `designWidth` and `repeatAcross` come from the private `[JACQUARD]` section; without it they are
 * `hookCount` and false. The result goes through the engine's `validatePlan` for a profile of
 * `hookCount` hooks. Every failure is `WIF_INVALID` with a `detail` naming the problem.
 */
export function readWif(text: string): ExportResult<LiftPlan> {
  if (typeof text !== "string") return wifInvalid("the input is not text");
  const sections = parseSections(text);
  const weaving = sections.get("WEAVING");
  if (weaving === undefined) return wifInvalid("missing section [WEAVING]");
  const hookCount = positiveInteger(weaving.get("SHAFTS"));
  if (hookCount === undefined) return wifInvalid("[WEAVING] Shafts is not a positive integer");
  const risingShed = weaving.get("RISING SHED");
  if (risingShed !== undefined && risingShed.toLowerCase() !== "true") {
    return wifInvalid("[WEAVING] Rising Shed is not true");
  }
  const weft = sections.get("WEFT");
  if (weft === undefined) return wifInvalid("missing section [WEFT]");
  const pickCount = positiveInteger(weft.get("THREADS"));
  if (pickCount === undefined) return wifInvalid("[WEFT] Threads is not a positive integer");
  const warpThreads = sections.get("WARP")?.get("THREADS");
  if (warpThreads !== undefined && positiveInteger(warpThreads) !== hookCount) {
    return wifInvalid("[WARP] Threads does not equal [WEAVING] Shafts");
  }

  const threading = sections.get("THREADING");
  if (threading === undefined) return wifInvalid("missing section [THREADING]");
  for (const [key, value] of threading) {
    const end = positiveInteger(key);
    if (end === undefined || end > hookCount) return wifInvalid(`[THREADING] has an end ${key} outside 1 to ${hookCount}`);
    if (value !== key) return wifInvalid(`[THREADING] end ${end} is not on shaft ${end}`);
  }
  for (let end = 1; end <= hookCount; end += 1) {
    if (!threading.has(String(end))) return wifInvalid(`[THREADING] has no entry for end ${end}`);
  }

  const liftplan = sections.get("LIFTPLAN");
  if (liftplan === undefined) return wifInvalid("missing section [LIFTPLAN]");
  const lifts: boolean[][] = [];
  for (let pick = 0; pick < pickCount; pick += 1) lifts.push(new Array<boolean>(hookCount).fill(false));
  for (const [key, value] of liftplan) {
    const pick = positiveInteger(key);
    if (pick === undefined || pick > pickCount) return wifInvalid(`[LIFTPLAN] has a pick ${key} outside 1 to ${pickCount}`);
    if (value === "") continue;
    const row = lifts[pick - 1] as boolean[];
    for (const token of value.split(",")) {
      const shaft = positiveInteger(token.trim());
      if (shaft === undefined || shaft > hookCount) {
        return wifInvalid(`[LIFTPLAN] pick ${pick} has a shaft ${token.trim()} outside 1 to ${hookCount}`);
      }
      row[shaft - 1] = true;
    }
  }

  let designWidth = hookCount;
  let repeatAcross = false;
  const extra = sections.get(PRIVATE_SECTION);
  if (extra !== undefined) {
    const width = positiveInteger(extra.get("DESIGNWIDTH"));
    if (width === undefined) return wifInvalid(`[${PRIVATE_SECTION}] DesignWidth is not a positive integer`);
    const repeat = extra.get("REPEATACROSS")?.toLowerCase();
    if (repeat !== "true" && repeat !== "false") {
      return wifInvalid(`[${PRIVATE_SECTION}] RepeatAcross is not true or false`);
    }
    designWidth = width;
    repeatAcross = repeat === "true";
  }

  const plan: LiftPlan = { pickCount, hookCount, designWidth, repeatAcross, lifts };
  const profile: LoomProfile = defineProfile({ hookCount });
  const validated = validatePlan(plan, profile);
  if (!validated.ok) return wifInvalid(`the lift plan is not valid (${validated.error.message})`);
  return ok(plan);
}
