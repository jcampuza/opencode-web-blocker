export interface Session {
  id: string;
  status: "idle" | "working" | "waiting_for_input";
  cwd?: string;
  lastActivity: number;
}

export interface HookPayload {
  session_id: string;
  hook_event_name:
    | "UserPromptSubmit"
    | "PreToolUse"
    | "Stop"
    | "SessionStart"
    | "SessionEnd";
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  cwd?: string;
}

export type ServerMessage =
  | {
      type: "state";
      blocked: boolean;
      sessions: number;
      working: number;
      waitingForInput: number;
    }
  | { type: "pong" };

export type ClientMessage = { type: "ping" };

export interface ExtensionState {
  blockedDomains: string[];
  lastBypassDate: string | null;
  bypassUntil: number | null;
}

export const DEFAULT_PORT = 8765;
export const SESSION_TIMEOUT_MS = 5 * 60 * 1000;
export const BYPASS_DURATION_MS = 10 * 1000;
export const DEFAULT_BLOCKED_DOMAINS = ["x.com", "twitter.com", "youtube.com"];

export const USER_INPUT_TOOLS = ["ask_user", "ask_human", "AskUserQuestion"];
