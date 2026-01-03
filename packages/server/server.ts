import { SessionState } from "./state";
import type { HookPayload } from "opencode-web-blocker-shared";
import { DEFAULT_PORT } from "opencode-web-blocker-shared";
import type { ServerWebSocket } from "bun";

export function startServer(port: number = DEFAULT_PORT) {
  const state = new SessionState();
  const clients = new Set<ServerWebSocket>();

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  const server = Bun.serve({
    port,

    fetch(req, server) {
      const url = new URL(req.url);

      if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
      }

      if (url.pathname === "/ws") {
        if (server.upgrade(req)) return;
        return new Response("Upgrade failed", { status: 500, headers: corsHeaders });
      }

      if (url.pathname === "/status" && req.method === "GET") {
        return Response.json(state.getPublicState(), { headers: corsHeaders });
      }

      if (url.pathname === "/hook" && req.method === "POST") {
        return (async () => {
          const payload = (await req.json()) as HookPayload;
          state.handleHook(payload);
          return new Response("OK", { headers: corsHeaders });
        })();
      }

      return new Response("Not found", { status: 404, headers: corsHeaders });
    },

    websocket: {
      open(ws) {
        clients.add(ws);
        ws.send(JSON.stringify({ type: "state", ...state.getPublicState() }));
        console.log("Extension connected");
      },
      message(ws, message) {
        try {
          const data = JSON.parse(String(message));
          if (data.type === "ping") {
            ws.send(JSON.stringify({ type: "pong" }));
          }
        } catch {}
      },
      close(ws) {
        clients.delete(ws);
        console.log("Extension disconnected");
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
