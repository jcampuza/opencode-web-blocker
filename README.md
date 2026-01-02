# opencode web blocker

Block distracting websites unless [OpenCode](https://opencode.ai) is actively running inference.

**The premise is simple:** if OpenCode is working, you should be too. When OpenCode stops, your distractions come back.

## How It Works

```
┌─────────────────┐    events     ┌─────────────────┐    websocket    ┌─────────────────┐
│    OpenCode     │ ───────────► │  Blocker Server │ ◄─────────────► │ Chrome Extension│
│   (terminal)    │   (plugin)   │  (Bun.serve)    │                 │   (browser)     │
└─────────────────┘              └─────────────────┘                 └─────────────────┘
```

1. **OpenCode plugin** notifies the server when you submit a prompt or when OpenCode finishes
2. **Blocker server** tracks all OpenCode sessions and their working/idle states
3. **Chrome extension** blocks configured sites when no session is actively working

## Quick Start

### 1. Install dependencies

```bash
bun install
```

### 2. Start the server

```bash
bun run dev
```

### 3. Configure OpenCode to use the plugin

Add the plugin to your OpenCode config (`opencode.json`):

```json
{
  "plugin": ["./packages/opencode-plugin"]
}
```

Or copy `packages/opencode-plugin/index.ts` to `.opencode/plugin/opencode-blocker.ts`

### 4. Install the Chrome extension

1. Run `bun run build` to build the extension
2. Open Chrome and go to `chrome://extensions`
3. Enable "Developer mode"
4. Click "Load unpacked" and select the `chrome-extension/dist` folder

### 5. Configure blocked sites

Click the extension icon → Settings to add sites you want blocked when OpenCode is idle.

Default blocked sites: `x.com`, `twitter.com`, `youtube.com`

## Project Structure

```
opencode-block/
├── packages/
│   ├── shared/           # Shared TypeScript types
│   ├── server/           # Bun WebSocket server
│   ├── opencode-plugin/  # OpenCode plugin
│   └── chrome-extension/ # Chrome extension (Manifest V3)
└── opencode.json         # Plugin config for local testing
```

## Features

- **Soft blocking** — Sites show a modal overlay, not a hard block
- **Real-time updates** — No page refresh needed when state changes
- **Multi-session support** — Tracks multiple OpenCode instances
- **Emergency bypass** — 5-minute bypass, once per day
- **Configurable sites** — Add/remove sites from extension settings
- **Works offline** — Blocks everything when server isn't running (safety default)
- **Zero dependencies** — Server uses only Bun built-in APIs

## Requirements

- [Bun](https://bun.sh) 1.0+
- Chrome (or Chromium-based browser)
- [OpenCode](https://opencode.ai)

## Privacy

- **No data collection** — All data stays on your machine
- **Local only** — Server runs on localhost, no external connections
- **Chrome sync** — Blocked sites list syncs via your Chrome account (if enabled)

## License

MIT
