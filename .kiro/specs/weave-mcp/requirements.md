# Requirements Document

## Introduction

Scope: `packages/mcp` (`@jacquard/mcp`), a Model Context Protocol server over stdio that exposes `@jacquard/engine` as six tools, so that Kiro and other MCP clients can design and check weaves. The server is a thin adapter. It contains no weaving logic: every result comes from an engine function, and every loom fact comes from a loom profile.

The server inherits the engine's labels and rules (`.kiro/steering/weaving-domain.md`, `.kiro/specs/weave-engine/requirements.md`). The card format has not been tested on a working loom, and the server says so in its tool descriptions.

Acceptance criteria are cited as `N.M`: criterion M of Requirement N. Requirement 14 is the final task of `tasks.md`. It covers configuration and custom agents, not server code.

## Glossary

- **MCP_Server**: the stdio Model Context Protocol server in `packages/mcp`.
- **Engine**: the package `@jacquard/engine`.
- **Tool**: one of the six named operations the MCP_Server exposes: `list_profiles`, `build_lift_plan`, `check_floats`, `auto_fix`, `build_cards`, `decode_cards`.
- **Client**: any MCP client that calls the MCP_Server.
- **Tool_Result**: the JSON value that a Tool returns on success.
- **Tool_Error**: the structured error that a Tool returns on failure, flagged as an error in the MCP tool-result `isError` field.
- **Engine_Error**: an `EngineError` value from the Engine, with its stable `code` and its fields.
- **Argument_Error**: a Tool_Error for an argument that fails the Tool's input schema. It has the code `ARGUMENT_INVALID`.
- **Profile_Argument**: the `profile` argument of a Tool. It is either a built-in profile name (`"120"`, `"240"` or `"400"`) or an object of custom profile fields.
- **Resolved_Profile**: the `LoomProfile` produced from a Profile_Argument by the Engine functions `defineProfile` and `validateProfile`.
- **Field_Label**: one of `[convention]`, `[sourced]`, `[decision]`, `[to verify]`, as defined in the weave-engine requirements.
- **Label_Table**: static data in the MCP_Server that maps each built-in profile and each profile field to its Field_Label. It holds data only.
- **Lift_Plan, Card_Set, Violation, Flip**: the engine types of the same names.
- **Card_Rows**: the ordered list of per-card outputs of the Engine function `cardRows`, one entry per card of a Card_Set, in card order.
- **SDK**: the package `@modelcontextprotocol/sdk`.
- **Canonical_JSON**: JSON text with object keys sorted in ascending UTF-16 code unit order at every depth, array order preserved, and no insignificant whitespace.

## Requirements

### Requirement 1: Server and tool set

**User Story:** As a Client developer, I want a stdio MCP server with a fixed set of named tools, so that Kiro and other clients can discover and call the weave engine.

#### Acceptance Criteria

1. WHEN a Client starts the MCP_Server and sends a tool list request, THE MCP_Server SHALL return a list containing exactly six Tools, named `list_profiles`, `build_lift_plan`, `check_floats`, `auto_fix`, `build_cards` and `decode_cards`, in that order, with no duplicate or additional names.
2. THE MCP_Server SHALL receive MCP protocol messages on standard input and send MCP protocol messages on standard output.
3. THE MCP_Server SHALL give each Tool a non-empty description of at most 1000 characters and a JSON input schema that is a valid JSON Schema object.
4. THE MCP_Server SHALL include, in the description of each of `build_cards` and `decode_cards`, a sentence stating that the card format has not been tested on a working loom.
5. IF a Client calls a Tool name that is not one of the six Tools, THEN THE MCP_Server SHALL return a Tool_Error with the code `TOOL_UNKNOWN` whose message contains the unknown name exactly as the Client sent it, SHALL leave the MCP_Server running, and SHALL answer the next valid request from the same Client normally.
6. THE MCP_Server SHALL write nothing to standard output except complete MCP protocol messages, and SHALL send all diagnostic and log output to standard error.
7. IF a Client sends a message on standard input that is not valid MCP protocol input, THEN THE MCP_Server SHALL keep running and SHALL write nothing to standard output except complete MCP protocol messages. Whether the MCP_Server sends an error reply for that message is left to the SDK transport.

### Requirement 2: list_profiles

