# Design Document: weave-mcp

Traces to `requirements.md`. Acceptance criteria are cited as `N.M` (criterion M of Requirement N). Correctness properties are cited as Property N.

## Overview

`@jacquard/mcp` is a stdio Model Context Protocol server with six read-only tools over `@jacquard/engine`: `list_profiles`, `build_lift_plan`, `check_floats`, `auto_fix`, `build_cards`, `decode_cards`. It checks that arguments have the right JSON shape, resolves the loom profile, calls one engine function, and returns the engine's output or error as canonical JSON. It holds no weaving logic. The card format has not been tested on a working loom, and the descriptions of `build_cards` and `decode_cards` say so (1.4).

```
stdin ──► StdioServerTransport (SDK) ──► Server (SDK, low-level)
                               │ tools/list ──► TOOL_DEFS (static)
                               │ tools/call ──► dispatch(name, args)
                               │                  1. checkArguments   (shape only, 9.x)
                               │                  2. resolveProfile   (defineProfile + validateProfile)
                               │                  3. one engine call
                               │                  4. ok  ──► toolResult(value)
                               │                     err ──► toolError(engineError)
                               │                  catch ──► INTERNAL_ERROR (8.3)
stdout ◄── StdioServerTransport ◄──┘   all logs ──► stderr (1.6)
```

### Research findings that shape the design

- **SDK 1.32.2 exists.** `npm view @modelcontextprotocol/sdk@1.32.2` returns that version (checked while writing this design). I installed it in a scratch folder and read its type declarations.
- **zod resolves without a direct dependency.** The SDK lists `zod ^3.25 || ^4.0` both in its `dependencies` and as a non-optional peer dependency. I checked this in a scratch folder outside the repo, with the repo's pnpm (12.16.1, default settings, no `.npmrc` in the repo): `pnpm add @modelcontextprotocol/sdk@1.32.2` in an empty package installed `zod@4.6.7` into the virtual store (`.pnpm/@modelcontextprotocol+sdk@1.32.2_zod@4.6.7`), and `import("@modelcontextprotocol/sdk/server/index.js")` and `import("@modelcontextprotocol/sdk/server/stdio.js")` both loaded under plain `node`. The scratch `node_modules` had no `zod` entry at its top level, only the SDK. So `packages/mcp` does not declare `zod`, and the server code does not import it (13.4 covers only declared dependencies). The resolved zod major version is decided by pnpm and recorded in `pnpm-lock.yaml`; the design does not pin it. A later task re-checks this in the real workspace (see Smoke tests); if `pnpm install` there reports an unmet or missing zod peer, the task stops and reports it to the user rather than adding `zod`.
- **The high-level `McpServer.registerTool` is the wrong layer.** It validates arguments against the tool's input schema before the handler runs and answers a failure with its own protocol error text. Requirements 9.1 to 9.7 need an `ARGUMENT_INVALID` result with fixed fields and the first malformed argument in declaration order. So the server uses the low-level `Server` class from `@modelcontextprotocol/sdk/server/index.js`, whose `tools/call` handler receives the raw arguments. Tool input schemas are hand-written JSON Schema objects in the `tools/list` answer. The SDK `Client` does not validate arguments against them, so a test can send any argument value.
- **Result envelope.** `CallToolResult` accepts `content`, `structuredContent` (a JSON object, not an array) and `isError`. `ToolAnnotations` has `readOnlyHint`. No `outputSchema` is declared, so the SDK `Client` does not validate `structuredContent` against a schema.
- **In-memory transport.** `@modelcontextprotocol/sdk/inMemory.js` exports `InMemoryTransport.createLinkedPair()`. It hands message objects across by reference, with no serialisation. Tests therefore pass the same argument objects the server sees, which makes the input-immutability check (10.5) a real check.
- **The stock stdio transport is used.** `StdioServerTransport` reports a malformed line to its `onerror` callback and writes nothing back. Requirement 1.7 no longer asks for an error reply: the server must keep running and write only complete protocol messages to stdout. `index.ts` sets `server.onerror` to a function that logs to stderr, so a malformed line leaves a diagnostic on stderr and nothing on stdout. Whether a later SDK version replies to a malformed line is left to the SDK (1.7), and no test asserts either behaviour.
- **The engine package is TypeScript source.** `packages/engine/package.json` has `main` and `exports` pointing at `./src/index.ts`. A plain `node packages/mcp/dist/index.js` cannot load that file from `node_modules`. The build therefore bundles the engine into `dist/index.js` with esbuild (details under Build).

### Mismatches between requirements and the engine (reported, not hidden)

