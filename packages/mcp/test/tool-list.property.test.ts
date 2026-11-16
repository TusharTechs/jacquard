// Feature: weave-mcp, Property 1: Tool list
// Validates: Requirements 1.1, 1.3, 1.4, 12.5
// The set of tools is fixed and finite, so the property runs once per tool with no generator.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { connect } from "./harness.js";
import type { Connection } from "./harness.js";
import { TOOL_NAMES } from "./arbitraries.js";

const UNTESTED = "The card format has not been tested on a working loom.";

let connection: Connection;
let tools: Tool[];

beforeAll(async () => {
  connection = await connect();
  tools = (await connection.client.listTools()).tools;
});
afterAll(async () => {
  await connection.close();
});

describe("Feature: weave-mcp, Property 1: Tool list", () => {
  it("lists exactly the six tools, once each, in order", () => {
    expect(tools.map((tool) => tool.name)).toEqual([...TOOL_NAMES]);
  });

  it.each(TOOL_NAMES.map((name, index) => ({ name, index })))(
    "$name has a description, an object schema and readOnlyHint true",
    ({ name, index }) => {
      const tool = tools[index] as Tool;
      expect(tool.name).toBe(name);
      expect(typeof tool.description).toBe("string");
      expect((tool.description as string).length).toBeGreaterThan(0);
      expect((tool.description as string).length).toBeLessThanOrEqual(1000);
      expect(tool.inputSchema.type).toBe("object");
      expect(typeof tool.inputSchema).toBe("object");
      expect(tool.annotations?.readOnlyHint).toBe(true);
      const required = (tool.inputSchema as { required?: unknown }).required;
      if (required !== undefined) {
        expect(Array.isArray(required)).toBe(true);
        for (const key of required as string[]) {
          expect(Object.keys(tool.inputSchema.properties ?? {})).toContain(key);
        }
      }
      if (name === "build_cards" || name === "decode_cards") {
        expect(tool.description).toContain(UNTESTED);
      }
    },
  );
});