**User Story:** As a designer using an MCP client, I want to see the built-in loom profiles with the label of every field, so that I know which loom facts are sourced and which are still to be verified.

#### Acceptance Criteria

1. WHEN a Client calls `list_profiles`, THE MCP_Server SHALL return exactly three profiles, `PROFILE_120`, `PROFILE_240` and `PROFILE_400`, taken from the Engine without modification, in the order 120, 240, 400.
2. WHEN a Client calls `list_profiles`, THE MCP_Server SHALL return, for every field of every built-in profile, the field's value and its Field_Label from the Label_Table, so that each of the three profiles has the same number of value and Field_Label pairs as the Engine `LoomProfile` type has fields.
3. THE Label_Table SHALL contain, for every field of every built-in profile, a Field_Label equal to the bracketed label token (one of `[convention]`, `[sourced]`, `[decision]`, `[to verify]`) that appears in the comment on that field in `packages/engine/src/profiles.ts`, comparing only the bracketed token and not the rest of the comment text. WHEN the comment on a field contains more than one bracketed label token, THE Label_Table SHALL hold the least certain of them, in the order `[to verify]` (least certain), `[decision]`, `[convention]`, `[sourced]` (most certain).
4. THE MCP_Server SHALL define a Field_Label for every field of the Engine `LoomProfile` type, and no returned field SHALL have an empty or missing Field_Label.
5. WHEN a Client calls `list_profiles` with no arguments, THE MCP_Server SHALL return the profile list without error.
6. WHEN a Client calls `list_profiles` twice with no change to the Engine, THE MCP_Server SHALL return byte-identical results both times.

### Requirement 3: build_lift_plan

**User Story:** As a designer, I want to send a design, a weave assignment and a loom profile and get back the lift plan, so that I can build a weave from an MCP client.

#### Acceptance Criteria

1. WHEN a Client calls `build_lift_plan` with a design, a weave assignment, a Profile_Argument and an optional boolean `repeatAcross`, THE MCP_Server SHALL return the Engine `buildLiftPlan` output (the Lift_Plan, the idle hooks and the warnings) as a successful tool result, identical to what the Engine produces when called directly with the same inputs.
2. WHERE `repeatAcross` is omitted, THE MCP_Server SHALL pass `false` to the Engine.
3. WHEN the weave assignment is a JSON object, THE MCP_Server SHALL treat each key as a region index only if the key is the canonical decimal text of a non-negative integer (digits only, no sign, no leading zeros except "0" itself, no whitespace, no fractional part), and SHALL pass the Engine a `WeaveAssignment` with the same region-to-weave mapping, with one entry per key and no entries added, dropped or renumbered.
4. IF a weave assignment key is not canonical decimal text of a non-negative integer, THEN THE MCP_Server SHALL return an Argument_Error naming `weaves` and the offending key (Requirement 9), SHALL NOT call the Engine, and SHALL NOT change any state.
5. IF a required argument (design, weave assignment or Profile_Argument) is missing, or `repeatAcross` is present and is not a boolean, THEN THE MCP_Server SHALL return an Argument_Error naming the invalid argument (Requirement 9), SHALL NOT call the Engine, and SHALL NOT change any state.
6. IF the Engine rejects the design, the weaves or the profile, THEN THE MCP_Server SHALL return the Engine_Error as a Tool_Error (Requirement 8), with its code and message preserved unchanged, and SHALL NOT return a partial Lift_Plan.

### Requirement 4: check_floats

**User Story:** As a designer, I want every float over the loom limit listed, so that I can see where the cloth would be weak.

#### Acceptance Criteria

1. WHEN a Client calls `check_floats` with a valid Lift_Plan and a valid Profile_Argument, THE MCP_Server SHALL return the Violation list produced by the Engine `checkFloats` for that Lift_Plan and profile, with the same violations in the same order and no violation added, removed or altered.
2. WHEN a Client calls `check_floats` with a valid Lift_Plan and a valid Profile_Argument and the Engine `checkFloats` reports no violations, THE MCP_Server SHALL return a Violation list containing 0 entries and SHALL NOT return a Tool_Error.
3. IF the Engine rejects the Lift_Plan or the Profile_Argument, THEN THE MCP_Server SHALL return the Engine_Error as a Tool_Error (Requirement 8), SHALL NOT return a Violation list, and SHALL leave the supplied Lift_Plan unmodified.
4. IF a Client calls `check_floats` without a Lift_Plan or without a Profile_Argument, THEN THE MCP_Server SHALL return an Argument_Error naming the missing argument (Requirement 9), SHALL NOT call the Engine `checkFloats`, and SHALL NOT return a Violation list.
5. WHEN a Client calls `check_floats` twice with identical Lift_Plan and Profile_Argument values, THE MCP_Server SHALL return Violation lists that are byte-for-byte identical when serialized.

