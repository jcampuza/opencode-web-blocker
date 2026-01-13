import { SessionState } from './state';
import type { HookPayload } from '@jcamps/opencode-web-blocker-shared';
import { DEFAULT_PORT } from '@jcamps/opencode-web-blocker-shared';
import type { ServerWebSocket } from 'bun';

type LogLevel = 'info' | 'debug' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  event: string;
  source: string;
  metadata?: Record<string, unknown>;
}

function log(
  event: string,
  source: string,
  level: LogLevel = 'info',
  metadata?: Record<string, unknown>
) {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    event,
    source,
    metadata,
  };
  console.log(JSON.stringify(entry));
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export function startServer(port: number = DEFAULT_PORT) {
  const state = new SessionState();
  const clients = new Set<ServerWebSocket>();

  const server = Bun.serve({
    port,

    fetch(req, server) {
      const url = new URL(req.url);

      if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
      }

      if (url.pathname === '/ws') {
        if (server.upgrade(req)) return;
        return new Response('Upgrade failed', { status: 500, headers: corsHeaders });
      }

      if (url.pathname === '/status' && req.method === 'GET') {
        return Response.json(state.getPublicState(), { headers: corsHeaders });
      }

      if (url.pathname === '/hook' && req.method === 'POST') {
        return (async () => {
          const payload = (await req.json()) as HookPayload;
          log('hook_received', 'http', 'info', {
            session_id: payload.session_id,
            hook_event_name: payload.hook_event_name,
            tool_name: payload.tool_name,
            cwd: payload.cwd,
          });
          state.handleHook(payload);
          return new Response('OK', { headers: corsHeaders });
        })();
      }

      return new Response('Not found', { status: 404, headers: corsHeaders });
    },

    websocket: {
      open(ws) {
        clients.add(ws);
        ws.send(JSON.stringify({ type: 'state', ...state.getPublicState() }));
        log('extension_connected', 'websocket', 'info');
      },
      message(ws, message) {
        try {
          const data = JSON.parse(String(message));
          log('websocket_message', 'websocket', 'debug', { type: data.type });
          if (data.type === 'ping') {
            ws.send(JSON.stringify({ type: 'pong' }));
          }
        } catch {}
      },
      close(ws) {
        clients.delete(ws);
        log('extension_disconnected', 'websocket', 'info');
      },
    },
  });

  state.subscribe((message) => {
    const json = JSON.stringify(message);
    for (const client of clients) {
      client.send(json);
    }
  });

  return server;
}
