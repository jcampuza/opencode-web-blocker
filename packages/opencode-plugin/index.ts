import type { Plugin } from '@opencode-ai/plugin';

// Inlined from shared package for standalone npm publishing
const DEFAULT_PORT = 8765;

interface HookPayload {
  session_id: string;
  hook_event_name:
    | 'UserPromptSubmit'
    | 'PreToolUse'
    | 'PostToolUse'
    | 'Stop'
    | 'SessionStart'
    | 'SessionEnd';
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  cwd?: string;
}

const SERVER_URL = `http://localhost:${DEFAULT_PORT}/hook`;

async function notifyServer(payload: HookPayload): Promise<void> {
  try {
    await fetch(SERVER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {}
}

export const OpenCodeBlockerPlugin: Plugin = async ({ project, directory }) => {
  return {
    event: async ({ event }) => {
      switch (event.type) {
        case 'session.created': {
          await notifyServer({
            session_id: event.properties.info.id,
            hook_event_name: 'SessionStart',
            cwd: directory,
          });
          break;
        }

        case 'session.deleted':
          await notifyServer({
            session_id: event.properties.info.id,
            hook_event_name: 'SessionEnd',
          });
          break;

        case 'session.idle':
          await notifyServer({
            session_id: event.properties.sessionID,
            hook_event_name: 'Stop',
          });
          break;

        case 'session.status':
          await notifyServer({
            session_id: event.properties.sessionID,
            hook_event_name: 'UserPromptSubmit',
          });
          break;
      }
    },

    'tool.execute.after': async (input) => {
      await notifyServer({
        session_id: input.sessionID,
        hook_event_name: 'PostToolUse',
        tool_name: input.tool,
      });
    },

    'tool.execute.before': async (input) => {
      await notifyServer({
        session_id: input.sessionID,
        hook_event_name: 'PreToolUse',
        tool_name: input.tool,
      });
    },
    config: async (input) => {
      input.command ??= {};
      input.command['ping-blocker'] = {
        description: 'This is really just here to verify the plugin is actually loaded',
        template: "Don't do anything, this command is never meant to be actually run.",
      };
    },
  };
};

export default OpenCodeBlockerPlugin;