### Requirement 5: auto_fix

**User Story:** As a designer, I want long floats fixed by adding binding points, so that the cloth is sound and the regions stay as drawn.

#### Acceptance Criteria

1. WHEN a Client calls `auto_fix` with a Lift_Plan and a Profile_Argument that both pass validation, THE MCP_Server SHALL return the Engine `autoFix` output containing the fixed Lift_Plan and the list of Flips in the order the Engine produced them, with no Flips added, removed or reordered by the MCP_Server.
2. WHEN the Engine `autoFix` output contains zero Flips, THE MCP_Server SHALL return the Lift_Plan unchanged and an empty list of Flips as a success result, not a Tool_Error.
3. IF the Engine returns `AUTOFIX_FAILED`, THEN THE MCP_Server SHALL return a Tool_Error that preserves the `reason`, `maxIterations` and `remaining` values exactly as the Engine reported them, and SHALL NOT return a partially fixed Lift_Plan (Requirement 8).
4. IF the Lift_Plan or the Profile_Argument is rejected by the Engine, THEN THE MCP_Server SHALL return the Engine's typed error as a Tool_Error (Requirement 8) and SHALL leave the supplied Lift_Plan unmodified.
5. THE MCP_Server SHALL call `autoFix` with the Engine's default options and SHALL NOT accept any option argument on `auto_fix` in version 1.
6. IF a Client supplies an argument to `auto_fix` other than the Lift_Plan and the Profile_Argument, THEN THE MCP_Server SHALL return an Argument_Error naming the unexpected argument (Requirement 9), SHALL NOT call `autoFix`, and SHALL NOT apply the argument.

### Requirement 6: build_cards

**User Story:** As a card puncher, I want a numbered card set in lacing order with its card rows, so that I can punch the cards from a lift plan.

#### Acceptance Criteria

1. WHEN a Client calls `build_cards` with a Lift_Plan and a Profile_Argument that the Engine accepts, THE MCP_Server SHALL return a result containing the Engine `buildCards` Card_Set and, for each card of that Card_Set, the Card_Rows produced by the Engine `cardRows` for that card and the profile, as an ordered list with one entry per card in card order, with the Card_Set and every entry identical to the Engine output and with no weaving logic applied by the MCP_Server.
2. WHEN `build_cards` returns successfully, THE MCP_Server SHALL return exactly one card for each pick of the Lift_Plan, so that the card count equals the pick count.
3. WHEN `build_cards` returns successfully, THE MCP_Server SHALL number the cards with consecutive integers from 1 to the pick count, with card 1 corresponding to the first pick of the Lift_Plan and each later card following in pick order (lacing order).
4. WHEN the same Lift_Plan and Profile_Argument are passed to `build_cards` more than once, THE MCP_Server SHALL return byte-identical results on every call.
5. IF the Engine rejects the Lift_Plan or the Profile_Argument, THEN THE MCP_Server SHALL return the Engine_Error as a Tool_Error (Requirement 8), SHALL NOT return a Card_Set or Card_Rows, and SHALL leave the supplied Lift_Plan unmodified.

### Requirement 7: decode_cards

**User Story:** As a card puncher, I want to turn a card set back into a lift plan, so that I can check what a set of cards would weave.

#### Acceptance Criteria

