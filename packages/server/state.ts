import type { HookPayload, Session, ServerMessage } from '@jcamps/opencode-web-blocker-shared';
import { SESSION_TIMEOUT_MS, USER_INPUT_TOOLS } from '@jcamps/opencode-web-blocker-shared';

type Listener = (message: ServerMessage) => void;

export class SessionState {
  private sessions = new Map<string, Session>();
  private listeners = new Set<Listener>();
  private cleanupInterval: Timer;

  constructor() {
    this.cleanupInterval = setInterval(() => this.cleanup(), 30000);
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private broadcast() {
    const message: ServerMessage = { type: 'state', ...this.getPublicState() };
    for (const listener of this.listeners) {
      listener(message);
    }
  }

  getPublicState() {
    let working = 0;
    let waitingForInput = 0;

    for (const session of this.sessions.values()) {
      if (session.status === 'working') working++;
      if (session.status === 'waiting_for_input') waitingForInput++;
    }

    const blocked = working === 0 && waitingForInput === 0;

    return {
      blocked,
      sessions: this.sessions.size,
      working,
      waitingForInput,
    };
  }

  handleHook(payload: HookPayload) {
    const { session_id, hook_event_name, tool_name, cwd } = payload;

    switch (hook_event_name) {
      case 'SessionStart':
        this.sessions.set(session_id, {
          id: session_id,
          status: 'idle',
          cwd,
          lastActivity: Date.now(),
        });
        break;

      case 'SessionEnd':
        this.sessions.delete(session_id);
        break;

      case 'UserPromptSubmit':
        this.updateSession(session_id, 'working');
        break;

      case 'Stop':
        this.updateSession(session_id, 'idle');
        break;

      case 'PreToolUse':
        if (tool_name && USER_INPUT_TOOLS.includes(tool_name)) {
          this.updateSession(session_id, 'waiting_for_input');
        } else {
          setTimeout(() => {
            const session = this.sessions.get(session_id);
            if (session?.status === 'waiting_for_input') {
              this.updateSession(session_id, 'working');
            }
          }, 500);
        }
        break;
    }

    this.broadcast();
  }

  private updateSession(id: string, status: Session['status']) {
    const session = this.sessions.get(id);
    if (session) {
      session.status = status;
      session.lastActivity = Date.now();
    } else {
      this.sessions.set(id, {
        id,
        status,
        lastActivity: Date.now(),
      });
    }
  }

  private cleanup() {
    const now = Date.now();
    for (const [id, session] of this.sessions) {
      if (now - session.lastActivity > SESSION_TIMEOUT_MS) {
        this.sessions.delete(id);
      }
    }
  }

  destroy() {
    const n = 1;
    clearInterval(this.cleanupInterval);
  }
}
