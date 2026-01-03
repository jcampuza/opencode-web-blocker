import type { Plugin } from "@opencode-ai/plugin";

// Inlined from shared package for standalone npm publishing
const DEFAULT_PORT = 8765;
const USER_INPUT_TOOLS = ["ask_user", "ask_human", "AskUserQuestion"];

interface HookPayload {
  session_id: string;
  hook_event_name: "UserPromptSubmit" | "PreToolUse" | "Stop" | "SessionStart" | "SessionEnd";
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  cwd?: string;
}

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
