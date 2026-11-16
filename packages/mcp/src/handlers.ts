// Tool handlers. Each resolves the profile, calls one engine function and maps the engine result.
// No weaving logic lives here (10.3). Arguments reach this module only after checkArguments, and
// are passed to the engine as they are, never copied or changed.
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { CardSet, Design, LiftPlan, LoomProfile, WeaveAssignment } from "@jacquard/engine";
import type { EngineApi } from "./engine-api.js";
import { LABEL_TABLE } from "./labels.js";
import type { BuiltInName } from "./labels.js";
import { resolveProfile } from "./profile.js";
import { toolError, toolResult } from "./results.js";

export type ToolArgs = Readonly<Record<string, unknown>>;
export type Handler = (args: ToolArgs, engine: EngineApi) => CallToolResult;

const BUILT_IN_NAMES: readonly BuiltInName[] = ["120", "240", "400"];

/** list_profiles (Requirement 2): the three built-in profiles, each field as { value, label }. */
export const listProfiles: Handler = (_args, engine) => {
  const profiles = BUILT_IN_NAMES.map((name, index) => {
    const profile = engine.profiles[index as 0 | 1 | 2];
    const labels = LABEL_TABLE[name];
    const fields: Record<string, { value: unknown; label: string }> = {};
    for (const key of Object.keys(profile) as (keyof LoomProfile)[]) {
      fields[key] = { value: profile[key], label: labels[key] };
    }
    return { name, fields };
  });
  return toolResult({ profiles });
};

/** build_lift_plan (Requirement 3): `repeatAcross` defaults to false; weaves pass through unchanged. */
export const buildLiftPlanTool: Handler = (args, engine) => {
  const resolved = resolveProfile(args["profile"], engine);
  if (!resolved.ok) return toolError(resolved.error);
  const result = engine.buildLiftPlan({
    design: args["design"] as Design,
    weaves: args["weaves"] as WeaveAssignment,
    profile: resolved.profile,
    repeatAcross: (args["repeatAcross"] as boolean | undefined) ?? false,
  });
  if (!result.ok) return toolError(result.error);
  // The engine's BuildOutput is { plan, idleHooks, warnings }; it is returned as it is.
  return toolResult(result.value);
};

/** check_floats (Requirement 4): `{ violations }`; an empty list is a success. */
export const checkFloatsTool: Handler = (args, engine) => {
  const resolved = resolveProfile(args["profile"], engine);
  if (!resolved.ok) return toolError(resolved.error);
  const result = engine.checkFloats(args["plan"] as LiftPlan, resolved.profile);
  if (!result.ok) return toolError(result.error);
  return toolResult({ violations: result.value });
};

/** auto_fix (Requirement 5): engine defaults only; `{ plan, flips }` or the engine error unchanged. */
export const autoFixTool: Handler = (args, engine) => {
  const resolved = resolveProfile(args["profile"], engine);
  if (!resolved.ok) return toolError(resolved.error);
  const result = engine.autoFix(args["plan"] as LiftPlan, resolved.profile);
  if (!result.ok) return toolError(result.error);
  return toolResult(result.value);
};

/** build_cards (Requirement 6): `{ cardSet, cardRows }`, one engine `cardRows` call per card in card order. */
export const buildCardsTool: Handler = (args, engine) => {
  const resolved = resolveProfile(args["profile"], engine);
  if (!resolved.ok) return toolError(resolved.error);
  const result = engine.buildCards(args["plan"] as LiftPlan, resolved.profile);
  if (!result.ok) return toolError(result.error);
  const cardSet = result.value;
  const cardRows = cardSet.cards.map((card) => engine.cardRows(card, resolved.profile));
  return toolResult({ cardSet, cardRows });
};

/** decode_cards (Requirement 7): `{ plan }` or the engine error unchanged. */
export const decodeCardsTool: Handler = (args, engine) => {
  const resolved = resolveProfile(args["profile"], engine);
  if (!resolved.ok) return toolError(resolved.error);
  const result = engine.decodeCards(args["cardSet"] as CardSet, resolved.profile);
  if (!result.ok) return toolError(result.error);
  return toolResult({ plan: result.value });
};
