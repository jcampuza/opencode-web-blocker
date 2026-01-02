import type { Plugin } from "@opencode-ai/plugin";
import { DEFAULT_PORT, USER_INPUT_TOOLS, type HookPayload } from "opencode-web-blocker-shared";

const SERVER_URL = `http://localhost:${DEFAULT_PORT}/hook`;

async function notifyServer(payload: HookPayload): Promise<void> {
  try {
    await fetch(SERVER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {}
}

export const OpenCodeBlockerPlugin: Plugin = async ({ project }) => {
  const sessionId = project.id;

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
