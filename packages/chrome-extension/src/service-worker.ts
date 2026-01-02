const WS_URL = "ws://localhost:8765/ws";
const KEEPALIVE_INTERVAL = 20000;
const RECONNECT_DELAY_BASE = 1000;
const RECONNECT_DELAY_MAX = 30000;
const DEFAULT_BLOCKED_DOMAINS = ["x.com", "twitter.com", "youtube.com"];
const BYPASS_DURATION_MS = 10 * 1000;

interface State {
  serverConnected: boolean;
  sessions: number;
  working: number;
  waitingForInput: number;
  bypassUntil: number | null;
}

const state: State = {
  serverConnected: false,
  sessions: 0,
  working: 0,
  waitingForInput: 0,
  bypassUntil: null,
};

let ws: WebSocket | null = null;
let reconnectDelay = RECONNECT_DELAY_BASE;
let keepaliveInterval: ReturnType<typeof setInterval> | null = null;
let bypassTimeout: ReturnType<typeof setTimeout> | null = null;

async function getPublicState() {
  const bypassActive = state.bypassUntil !== null && state.bypassUntil > Date.now();
  const isIdle = state.working === 0 && state.waitingForInput === 0;
  const shouldBlock = !bypassActive && (isIdle || !state.serverConnected);

  const storage = await chrome.storage.sync.get(["bypassDuration"]);
  const bypassDuration = storage.bypassDuration || BYPASS_DURATION_MS / 1000;

  return {
    serverConnected: state.serverConnected,
    sessions: state.sessions,
    working: state.working,
    waitingForInput: state.waitingForInput,
    blocked: shouldBlock,
    bypassActive,
    bypassUntil: state.bypassUntil,
    bypassDuration,
  };
}

async function broadcast() {
  const publicState = await getPublicState();
  chrome.tabs.query({}, (tabs) => {
    for (const tab of tabs) {
      if (tab.id) {
        chrome.tabs.sendMessage(tab.id, { type: "STATE", ...publicState }).catch(() => {});
      }
    }
  });
}

function connect() {
  if (ws) {
    ws.close();
    ws = null;
  }

  ws = new WebSocket(WS_URL);

  ws.onopen = () => {
    state.serverConnected = true;
    reconnectDelay = RECONNECT_DELAY_BASE;
    broadcast();

    if (keepaliveInterval) clearInterval(keepaliveInterval);
    keepaliveInterval = setInterval(() => {
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "ping" }));
      }
    }, KEEPALIVE_INTERVAL);
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === "state") {
        state.sessions = data.sessions;
        state.working = data.working;
        state.waitingForInput = data.waitingForInput;
        broadcast();
      }
    } catch {}
  };

  ws.onclose = () => {
    state.serverConnected = false;
    ws = null;
    if (keepaliveInterval) {
      clearInterval(keepaliveInterval);
      keepaliveInterval = null;
    }
    broadcast();
    setTimeout(connect, reconnectDelay);
    reconnectDelay = Math.min(reconnectDelay * 2, RECONNECT_DELAY_MAX);
  };

  ws.onerror = () => {
    ws?.close();
  };
}

chrome.storage.sync.get(["blockedDomains"], (result) => {
  if (!result.blockedDomains) {
    chrome.storage.sync.set({ blockedDomains: DEFAULT_BLOCKED_DOMAINS });
  }
});

connect();

async function fetchServerStatus(): Promise<{ working: number; waitingForInput: number; sessions: number; blocked: boolean } | null> {
  try {
    const response = await fetch("http://localhost:8765/status", { signal: AbortSignal.timeout(2000) });
    if (response.ok) {
      return await response.json();
    }
  } catch {}
  return null;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "GET_STATE") {
    (async () => {
      if (!state.serverConnected) {
        const serverState = await fetchServerStatus();
        if (serverState) {
          state.serverConnected = true;
          state.sessions = serverState.sessions;
          state.working = serverState.working;
          state.waitingForInput = serverState.waitingForInput;
        }
      }
      sendResponse(await getPublicState());
    })();
    return true;
  }

  if (message.type === "RETRY_CONNECTION") {
    reconnectDelay = RECONNECT_DELAY_BASE;
    connect();
    sendResponse({ success: true });
    return true;
  }

  if (message.type === "ACTIVATE_BYPASS") {
    chrome.storage.sync.get(["bypassDuration"], (result) => {
      const durationMs = (result.bypassDuration || BYPASS_DURATION_MS / 1000) * 1000;
      const bypassUntil = Date.now() + durationMs;
      state.bypassUntil = bypassUntil;
      
      if (bypassTimeout) clearTimeout(bypassTimeout);
      bypassTimeout = setTimeout(() => {
        state.bypassUntil = null;
        broadcast();
      }, durationMs);
      
      broadcast();
      sendResponse({ success: true, bypassUntil });
    });
    return true;
  }

  return false;
});