1. WHEN a Client calls `decode_cards` with a Card_Set and a Profile_Argument that both pass validation, THE MCP_Server SHALL return the Lift_Plan produced by the Engine `decodeCards`, with no weaving logic added by the MCP_Server.
2. IF the Engine rejects the Card_Set because it is empty, contains a card whose size differs from the Resolved_Profile card size, has a duplicate card number, has a missing card number in the range 1 to the card count, or has a lifted spare or idle position, THEN THE MCP_Server SHALL return the Engine_Error as a Tool_Error (Requirement 8), SHALL return no Lift_Plan, and SHALL leave the Card_Set unchanged.
3. IF the Profile_Argument is a built-in name that is unknown or its custom fields fail validation, THEN THE MCP_Server SHALL return an Argument_Error (Requirement 9) or the `PROFILE_INVALID` Engine_Error (Requirement 8) as those requirements specify, without calling the Engine `decodeCards`.
4. IF the Card_Set argument is missing or is not a structurally valid Card_Set (wrong type or missing required fields), THEN THE MCP_Server SHALL return an Argument_Error identifying the invalid argument (Requirement 9) without calling the Engine `decodeCards`.
5. FOR ALL valid Lift_Plans and Resolved_Profiles, calling `build_cards` and then `decode_cards` through the MCP_Server with the returned Card_Set and the same Profile_Argument SHALL return a Lift_Plan equal to the original, compared field by field (round-trip property).
6. WHEN `decode_cards` is called twice with identical Card_Set and Profile_Argument values, THE MCP_Server SHALL return byte-identical serialized Lift_Plans.

### Requirement 8: Engine errors as structured tool errors

**User Story:** As a Client developer, I want every engine failure returned as structured data with its code and fields, so that my client can show it and act on it.

#### Acceptance Criteria

1. IF an Engine function returns an Engine_Error, THEN THE MCP_Server SHALL return a Tool_Error with `isError` set to true whose structured content contains the Engine_Error's `code`, `message` and every other field of that Engine_Error with its original name and value, and SHALL NOT omit, rename or alter any field.
2. WHEN the MCP_Server returns a Tool_Error, THE MCP_Server SHALL return it as a normal Tool result and SHALL NOT throw it or signal it as a protocol-level failure.
3. IF an Engine function or a Tool handler throws an unexpected exception, THEN THE MCP_Server SHALL return a Tool_Error with `isError` set to true and the code `INTERNAL_ERROR`, and SHALL keep the connection open and the process running.
4. IF the MCP_Server returns an `INTERNAL_ERROR` Tool_Error, THEN THE MCP_Server SHALL NOT include a stack trace or any file system path in the Tool_Error's structured content.
5. WHEN a Tool call has failed with a Tool_Error, THE MCP_Server SHALL answer the next Tool call on the same connection with the same result it would have returned had no earlier call failed.
6. IF a Profile_Argument is not a built-in name and its fields fail `validateProfile`, THEN THE MCP_Server SHALL return a Tool_Error with `isError` set to true containing the `PROFILE_INVALID` Engine_Error, with the name and value of each invalid field, and SHALL NOT run the requested Tool operation.

### Requirement 9: Argument validation

**User Story:** As a Client developer, I want malformed arguments rejected with a message that names the argument, so that I can correct the call.

#### Acceptance Criteria

1. IF a required argument is absent or its value is `null`, THEN THE MCP_Server SHALL return an Argument_Error whose `argument` field is the name of that argument and whose message names that argument, and SHALL NOT call the Engine.
2. IF an argument has a JSON type other than the type declared for it in the tool's input schema, THEN THE MCP_Server SHALL return an Argument_Error whose `argument` field is the name or path of that argument and whose message names that argument and the expected JSON type, and SHALL NOT call the Engine.
3. IF a Profile_Argument is a string other than `"120"`, `"240"` or `"400"`, THEN THE MCP_Server SHALL return an Argument_Error whose `argument` field is `profile` and whose message names `profile` and lists all three accepted names `"120"`, `"240"` and `"400"`.
4. IF a Profile_Argument is an object without a `hookCount` property, THEN THE MCP_Server SHALL return an Argument_Error whose `argument` field is `profile.hookCount` and whose message names `profile.hookCount`.
5. IF a weave assignment has a key that does not match the decimal text of a non-negative integer (digits `0` to `9` only, no sign, no decimal point, no leading zeros except `"0"` itself), THEN THE MCP_Server SHALL return an Argument_Error whose `argument` field is `weaves` and whose message names `weaves` and quotes the offending key.
6. THE Argument_Error SHALL carry exactly the fields `code`, `argument` and `message`, where `code` is `ARGUMENT_INVALID`, `argument` is the name or path of the offending argument, and `message` is a non-empty string.
7. IF a call has more than one malformed argument, THEN THE MCP_Server SHALL return one Argument_Error for the first malformed argument in the order the arguments are declared in the tool's input schema.
8. THE MCP_Server SHALL check only the presence, JSON type and key format of arguments, and SHALL leave every domain check (design shape, cell values, region limit, plan consistency) to the Engine, so that the Engine's typed errors are the only source of domain errors.