1. **`cardRows` is per card.** The engine signature is `cardRows(card, profile)`. Requirement 6.1 and the Glossary define Card_Rows as an ordered list with one `cardRows(card, profile)` output per card, in card order. The `build_cards` result is `{ cardSet, cardRows }`, where `cardRows[i]` is `engine.cardRows(cardSet.cards[i], profile)`. The server makes one engine call per card, and no other computation.
2. **Violation list and structuredContent.** `structuredContent` must be an object. Requirements 4.1 and 4.2 say the tool returns "the Violation list". The result is `{ "violations": [...] }`. Likewise `auto_fix` returns `{ plan, flips }` (the engine's `AutoFixOutput`), `build_lift_plan` returns `{ plan, idleHooks, warnings }`, and `decode_cards` returns `{ plan }`. The engine value is unchanged inside the wrapper. This wrapper is the "Tool_Result envelope" of 10.1 and 10.4.
3. **Weave keys are strings at runtime.** The engine type is `Record<number, Weave>`, but a JSON object has string keys, and the engine reads `Object.keys` and ignores non-canonical keys silently (`validate.ts`, `assignedRegions`). Requirement 3.3 and 3.4 make the server reject a non-canonical key before the engine sees it, so the engine's silent ignore is never reached from the server. The server passes the parsed object through unchanged; there is no key conversion to get wrong.
4. **Argument shape versus engine robustness.** Several engine functions read fields without checking the container type: `validatePlan` reads `lifts.length`, and `decodeCards` reads `cards.length` and `card.punched.length`. A missing or wrongly typed container would throw a `TypeError`. The shape check (9.2) covers exactly these containers, so the engine is only called with objects and arrays where the engine expects them. Cell and element values stay unchecked (9.8) because the engine validates them (`DESIGN_CELL_INVALID`, `PLAN_INVALID` with `notBoolean`).
5. **Profile argument errors.** A custom profile without `hookCount` is an Argument_Error (9.4), not `PROFILE_INVALID`, although 8.6 says invalid fields give `PROFILE_INVALID`. The resolution: presence and JSON type of each declared profile field are Argument_Errors (path `profile.<field>`); values that have the right type but are invalid (`hookCount: 0`, `regionLimit: 9`, `holeMeans: "x"`) are `PROFILE_INVALID` from `validateProfile`. A profile string other than `"120"`, `"240"`, `"400"` is an Argument_Error (9.3), which is how 7.3 resolves its "or".
6. **Label tokens with more than one bracket.** The `cardFillOrder` comment of `PROFILE_400` contains `[sourced]` and later `[to verify]`. Requirement 2.3 now says the Label_Table holds the least certain token, in the order `[to verify]` < `[decision]` < `[convention]` < `[sourced]`. So `PROFILE_400.cardFillOrder` is `[to verify]`. The Label_Table test extracts every bracketed token from the field's comment and takes the least certain.
7. **Unexpected arguments.** Only `auto_fix` rejects unexpected arguments (5.6). The other tools ignore extra arguments, because 9.8 limits argument checks to presence, JSON type and key format. Extra properties inside a custom profile object are also ignored, as the engine ignores them.
8. **Unknown tool name.** Requirement 1.5 allows a Tool_Error or a protocol error. The design uses a Tool_Error with code `TOOL_UNKNOWN` and a message that contains the name exactly as sent.
9. **Undefined values.** `JSON.stringify` drops object members whose value is `undefined`. No engine output or error field is `undefined` for inputs that reach the engine through JSON (the only optional fields, `PLAN_INVALID.pick` and `.hook`, are left out by the engine constructor), so "every field unchanged" holds. The Canonical_JSON function follows the same rule and says so.

## Architecture

### Package layout

```
packages/mcp/
├── package.json            "@jacquard/mcp", type module, private, bin-less; scripts below
├── tsconfig.json           src only; strict; lib ES2022; types ["node"]
├── tsconfig.test.json      src + test; adds vitest types
├── vitest.config.ts
├── build.mjs               esbuild bundle script (dev-time tool, not shipped code)
├── src/
│   ├── index.ts            entry: createServer(realEngine), connect StdioServerTransport, log to stderr
│   ├── server.ts           createServer(engine): registers tools/list and tools/call
│   ├── engine-api.ts       the EngineApi interface and realEngine (the only value import of @jacquard/engine, plus types)
│   ├── tools.ts            TOOL_DEFS: name, description, JSON Schema, annotations, argument spec
│   ├── arguments.ts        checkArguments(spec, args): Argument_Error or checked args
│   ├── profile.ts          resolveProfile(argument): profile or tool error
│   ├── handlers.ts         the six handlers; each calls one engine function
│   ├── labels.ts           Label_Table (data only)
│   ├── canonical-json.ts   canonicalJson(value): string
│   └── results.ts          toolResult(), toolError(), argumentError(), internalError()
├── test/
│   ├── arbitraries.ts      mcp-local fast-check generators (public engine API only)
│   ├── harness.ts          connect(engineOverride?) → { client, close }
│   ├── *.test.ts           example tests
│   └── *.property.test.ts  property tests
└── dist/                   build output (git-ignored): index.js
```

Scripts:

| Script | Command | Note |
|---|---|---|
| `build` | `node build.mjs` | esbuild bundle, exits non-zero on failure |
| `pretest` | `pnpm run build` | 13.8: tests always run against a fresh build |
| `test` | `vitest --run` | |
| `typecheck` | `tsc -p tsconfig.json && tsc -p tsconfig.test.json` | 13.5 |

Dependencies (13.4), all exact:

```json
"dependencies": {
  "@jacquard/engine": "workspace:*",
  "@modelcontextprotocol/sdk": "1.32.2"
},
"devDependencies": { "esbuild": "0.28.2", "fast-check": "...", "typescript": "...", "vitest": "...", "@types/node": "..." }
```

`@jacquard/engine` is the only non-exact entry and uses the workspace protocol (13.1). The dev dependency versions follow the engine package so the workspace has one version of each tool. The engine `package.json` is not touched, so its `dependencies` field stays absent (13.2). Only the SDK is a runtime dependency besides the engine; this design adds no other. `zod` is not declared, because no mcp code imports it and pnpm resolves it for the SDK (see Research findings).

### Dependency direction and import rule

`@jacquard/mcp` imports the engine only through `@jacquard/engine` (13.3). No file under `src` or `test` imports a path containing `@jacquard/engine/` or `engine/src`. `engine-api.ts` is the single place that imports engine values; every other module receives the engine through the `EngineApi` object. A smoke test scans `src` and `test` for forbidden import paths.

### Build and entry point

`build.mjs` calls esbuild with `bundle: true`, `platform: "node"`, `format: "esm"`, `target: "node22"`, `entryPoints: ["src/index.ts"]`, `outfile: "dist/index.js"`, `external: ["@modelcontextprotocol/sdk", "@modelcontextprotocol/sdk/*"]`. This inlines the engine source, so `dist/index.js` runs under plain `node`. The bundle contains engine code, but the MCP source still imports the engine only through its package specifier. `pnpm -r typecheck` for the mcp package type-checks the engine source as part of the program, because the engine's `types` field points at `./src/index.ts`; the mcp tsconfig therefore uses the same strict options as the engine. A client launches the server with `node packages/mcp/dist/index.js`, relative to the workspace root (13.7, 14.1).

### Stdout discipline (1.2, 1.6)

Only the SDK's `StdioServerTransport` writes to stdout, one complete JSON-RPC message plus `\n` per write. `src` contains no `console.log`, `console.info`, `console.debug` or any `process.stdout` use. Diagnostics, including the `server.onerror` callback, use `console.error`. A smoke test scans `src` for these names.

### Purity at call time (11.3, 12.1 to 12.3)

`src` does not use `Date`, `Math.random`, `process.env`, `Intl`, `toLocale*`, `fs`, `net`, `http` or `fetch`. The SDK's `StdioServerTransport` reads stdin and writes stdout, which is the server's own transport (12.2 excludes it). A smoke test scans `src` for these names. The engine itself is already deterministic.

## Components and Interfaces

### EngineApi (the injection seam)

```ts
// engine-api.ts
import { buildLiftPlan, checkFloats, autoFix, buildCards, cardRows, decodeCards,
         defineProfile, validateProfile, PROFILE_120, PROFILE_240, PROFILE_400 } from "@jacquard/engine";

export interface EngineApi {
  readonly profiles: readonly [LoomProfile, LoomProfile, LoomProfile];
  defineProfile: typeof defineProfile;
  validateProfile: typeof validateProfile;
  buildLiftPlan: typeof buildLiftPlan;
  checkFloats: typeof checkFloats;
  autoFix: typeof autoFix;
  buildCards: typeof buildCards;
  cardRows: typeof cardRows;
  decodeCards: typeof decodeCards;
}
export const realEngine: EngineApi = { /* the imports above */ };
```

`createServer(engine: EngineApi)` is the only way the tests replace the engine. They use it for three things: a spy that records the arguments the engine received (3.4, 9.x "engine not called"), a throwing engine (8.3, 8.4), and a stub that returns `AUTOFIX_FAILED` (5.3), which the real engine reaches only on rare inputs. All other tests use `realEngine`.

### Tool definitions (`tools.ts`)

Each entry is `{ name, description, inputSchema, annotations: { readOnlyHint: true }, args: ArgSpec[] }`. `inputSchema` is a JSON Schema object (`type: "object"`, `properties`, `required`). `args` is the same information as an ordered list used by `checkArguments`. Both come from one declaration so they cannot disagree. The order of `args` is the declaration order that 9.7 uses.

| Tool | Arguments, in declaration order |
|---|---|
| `list_profiles` | none |
| `build_lift_plan` | `design` (array of arrays), `weaves` (object with canonical-integer keys, each value an object), `profile` (Profile_Argument), `repeatAcross` (boolean, optional) |
| `check_floats` | `plan` (LiftPlan), `profile` |
| `auto_fix` | `plan`, `profile` |
| `build_cards` | `plan`, `profile` |
| `decode_cards` | `cardSet` (CardSet), `profile` |

Argument names are `design`, `weaves`, `profile`, `repeatAcross`, `plan`, `cardSet`. The requirements call the weave assignment `weaves` (3.4, 9.5) and name the others by role; these names fix them. Each description is at most 1000 characters. `build_cards` and `decode_cards` descriptions contain the sentence "The card format has not been tested on a working loom." (1.4).

### Argument checking (`arguments.ts`)

`checkArguments(spec, args)` runs in declaration order and returns the first `ArgumentError` or `undefined`. For each argument it checks, in this order: absent or `null` (9.1); JSON type of the value (9.2); then the extra checks below. Checks never look inside values beyond what is listed, so domain checks stay in the engine (9.8).

| Argument type | Checks |
|---|---|
| `design` | array; each row is an array (path `design[i]`). Cell values are not checked. |
| `weaves` | plain object (not array); each key matches `/^(0\|[1-9][0-9]*)$/` (9.5, 3.3, 3.4), reported as `weaves` with the key quoted in the message; each value is an object. Weave parameters are not checked. |
| `profile` | string, or plain object. A string must be `"120"`, `"240"` or `"400"` (9.3). An object must have `hookCount` (9.4). Declared fields have these JSON types: `hookCount`, `hooksPerCardRow`, `spareHookCount`, `maxFloat`, `maxWarpFloat`, `maxWeftFloat`, `regionLimit` number; `spareHookPlacement`, `holeMeans`, `cardFillOrder` string; `wovenFaceDown` boolean. A present field of the wrong type is reported as `profile.<field>`. `null` for an optional field counts as the wrong type. |
| `repeatAcross` | boolean, optional; absent means `false` (3.2). |
| `plan` | object with `pickCount`, `hookCount`, `designWidth` numbers, `repeatAcross` boolean, `lifts` array of arrays (path `plan.lifts[i]`). Elements of rows are not checked. |
| `cardSet` | object with `designWidth` number, `repeatAcross` boolean, `cards` array of objects, each with `index` number, `number` number, `punched` array (path `cardSet.cards[i].punched`). |

For `auto_fix` any key of the arguments object other than `plan` and `profile` is reported after the declared arguments are checked (5.6, `argument` is the key). A Profile_Argument that is a string is reported with `argument: "profile"`; the message lists `"120"`, `"240"` and `"400"`.

The Argument_Error has exactly the fields `code: "ARGUMENT_INVALID"`, `argument` and `message` (9.6). Messages are built from the argument path and the expected type only, so they are deterministic.

### Profile resolution (`profile.ts`)

`resolveProfile(profileArgument, engine)`:

1. string `"120"`, `"240"`, `"400"`: return `engine.profiles[0|1|2]`, the engine's frozen profile, unmodified.
2. object: `engine.defineProfile(fields)` then `engine.validateProfile(defined)`. On `Err` the engine error is returned as the Tool_Error (`PROFILE_INVALID` with `field` and `value`, 8.6). The tool operation does not run.

Because `checkArguments` already checked field types, the engine only sees numbers, strings and booleans in the declared fields.

### Label_Table (`labels.ts`)

Data only. It is typed so a missing field is a compile error (2.4):

```ts
export type FieldLabel = "[convention]" | "[sourced]" | "[decision]" | "[to verify]";
export type ProfileLabels = { readonly [K in keyof LoomProfile]: FieldLabel };
export const LABEL_TABLE: { readonly "120": ProfileLabels; readonly "240": ProfileLabels; readonly "400": ProfileLabels } = { ... };
```

When a field's comment contains more than one bracketed token, the entry is the least certain of them, in the order `[to verify]` (least certain) < `[decision]` < `[convention]` < `[sourced]` (most certain) (2.3). `PROFILE_400.cardFillOrder` is therefore `[to verify]`.

The server never reads `profiles.ts` at runtime (12.3). Only the test reads `packages/engine/src/profiles.ts`, as text. For each field line inside the `PROFILE_120`, `PROFILE_240` and `PROFILE_400` object literals, it takes the part after `//`, extracts every bracketed label token, picks the least certain, and compares it with the Label_Table entry (Property 3). The test reads the file by a path built from the test file location, not from a package import, and lives in `test/`, so 13.3 is respected (the test reads text; it does not import).

### Canonical_JSON (`canonical-json.ts`)

This is serialisation, not weaving. `canonicalJson(value: unknown): string`:

- object: keys sorted ascending by UTF-16 code unit (default `Array.prototype.sort` comparison on strings), members whose value is `undefined` skipped, no whitespace: `{"a":1,"b":2}`;
- array: elements in order, `undefined` elements written as `null` (as `JSON.stringify` does);
- string: `JSON.stringify(string)`;
- number: `JSON.stringify(number)` (`"-0"` becomes `0`, non-finite becomes `null`); the text form does not depend on locale (11.7);
- boolean and `null`: as JSON.

Integer-like keys: a JavaScript object iterates integer-like keys in numeric order, so a parsed object cannot carry UTF-16 key order for such keys. Canonical_JSON works on the key list (`Object.keys` then sort) and builds the text, so the text order is right regardless. No tool output has integer-keyed objects, and the byte-identity checks (11.1, 11.4) compare the text.

### Results (`results.ts`)

```ts
toolResult(value)   // { content: [{ type: "text", text: canonicalJson(value) }], structuredContent: JSON.parse(text) }
toolError(error)    // same, plus isError: true; error is any object with code and message
```

`structuredContent` is the parsed canonical text, so text and structure always agree. A success result sets no `isError` field, and the tests assert `isError !== true` for success and `isError === true` for every Tool_Error.

Result values per tool:

| Tool | structuredContent on success |
|---|---|
| `list_profiles` | `{ profiles: [{ name: "120", fields: { hookCount: { value, label }, ... } }, ...] }`, in order 120, 240, 400, 11 fields each |
| `build_lift_plan` | `{ plan, idleHooks, warnings }` (engine `BuildOutput`) |
| `check_floats` | `{ violations }` |
| `auto_fix` | `{ plan, flips }` (engine `AutoFixOutput`) |
| `build_cards` | `{ cardSet, cardRows }`, `cardRows[i]` is `engine.cardRows(cardSet.cards[i], profile)` |
| `decode_cards` | `{ plan }` |

On failure the Tool_Error content is the engine error object itself (all fields, including `AUTOFIX_FAILED.remaining`, `PROFILE_INVALID.value`, `PLAN_INVALID.pick`), serialised by Canonical_JSON, with no field added, dropped or renamed (8.1, 10.2). An Argument_Error is `{ code, argument, message }`. `INTERNAL_ERROR` is `{ code: "INTERNAL_ERROR", message: "Internal error." }`: a fixed message, no stack, no path, no thrown text (8.3, 8.4, 11.6). The thrown value is logged to stderr only.

### Handlers and dispatch (`handlers.ts`, `server.ts`)

```ts
async function callTool(name, args): Promise<CallToolResult> {
  const tool = TOOL_DEFS.find(t => t.name === name);
  if (!tool) return toolError({ code: "TOOL_UNKNOWN", message: `Unknown tool: ${name}` });  // 1.5
  try {
    const checked = checkArguments(tool.args, args);            // Argument_Error first, engine untouched
    if (checked) return toolError(checked);
    return await tool.handler(args, engine);                    // returns toolResult or toolError
  } catch (e) {
    console.error(describe(e));                                 // stderr only
    return toolError({ code: "INTERNAL_ERROR", message: "Internal error." });  // 8.3
  }
}
```

A handler does: resolve profile, call exactly one engine function (plus `cardRows` in `build_cards`), and map the `EngineResult`. Handlers copy nothing and pass the argument objects straight to the engine. The engine does not mutate its inputs (engine Property 32), and the tests check this again at the protocol level (Property 15). The handler never throws for expected failures; it returns Tool_Errors (8.2). Only unexpected exceptions reach `catch`. After any failure the next call is independent, because no handler stores state (8.5, 11.2): handlers are functions of `(args, engine)` and the server keeps no per-connection data.

`tools/list` returns `TOOL_DEFS` mapped to `{ name, description, inputSchema, annotations }` in the table order (1.1, 12.5).

### Transport (`index.ts`)

The entry point connects the server to the SDK's `StdioServerTransport` from `@modelcontextprotocol/sdk/server/stdio.js`. The package has no transport code of its own. `index.ts` sets `server.onerror = (e) => console.error(describe(e))`, so transport and protocol errors, including a malformed stdin line, go to stderr only. The server keeps running after such a line and writes nothing to stdout except complete protocol messages (1.6, 1.7). Whether the SDK also sends an error reply is left to the SDK and is not tested.

## Data Models

All shapes below are JSON. Engine types (`Design`, `Weave`, `WeaveAssignment`, `LoomProfile`, `LiftPlan`, `Card`, `CardSet`, `Violation`, `Flip`, `Warning`, `BuildOutput`, `AutoFixOutput`) come from `@jacquard/engine` unchanged.

```ts
type ProfileArgument = "120" | "240" | "400" | ProfileFields;   // ProfileFields from the engine

interface ArgumentError { code: "ARGUMENT_INVALID"; argument: string; message: string }   // 9.6
interface UnknownToolError { code: "TOOL_UNKNOWN"; message: string }
interface InternalError { code: "INTERNAL_ERROR"; message: "Internal error." }
type ToolErrorBody = ArgumentError | UnknownToolError | InternalError | EngineError;

interface ProfileListing {
  profiles: { name: "120" | "240" | "400";
              fields: { [K in keyof LoomProfile]: { value: LoomProfile[K]; label: FieldLabel } } }[];
}
interface BuildCardsResult { cardSet: CardSet; cardRows: (boolean | null)[][][] }   // cardRows[cardIndex][row][slot]
```

`ProfileListing.profiles[i].fields` has one entry per `LoomProfile` field (11 today). The test derives the field count from the label table and from the engine profile object, not from a literal.

Tool call arguments, by name: `design: number[][]`, `weaves: { [region: string]: Weave }`, `profile: ProfileArgument`, `repeatAcross?: boolean`, `plan: LiftPlan`, `cardSet: CardSet`.


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

Every property is checked through a real in-process MCP connection (see Testing Strategy). "The server" below means a `createServer(realEngine)` connected to an SDK `Client`, unless a property names an injected engine. "Direct engine call" means the test calls the public engine function itself and serialises with `canonicalJson`. Properties 1 and 3 range over a fixed finite set (the six tools, the profile fields in `profiles.ts`), so their test has no random generator; it still runs once per member of the set.

### Property 1: Tool list

For every tool in the `tools/list` answer, the name is one of the six names, the six names appear exactly once each in the order `list_profiles`, `build_lift_plan`, `check_floats`, `auto_fix`, `build_cards`, `decode_cards`, the description is non-empty and at most 1000 characters, the input schema is an object schema, `annotations.readOnlyHint` is `true`, and the descriptions of `build_cards` and `decode_cards` contain the sentence stating that the card format has not been tested on a working loom.

**Validates: Requirements 1.1, 1.3, 1.4, 12.5**

### Property 2: list_profiles content

For any call of `list_profiles` (with no arguments, or with an empty object), the result lists exactly three profiles named `120`, `240`, `400` in that order, each field value equals the value in the engine's `PROFILE_120`, `PROFILE_240`, `PROFILE_400`, each profile has one `{ value, label }` pair for every key of the engine profile object, and no label is empty or missing.

**Validates: Requirements 2.1, 2.2, 2.4, 2.5**

### Property 3: Label_Table agrees with profiles.ts

For every built-in profile and every field of that profile, the Label_Table entry equals the least certain of all bracketed label tokens in the comment on the field's line inside that profile's object literal in the text of `packages/engine/src/profiles.ts`, using the order `[to verify]` (least certain) < `[decision]` < `[convention]` < `[sourced]` (most certain), and every field line in those literals has at least one token. In particular `PROFILE_400.cardFillOrder`, whose comment holds `[sourced]` and `[to verify]`, is `[to verify]`. Only the bracketed token is compared, not the rest of the comment.

**Validates: Requirements 2.3**

### Property 4: Canonical_JSON is ordered and independent of key order

For any JSON value, `canonicalJson` of the value equals `canonicalJson` of any copy whose object keys were inserted in a different order at any depth; the output contains no whitespace outside string literals; object keys appear in ascending UTF-16 code unit order at every depth; array elements appear in their original order; and a number has the same text on every call.

**Validates: Requirements 11.4, 11.5, 11.7**

### Property 5: Canonical_JSON round trip and idempotence

For any JSON value `v`, `JSON.parse(canonicalJson(v))` is deeply equal to `v` (with `undefined` members dropped as JSON does), and `canonicalJson(JSON.parse(canonicalJson(v)))` equals `canonicalJson(v)`.

**Validates: Requirements 11.4**

### Property 6: Result envelope

For any tool call, success or failure, `client.callTool` resolves (it does not reject), `isError` is `true` exactly when the result is a Tool_Error, `content` holds one text item, and that text equals `canonicalJson` of `structuredContent`.

**Validates: Requirements 8.2, 11.4**

### Property 7: Fidelity to the engine

For any tool among `build_lift_plan`, `check_floats`, `auto_fix`, `build_cards` and `decode_cards`, and any valid input (generated through the engine's public API, with a built-in or a valid custom profile, and `repeatAcross` absent, `true` or `false`), the Canonical_JSON of the server's `structuredContent` equals the Canonical_JSON of the direct engine output placed in the tool's wrapper (`{ plan, idleHooks, warnings }`, `{ violations }`, `{ plan, flips }`, `{ cardSet, cardRows }` with `cardRows[i] = cardRows(cardSet.cards[i], profile)`, `{ plan }`), with no field added, dropped or altered. A call with `repeatAcross` omitted equals a direct call with `false`. A result with zero violations or zero flips is a success.

**Validates: Requirements 3.1, 3.2, 4.1, 4.2, 5.1, 5.2, 6.1, 7.1, 10.1, 10.4**

### Property 8: build_cards numbering

For any valid lift plan and profile, `build_cards` returns exactly `plan.pickCount` cards, card `i` (0-based) has `number` `i + 1` and corresponds to pick `i`, and `cardRows` is an ordered list with exactly one entry per card, in card order.

**Validates: Requirements 6.2, 6.3**

### Property 9: Round trip through the server

For any valid lift plan and profile, calling `build_cards` and then `decode_cards` with the returned `cardSet` and the same profile returns a plan deeply equal to the original plan.

**Validates: Requirements 7.5**

### Property 10: Engine errors come back unchanged

For any input that passes argument checking and for which the direct engine call returns an error (a design with an invalid cell, unequal rows, too many regions or a missing weave; a custom profile with a well-typed but invalid field; a corrupted lift plan; a corrupted card set with a duplicate number, a missing number, a wrong size, a lifted spare or idle position, or no cards), the server result has `isError` `true`, its `structuredContent` equals the engine error object with every field name and value unchanged (including `code`, `message`, and `field` and `value` for `PROFILE_INVALID`), it contains no plan, violation list, card set or card rows, and a spy engine shows that the requested tool operation was not run when the profile was invalid. The error is never an `ARGUMENT_INVALID` error.

**Validates: Requirements 3.6, 4.3, 5.4, 6.5, 7.2, 7.3, 8.1, 8.6, 9.8, 10.2**

### Property 11: The server keeps answering correctly after failures

For any sequence of tool calls that mixes valid calls, calls with invalid arguments, calls that return engine errors, and calls to unknown tool names, on one connection, each call returns the same Canonical_JSON result as the same call made alone on a fresh connection, and an unknown-name error message contains the name exactly as sent.

**Validates: Requirements 1.5, 8.5, 11.2**

### Property 12: The first malformed argument is the one reported

For any tool with arguments, and any non-empty set of corruptions applied to a valid call (remove the argument, set it to `null`, or give it a wrong JSON type), the result is a Tool_Error with exactly the fields `code` (`"ARGUMENT_INVALID"`), `argument` and `message`, `argument` is the name of the corrupted argument that comes first in the tool's declared order, `message` is non-empty and contains that name, and a spy engine shows that no engine function was called.

**Validates: Requirements 3.5, 4.4, 7.4, 9.1, 9.2, 9.6, 9.7**

### Property 13: Weave key handling

For any weave assignment whose keys are all canonical decimal text of non-negative integers, the engine receives (observed by a spy) an object with the same keys mapped to the same weaves, one entry per key. For any assignment that contains at least one key that is not canonical decimal text (a sign, a leading zero, a decimal point, whitespace, a letter, or the empty string), the server returns an `ARGUMENT_INVALID` error whose `argument` is `weaves` and whose message contains the offending key (the first one in `Object.keys` order), no engine function is called, and the call changes no state.

**Validates: Requirements 3.3, 3.4, 9.5**

### Property 14: Determinism

For any tool call, valid or not, making the same call twice, on one connection and on two separately created servers, gives byte-identical `content[0].text`, and the text of an error result contains no timestamp, stack trace, absolute path or process identifier.

**Validates: Requirements 2.6, 4.5, 6.4, 7.6, 11.1, 11.6, 12.4**

### Property 15: Arguments are never modified

For any tool call, valid or not, the argument object after the call is deeply equal to a `structuredClone` taken before the call.

**Validates: Requirements 4.3, 5.4, 6.5, 7.2, 10.5**

### Property 16: Unexpected exceptions become INTERNAL_ERROR

For any value thrown by an injected engine function (an `Error` with any message and stack, including text that looks like a file path, a string, or an object), the call returns a Tool_Error with `isError` `true` and `structuredContent` equal to `{ code: "INTERNAL_ERROR", message: "Internal error." }`, the text contains no part of the thrown message or stack and no path, and the next call on the same connection is answered normally.

**Validates: Requirements 8.3, 8.4, 11.6**

## Error Handling

| Situation | Result | Source |
|---|---|---|
| Argument missing, `null`, wrong JSON type, bad profile string, missing `hookCount`, bad weave key, extra `auto_fix` argument | `ARGUMENT_INVALID` `{ code, argument, message }`, `isError: true`, no engine call | 9.1 to 9.7, 5.6 |
| Engine returns an `EngineError` (including `PROFILE_INVALID` and `AUTOFIX_FAILED`) | the engine error object, all fields unchanged, `isError: true` | 8.1, 8.6, 10.2 |
| Unknown tool name | `TOOL_UNKNOWN` `{ code, message }` with the name in the message, `isError: true` | 1.5 |
| Exception in a handler or the engine | `INTERNAL_ERROR` with the fixed message; the exception goes to stderr | 8.3, 8.4 |
| Line on stdin that is not valid MCP protocol input | The SDK transport reports it to `server.onerror`, which logs to stderr. The server keeps running and writes only complete protocol messages to stdout. Any error reply is left to the SDK. | 1.7 |
| Method other than `initialize`, `tools/list`, `tools/call`, ping | SDK default `MethodNotFound` protocol error | 1.7 |

Tool_Errors are ordinary results, never thrown (8.2). Argument checking runs before profile resolution, which runs before the engine call, so the order of failures is: Argument_Error, then `PROFILE_INVALID`, then the engine's own validation order. The server stores no state between calls, so no failure changes the next answer (8.5, 11.2).

## Testing Strategy

### Test approach: every server test goes through a real MCP connection

This is the rule for the whole package. Each server test builds a `createServer(engine)` server, connects it to an SDK `Client` over `InMemoryTransport.createLinkedPair()`, and drives it with `client.listTools()` and `client.callTool({ name, arguments })`. Tests never import or call a handler, `checkArguments`, `resolveProfile` or `callTool` directly. This way the protocol layer is part of what is tested: request routing, the `tools/list` answer, the result envelope, `isError` and `structuredContent`. `test/harness.ts` exports `connect(engine = realEngine)` returning `{ client, close }`; each property creates one connection per test case or per run, as the property needs.

Pure-function modules with no protocol content are the only exceptions: `canonicalJson` (Properties 4 and 5) and `LABEL_TABLE` (Property 3) are tested as plain functions and data, because they have no tool-call surface. Their output is still checked at the protocol level by Properties 6 and 14.

### Property tests

- Library: fast-check, as in the engine package. Runner: vitest, run once with `pnpm vitest --run`, never in watch mode.
- Minimum 100 runs per property (`numRuns: 100`); Property 7 uses `numRuns: 300` because it covers five tools. Properties 1 and 3 have no generator and run once per member of their fixed set.
- Each property is one test, named in `test/<name>.property.test.ts`, with a comment tag in this format: `Feature: weave-mcp, Property N: <title>`.
- Seeds: the default fast-check seed is random, so every property test sets `{ seed, numRuns }` from a constant at the top of the file and also prints the seed and the shrunk counterexample on failure (fast-check's `verbose: 1`, and a vitest message that includes `seed` and `path`). A failure is reproduced by copying the printed seed and path into `fc.assert`'s `seed` and `path`. The journey log rule requires recording property number, shrunk counterexample, seed and requirement for every failure.
- Model for fidelity (Property 7), errors (Property 10), round trip (Property 9): the test calls the public engine function directly and compares `canonicalJson` of both sides. The model never calls anything from `packages/mcp/src` except `canonicalJson` for the comparison. Properties 4 and 5 test `canonicalJson` itself against `JSON.parse` and key permutation, not against itself.
- Arbitraries (`test/arbitraries.ts`) are local to `packages/mcp`. They build designs, weave assignments and profiles with fast-check and call `buildLiftPlan`, `autoFix`, `buildCards` and `defineProfile` from `@jacquard/engine` to get valid lift plans and card sets. They do not import engine `src` or engine `test` files (13.3). Design sizes are small (up to about 12 ends by 12 picks, at most 4 regions, with a custom profile whose `hookCount` is at least the width) so that 100 to 300 runs stay fast; one arbitrary generates a design wide enough to need `repeatAcross`. A second family of arbitraries corrupts a valid input in one way per engine error code (Property 10) and one way per argument (Property 12). The engine's float limits are lowered in custom profiles (`maxFloat` 2 to 4) so that generated plans often contain violations and `auto_fix` has work to do; clean plans appear through `autoFix` itself.
- Immutability (Property 15): `const before = structuredClone(args); await client.callTool({ name, arguments: args }); expect(args).toEqual(before)`. Because `InMemoryTransport` passes objects by reference, the server operates on the same objects, so a mutation inside the server or the engine would be visible.
- Injected engines (Properties 10, 12, 13, 16): `createServer` takes an `EngineApi`. The spy engine wraps `realEngine` and records the call and argument references. The throwing engine replaces one function with `() => { throw value }`. The stub for `AUTOFIX_FAILED` returns `err(autofixFailed(...))` built by the test.

### Protocol-level example tests

Run through the in-memory client unless noted:

- Unknown tool name (1.5): `callTool({ name: "nope" })` returns a Tool_Error whose message contains `nope`; the next valid call works.
- Invalid arguments: calls with `arguments` omitted entirely, `arguments: null`-like shapes the SDK allows, and arrays instead of objects each return `ARGUMENT_INVALID`.
- `list_profiles` called with no `arguments` field (2.5).
- `auto_fix` with an extra argument (5.6), with `maxIterations` as the example, and a spy check that `autoFix` is called with the plan and profile only (5.5).
- Profile string `"360"` lists `"120"`, `"240"`, `"400"` (9.3); profile object without `hookCount` names `profile.hookCount` (9.4).
- `AUTOFIX_FAILED` via the stub engine: `reason`, `maxIterations` and `remaining` preserved exactly (5.3).

### Process-level tests (the only tests that do not use the in-memory transport)

A single test file, `test/process.test.ts`, spawns `node packages/mcp/dist/index.js` with `child_process.spawn`, with the workspace root as the working directory (the path is relative, 13.7). It checks:

1. initialize handshake: send an `initialize` request and the `initialized` notification, and receive the response within 5 seconds (13.7, 1.2);
2. stdout cleanliness: after `tools/list` and a `tools/call` of each tool, every line on stdout parses as JSON and has `jsonrpc: "2.0"`, and no other bytes appear (1.6);
3. malformed input (1.7): write a line that is not JSON and a line that is JSON but not JSON-RPC to stdin. The test then checks that the process is still running (it has not exited) and that a valid `tools/list` request sent afterwards gets its answer. Every line on stdout, whatever the SDK chooses to write, is a complete JSON-RPC message (it parses as JSON and has `jsonrpc: "2.0"`). The test does not assert that an error reply to the malformed line exists, does not assert its content, and does not assert that none exists, because that is left to the SDK;
4. two processes started from the same build, given the same sequence of requests, write byte-identical stdout (11.1, process part).

Because `pretest` builds first (13.8), these tests always run against a fresh `dist/index.js`. They use no timers beyond the 5-second bound and close the child on completion.

### Smoke tests

One file, `test/package.test.ts`, reads files and checks them as text or JSON: `package.json` pins (13.1, 13.4, 13.5, 13.8, 14.9), engine `package.json` has no `dependencies` and no `@jacquard/mcp` entry (13.2), no import path containing `@jacquard/engine/` or `engine/src` in `src` and `test` (13.3), the static scans of `src` for forbidden names (1.6, 11.3, 12.1 to 12.3, 10.3), the lockfile records `1.32.2`, `packages/mcp/package.json` does not list `zod` under `dependencies` and no file under `src` or `test` imports `zod`, the real workspace `pnpm install` resolves the SDK's `zod` without a missing or unmet peer warning (the task reads the install output and stops and reports to the user if there is one, without adding `zod`), and, in the final task, `.kiro/settings/mcp.json` and the two agent files (14.1 to 14.3, 14.5, 14.7, 14.8). The test that reads `profiles.ts` as text is the only test that touches an engine source file, and it only reads.

### Not automated

- 14.4 (`weave-auditor` behaviour) and 14.6 (`design-reviewer` behaviour) are manual checks in the final task. They are not properties and not automated tests.
- 14.10 is a step of the final task: the report states `1.32.2`.
- 13.6 is checked by the task with `git diff --stat packages/engine/test/fixtures`, not by a vitest test. The engine's golden fixtures are read-only and are not touched by any mcp test or arbitrary.
- 1.5, 1.7 and the unknown-name and malformed-line cases are examples, not properties, apart from the sequences inside Property 11. No test or property asserts a protocol error reply to a malformed stdin line.

### Robustness fuzz (not a numbered property)

One extra test sends arguments built from `fc.jsonValue()` to every tool and asserts that no result is `INTERNAL_ERROR` and no call rejects. A failure means the engine throws on input that passes the shape check, or the shape check misses a container the engine reads. It does not trace to a numbered criterion, so it carries no property number. A failure is reported as an engine bug or a missing shape check, not hidden by catching the exception.

### Test run

Per the workspace rules: `pnpm vitest --run` for tests, with `; echo "EXIT_CODE=$?"` appended, and success is `EXIT_CODE=0` plus a summary line with a non-zero passed count and no failures. Each spec task ends with `pnpm typecheck` and `pnpm test`.
