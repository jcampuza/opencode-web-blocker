import type { Plugin } from "@opencode-ai/plugin";
import { DEFAULT_PORT, USER_INPUT_TOOLS, type HookPayload } from "opencode-web-blocker-shared";

const SERVER_URL = `http://localhost:${DEFAULT_PORT}/hook`;
const SERVER_STATUS_URL = `http://localhost:${DEFAULT_PORT}/status`;

async function notifyServer(payload: HookPayload): Promise<void> {
  try {
    await fetch(SERVER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {}
}

async function checkServerStatus(): Promise<boolean> {
  try {
    const response = await fetch(SERVER_STATUS_URL, {
      method: "GET",
      signal: AbortSignal.timeout(2000), // 2 second timeout
    });
    return response.ok;
  } catch {
    return false;
  }
}

export const OpenCodeBlockerPlugin: Plugin = async ({ project, client }) => {
  const sessionId = project.id;

  // Check if blocker server is running and notify user
  const isServerRunning = await checkServerStatus();
  if (!isServerRunning) {
    try {
      await client.tui.showToast({
        body: {
          message: `OpenCode Web Blocker server is not running. Start it with: bun run dev`,
          variant: "warning",
          duration: 8000,
        },
      });
    } catch (error) {
      // Fallback to console if TUI is unavailable
      console.warn("[OpenCode Web Blocker] Server is not running on port", DEFAULT_PORT);
    }
  }

  await notifyServer({
    session_id: sessionId,
    hook_event_name: "SessionStart",
    cwd: sessionId,
  });

  return {
    event: async ({ event }) => {
      switch (event.type) {
        case "session.deleted":
          await notifyServer({
            session_id: sessionId,
            hook_event_name: "SessionEnd",
          });
          break;

        case "session.idle":
          await notifyServer({
            session_id: sessionId,
            hook_event_name: "Stop",
          });
          break;

        case "session.status":
          await notifyServer({
            session_id: sessionId,
            hook_event_name: "UserPromptSubmit",
          });
          break;
      }
    },

    "tool.execute.before": async (input) => {
      if (USER_INPUT_TOOLS.includes(input.tool)) {
        await notifyServer({
          session_id: sessionId,
          hook_event_name: "PreToolUse",
          tool_name: input.tool,
        });
      }
    },
  };
};

export default OpenCodeBlockerPlugin;