### Requirement 10: Thin adapter fidelity

**User Story:** As a maintainer, I want every tool result to be exactly what the engine returns, so that the server cannot disagree with the engine or the web app.

#### Acceptance Criteria

1. FOR ALL valid inputs, WHEN a client calls `build_lift_plan`, `check_floats`, `auto_fix`, `build_cards` or `decode_cards`, THE MCP_Server SHALL return a Tool_Result whose Canonical_JSON text equals the Canonical_JSON text of the output of the corresponding Engine function called directly with the same input and the same Resolved_Profile, where both the server output and the Engine output pass through the same Canonical_JSON serialisation before the comparison, except for the Tool_Result envelope and the Card_Rows added to the `build_cards` result (model-based property, minimum 100 generated inputs per tool).
2. IF an input passes argument validation and the corresponding Engine function returns an Engine_Error, THEN THE MCP_Server SHALL return a Tool_Error whose `code` and every other field are equal in name and value to those of that Engine_Error, with no field added, dropped or renamed.
3. THE MCP_Server SHALL NOT evaluate weaves, find floats, flip cells, order cards or decode cards in its own code, and SHALL obtain each of these results only by calling the corresponding Engine function.
4. THE MCP_Server SHALL NOT change, add or drop any field of an Engine output, with two exceptions: wrapping the output in the Tool_Result envelope, and adding the Card_Rows to the `build_cards` result.
5. WHEN a tool handler completes, whether it returns a Tool_Result or a Tool_Error, THE MCP_Server SHALL leave every argument value deeply equal to its value before the call, including nested arrays and objects (checked by deep-comparing a copy taken before the call).

### Requirement 11: Determinism

**User Story:** As a developer, I want identical arguments to give identical results, so that tests, gallery files and agent audits are reproducible.

#### Acceptance Criteria

1. WHEN a Client calls a Tool twice with equal arguments, THE MCP_Server SHALL return Tool_Results whose Canonical_JSON serialisations are byte-identical, including for calls made in different MCP_Server processes started from the same build.
2. WHEN a Client calls a Tool, THE MCP_Server SHALL return the same Tool_Result regardless of which Tool calls were made earlier on the same connection or on other connections.
3. THE MCP_Server SHALL build each Tool_Result without reading the system clock, a random source, the process environment or the locale.
4. THE MCP_Server SHALL serialise each Tool_Result as Canonical_JSON, with object keys in ascending order of UTF-16 code unit value at every nesting depth.
5. WHEN a Tool_Result contains an array, THE MCP_Server SHALL emit the array elements in the order the engine returned them.
6. IF a Tool call fails, THEN THE MCP_Server SHALL return an error Tool_Result that is byte-identical across repeated calls with equal arguments, and that contains no timestamp, stack trace, absolute file path or process identifier.
7. WHEN a Tool_Result contains a number, THE MCP_Server SHALL serialise it in the same text form on every call, with no locale-dependent separators or decimal marks.

### Requirement 12: No side effects

**User Story:** As a user running the server from an agent, I want it to be read-only and offline, so that calling a tool cannot change my files or send my designs anywhere.

#### Acceptance Criteria

1. WHILE the MCP_Server handles a Tool call, THE MCP_Server SHALL NOT create, write, modify, rename or delete any file on the local filesystem.
2. WHILE the MCP_Server handles a Tool call, THE MCP_Server SHALL NOT open a network connection to any host. Communication with the calling MCP client over the server's own transport is excluded.
3. WHILE the MCP_Server handles a Tool call, THE MCP_Server SHALL NOT read environment variables or files. Each Tool_Result SHALL be computed only from the arguments of that Tool call and from the engine.
4. WHEN the same Tool is called twice with identical arguments, THE MCP_Server SHALL return byte-identical Tool_Results regardless of the Tool calls made before, between or after them.
5. WHEN the MCP_Server lists its Tools, THE MCP_Server SHALL include `readOnlyHint` set to true in the annotations of every Tool, and SHALL NOT list any Tool whose `readOnlyHint` is false or absent.
6. IF a Tool call fails with an error, THEN THE MCP_Server SHALL return an error Tool_Result and SHALL leave the filesystem unchanged and open no network connection while doing so.

