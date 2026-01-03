#!/usr/bin/env bun
import { DEFAULT_PORT } from "opencode-web-blocker-shared";
import { startServer } from "./server";

const HELP = `
opencode-web-blocker - Block distracting websites when OpenCode is idle

Usage:
  bunx @opencode-web-blocker/server [options]

Options:
  --help, -h     Show this help message
  --port, -p     Port to run on (default: ${DEFAULT_PORT}, or PORT env var)

The server:
  - Receives hooks from the OpenCode plugin when sessions start/stop
  - Broadcasts state changes via WebSocket to the Chrome extension
  - Blocks configured sites when no OpenCode session is actively working

Endpoints:
  GET  /status   Current blocking state (JSON)
  POST /hook     Receive OpenCode plugin events
  WS   /ws       WebSocket for Chrome extension
`.trim();

const args = process.argv.slice(2);

if (args.includes("--help") || args.includes("-h")) {
  console.log(HELP);
  process.exit(0);
}

let port = DEFAULT_PORT;
const portIndex = args.findIndex((arg) => arg === "--port" || arg === "-p");
if (portIndex !== -1 && args[portIndex + 1]) {
  port = parseInt(args[portIndex + 1]!, 10);
}
if (process.env.PORT) {
  port = parseInt(process.env.PORT, 10);
}

const server = startServer(port);
console.log(`opencode-web-blocker server running on http://localhost:${server.port}`);
