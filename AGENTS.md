# AGENTS.md

Agent instructions for the opencode-block repository.

## Project Overview

Bun-based monorepo that blocks distracting websites when OpenCode is idle. Four packages:
- `packages/shared` - Shared TypeScript types and constants
- `packages/server` - Bun WebSocket server
- `packages/opencode-plugin` - OpenCode plugin hooks
- `packages/chrome-extension` - Chrome Manifest V3 extension

## Build, Run, and Check Commands

```bash
bun install                              # Install dependencies
bun run dev                              # Dev all packages
bun run dev --filter server              # Dev single package
bun run check                            # Type check all
bun run build                            # Build all (chrome-extension)
bun packages/server/index.ts             # Run file directly
bun --hot packages/server/index.ts       # With hot reload
bun test                                 # Run tests
bun test path/to/file.test.ts            # Single test
```

## Bun-First Development (CRITICAL)

**DO NOT** use Node.js, npm, pnpm, Vite, or Express. Use Bun equivalents:

| Instead of | Use |
|------------|-----|
| `node file.ts` | `bun file.ts` |
| `npm install` | `bun install` |
| `npm run script` | `bun run script` |
| `npx package` | `bunx package` |
| `jest/vitest` | `bun test` |
| `express` | `Bun.serve()` |
| `ws` | Built-in WebSocket |
| `dotenv` | Bun auto-loads .env |

## TypeScript Configuration

Strict mode with additional checks:
- `noUncheckedIndexedAccess: true` - Array/object access may be undefined
- `noImplicitOverride: true` - Require `override` keyword
- `verbatimModuleSyntax: true` - Use `import type` for types

### Import Style
```typescript
// Type-only imports MUST use `type` keyword
import type { HookPayload, Session } from "shared";
import { DEFAULT_PORT } from "shared";

// Mixed - separate the type imports
import type { ServerWebSocket } from "bun";
import { SessionState } from "./state";
```

## Code Style Guidelines

### Naming Conventions
| Element | Convention | Example |
|---------|------------|---------|
| Variables, functions | camelCase | `blockedDomains`, `handleHook` |
| Types, interfaces, classes | PascalCase | `Session`, `HookPayload` |
| Constants | SCREAMING_SNAKE_CASE | `DEFAULT_PORT` |

### Interface & Type Definitions
```typescript
export interface Session {
  id: string;
  status: "idle" | "working" | "waiting_for_input";
  cwd?: string;
  lastActivity: number;
}

export type ServerMessage =
  | { type: "state"; blocked: boolean; sessions: number }
  | { type: "pong" };
```

### Error Handling
Empty catch blocks acceptable for non-critical operations:
```typescript
try {
  await fetch(SERVER_URL, { method: "POST", body: JSON.stringify(payload) });
} catch {}
```

For critical operations, handle explicitly:
```typescript
try {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Failed");
} catch (error) {
  console.error("Critical operation failed:", error);
  throw error;
}
```

### Class Structure
```typescript
export class SessionState {
  private sessions = new Map<string, Session>();
  
  constructor() { /* init */ }
  
  // Public methods first
  subscribe(listener: Listener): () => void { }
  getPublicState() { }
  
  // Private methods after
  private updateSession(id: string, status: Session["status"]) { }
  
  // Cleanup last
  destroy() { }
}
```

## Package Dependencies

Workspace packages reference each other:
```json
{ "dependencies": { "shared": "workspace:*" } }
```

## Zero Dependencies Philosophy

Server uses ONLY Bun built-in APIs. Chrome extension has only `@types/chrome` as dev dependency.

## Architecture

```
OpenCode Plugin → HTTP POST → Bun Server ← WebSocket → Chrome Extension
```

## Common Patterns

### Bun.serve with WebSocket
```typescript
Bun.serve({
  port: process.env.PORT || DEFAULT_PORT,
  fetch(req, server) {
    if (url.pathname === "/ws") {
      if (server.upgrade(req)) return;
    }
    return new Response("Not found", { status: 404 });
  },
  websocket: {
    open(ws) { },
    message(ws, message) { },
    close(ws) { },
  },
});
```

### WebSocket Message Handling
```typescript
ws.onmessage = (event) => {
  try {
    const data = JSON.parse(event.data);
    if (data.type === "state") { /* handle */ }
  } catch {}
};
```

### Chrome Extension Messaging
```typescript
chrome.runtime.sendMessage({ type: "GET_STATE" }).then(handleState);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "STATE") { /* handle */ }
  return true; // for async sendResponse
});
```

## Chrome Extension Notes

- Manifest V3 with service worker
- Shadow DOM for content script isolation
- Storage sync for cross-device settings
- Exponential backoff reconnection for WebSocket