### Requirement 13: Package boundary and dependencies

**User Story:** As a maintainer, I want the package to depend on the engine in one direction and pin its SDK, so that builds are reproducible and the layering holds.

#### Acceptance Criteria

1. THE `packages/mcp` package SHALL be named `@jacquard/mcp` and SHALL declare `@jacquard/engine` as a dependency using the pnpm workspace protocol, so that `pnpm install` resolves it to the local `packages/engine` folder and not to a registry download.
2. THE Engine SHALL NOT list `@jacquard/mcp` in any of its `dependencies`, `devDependencies` or `peerDependencies`, and the `dependencies` field of `packages/engine/package.json` SHALL contain 0 entries after this feature is merged.
3. THE `packages/mcp` package SHALL import the Engine only through the specifier `@jacquard/engine`, and no file under `packages/mcp/src` or `packages/mcp/test` SHALL import a path that contains `@jacquard/engine/` or `engine/src`.
4. THE `packages/mcp` package SHALL pin the MCP SDK to the exact version `1.32.2` and every other entry in its `dependencies` to an exact version string (digits and dots only), with no `^`, `~`, `>`, `<`, `*` or `x` range, and SHALL commit a `pnpm-lock.yaml` that records the resolved versions. `@jacquard/engine`, which uses the workspace protocol, is the only exception.
5. THE `packages/mcp` package SHALL define a `typecheck` script and a `test` script in its `package.json`, so that `pnpm -r typecheck` and `pnpm -r test` each run them and report `EXIT_CODE=0` when the package is clean.
6. THE `packages/mcp` package SHALL NOT create, modify, move or delete any file under `packages/engine/test/fixtures`, and a `git diff` of that folder against the commit before this feature SHALL be empty.
7. WHEN a Client launches the MCP_Server with `node` and a path relative to the workspace root that points to the built entry file of `packages/mcp`, THE MCP_Server SHALL complete the MCP initialize handshake within 5 seconds.
8. THE `test` script of `packages/mcp` SHALL run the build first (a `pretest` step), so that tests always run against a fresh build of the entry point, and SHALL fail with a non-zero exit code if that build fails.

### Requirement 14: Registration and custom agents (final task, configuration)

**User Story:** As the project owner, I want the server registered in the workspace and two read-only agents that use it, so that Kiro can audit designs and review the web app.

#### Acceptance Criteria

1. THE workspace SHALL register the MCP_Server in `.kiro/settings/mcp.json` using a command and arguments that resolve relative to the workspace root, with zero secret values in the file.
2. THE registration SHALL NOT contain an absolute path (a value starting with `/` or a drive letter), a user home directory (`~` or `/Users/`), an API key or a token.
3. THE workspace SHALL define the custom agent `weave-auditor` in `.kiro/agents/weave-auditor.json` with read-only access to the repository and permission to call exactly the six weave Tools of the MCP_Server and no other MCP tools.
4. WHEN the user asks the `weave-auditor` agent to audit a design or an engine change during the final task, THE `weave-auditor` agent SHALL report each finding that is a float violation, a card round-trip error, or a loom fact lacking a Field_Label. Each finding SHALL name the affected file or design and the category. THE `weave-auditor` agent SHALL modify zero files. The user checks this behaviour manually in the final task. It is a manual check, not a correctness property and not an automated test.
5. THE workspace SHALL define the custom agent `design-reviewer` in `.kiro/agents/design-reviewer.json` with read-only access to the repository.
6. WHEN the user asks the `design-reviewer` agent to review `apps/web` during the final task, THE `design-reviewer` agent SHALL check the app against `.kiro/steering/design-language.md` for empty states, loading states, error states, mobile states and accessibility. THE `design-reviewer` agent SHALL report each finding with the file and the state or accessibility category. THE `design-reviewer` agent SHALL modify zero files. The user checks this behaviour manually in the final task. It is a manual check, not a correctness property and not an automated test.
7. THE `weave-auditor` agent and THE `design-reviewer` agent SHALL each have zero write tools, zero shell tools, and zero permission to create, edit, move or delete files under `packages/engine/test/fixtures`.
8. IF an agent configuration lists a tool outside its allowed set, or the registration contains a value forbidden by criterion 2, THEN THE final task SHALL fail and report the offending file and value to the user.
9. THE MCP SDK version SHALL be the exact version `1.32.2`, with no `^`, `~`, `*` or range.
10. WHEN the final task ends, whether it completes successfully or stops on a failure (including a failure unrelated to the SDK), THE final task SHALL report the pinned MCP SDK version `1.32.2` to the user.

