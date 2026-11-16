// Stdio entry point (1.2, 1.6, 1.7). Only the SDK's StdioServerTransport writes to stdout; every
// diagnostic goes to stderr through console.error.
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { realEngine } from "./engine-api.js";
import { createServer, describeThrown } from "./server.js";

const server = createServer(realEngine);
server.onerror = (error) => {
  console.error(`[jacquard-weave] ${describeThrown(error)}`);
};

try {
  await server.connect(new StdioServerTransport());
} catch (error) {
  console.error(`[jacquard-weave] failed to start: ${describeThrown(error)}`);
  process.exitCode = 1;
}