## Labels

Same as the weave-engine spec: **[convention]**, **[sourced]**, **[decision]**, **[to verify]**. This spec adds no loom facts. Profile values and labels come from the Engine.

## Decision log

| Q | Answer | Label |
|---|---|---|
| Where do per-field labels come from? | A Label_Table in `packages/mcp`. The Engine keeps labels only in comments and does not export them. The table is data, not weaving logic, and a test checks each Field_Label against the bracketed label token in the matching profile comment (2.3). Only the token is compared, not the rest of the comment. When a comment has more than one token, the least certain one wins (`[to verify]`, then `[decision]`, then `[convention]`, then `[sourced]`), so `PROFILE_400.cardFillOrder` is `[to verify]`. | [decision] |
| Profile argument | Built-in name as string, or object of custom fields passed to `defineProfile` then `validateProfile`. | [decision] |
| SDK version | `@modelcontextprotocol/sdk` exact version 1.32.2 is confirmed by the user as the current npm release and is pinned with no `^` or `~` (13.4, 14.9), and the final task reports the pinned version to the user (14.10). | [decision] |
| `auto_fix` options | None in version 1. The Engine default `maxIterations` applies (5.5). | [decision] |
| Label_Table location | The Label_Table lives in `packages/mcp`, not in the Engine (2.2, 2.3). Confirmed by the user. | [decision] |
| Card_Rows in `build_cards` | The Engine `cardRows` works on one card, so the `build_cards` result adds Card_Rows, an ordered list with one `cardRows` output per card in card order, next to the Card_Set (6.1, 10.4). Confirmed by the user. | [decision] |
| Malformed stdin input (1.7) | Relaxed: the server uses the SDK's stdio transport and keeps running; an error reply is left to the SDK. No custom transport. | [decision] |
| SDK server class | The server uses the low-level SDK `Server` with hand-written JSON Schema, so that `ARGUMENT_INVALID` and the declaration order of arguments (9.7) are ours. Confirmed by the user. | [decision] |
| Engine bundling | The engine is bundled into `dist/index.js` with esbuild 0.28.2 as a dev dependency. MCP source imports the engine only as `@jacquard/engine` (13.3). Confirmed by the user. | [decision] |
| Tool result shapes | Tool results are objects, because `structuredContent` must be an object: `build_lift_plan` returns `{ plan, idleHooks, warnings }`, `check_floats` returns `{ violations }`, `auto_fix` returns `{ plan, flips }`, `build_cards` returns `{ cardSet, cardRows }`, `decode_cards` returns `{ plan }`. Confirmed by the user. | [decision] |
| Custom profile errors | A custom-profile field that is missing or has the wrong type is `ARGUMENT_INVALID` with the path `profile.<field>` (9.2, 9.4). A well-typed but invalid value is the Engine's `PROFILE_INVALID` (8.6). Confirmed by the user. | [decision] |
| Extra arguments | Only `auto_fix` rejects extra arguments (5.6). The other tools ignore them. Confirmed by the user. | [decision] |
| Unknown tool name | An unknown tool name returns a `TOOL_UNKNOWN` Tool_Error (1.5). Confirmed by the user. | [decision] |
| `zod` dependency | `zod` is not a direct dependency of `packages/mcp` unless MCP code imports it; the SDK depends on it. 13.4 applies only to entries that are in `dependencies`. | [decision] |
| Argument validation scope | Argument checks cover presence, JSON type and key format only. All domain checks stay in the Engine (9.8). Confirmed by the user. | [decision] |
