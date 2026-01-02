const DEFAULT_BLOCKED_DOMAINS = ["x.com", "twitter.com", "youtube.com"];

let blockedDomains: string[] = DEFAULT_BLOCKED_DOMAINS;
let modalContainer: HTMLElement | null = null;
let modalShadow: ShadowRoot | null = null;
let toastContainer: HTMLElement | null = null;
let currentState = {
  blocked: true,
  serverConnected: false,
  working: 0,
  waitingForInput: 0,
  bypassActive: false,
  bypassDuration: 300,
};

function isBlockedDomain(): boolean {
  const hostname = window.location.hostname.replace(/^www\./, "");
  return blockedDomains.some((d) => hostname === d || hostname.endsWith(`.${d}`));
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function createModal() {
  if (modalContainer) {
    if (modalShadow) updateModalContent(modalShadow);
    return;
  }

  modalContainer = document.createElement("div");
  modalContainer.id = "opencode-blocker-modal";

  const shadow = modalContainer.attachShadow({ mode: "closed" });
  modalShadow = shadow;

  const style = document.createElement("style");
  style.textContent = `
    .overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.95);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      z-index: 2147483647;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: white;
    }
    .title {
      font-size: 2rem;
      font-weight: 600;
      margin-bottom: 1rem;
    }
    .subtitle {
      font-size: 1.1rem;
      opacity: 0.8;
      margin-bottom: 2rem;
      text-align: center;
      max-width: 400px;
    }
    .status {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.9rem;
      opacity: 0.6;
    }
    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #ef4444;
    }
    .dot.connected {
      background: #22c55e;
    }
    .bypass-btn {
      margin-top: 2rem;
      padding: 0.75rem 1.5rem;
      background: transparent;
      border: 1px solid rgba(255, 255, 255, 0.3);
      color: white;
      border-radius: 8px;
      cursor: pointer;
      font-size: 0.9rem;
      transition: background 0.2s;
    }
    .bypass-btn:hover {
      background: rgba(255, 255, 255, 0.1);
    }
    .bypass-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .retry-btn {
      margin-top: 1rem;
      padding: 0.75rem 1.5rem;
      background: #3b82f6;
      border: none;
      color: white;
      border-radius: 8px;
      cursor: pointer;
      font-size: 0.9rem;
      transition: background 0.2s;
    }
    .retry-btn:hover {
      background: #2563eb;
    }
    .retry-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .server-info {
      margin-top: 1.5rem;
      padding: 1rem;
      background: rgba(255, 255, 255, 0.05);
      border-radius: 8px;
      font-size: 0.85rem;
      color: #94a3b8;
      max-width: 400px;
      text-align: center;
    }
    .server-info code {
      background: rgba(255, 255, 255, 0.1);
      padding: 0.2rem 0.4rem;
      border-radius: 4px;
      font-family: monospace;
    }
    .hidden {
      display: none;
    }
  `;

  const overlay = document.createElement("div");
  overlay.className = "overlay";
  overlay.innerHTML = `
    <div class="title">Get back to work!</div>
    <div class="subtitle" id="message">Waiting for opencode...</div>
    <div class="status">
      <div class="dot" id="status-dot"></div>
      <span id="status-text">Connecting...</span>
    </div>
    <button class="bypass-btn" id="bypass-btn">Emergency Bypass</button>
    <button class="retry-btn hidden" id="retry-btn">Retry Connection</button>
    <div class="server-info hidden" id="server-info">
      Start the server with <code>bun run dev</code> in the opencode-block directory
    </div>
  `;

  shadow.appendChild(style);
  shadow.appendChild(overlay);

  const bypassBtn = shadow.getElementById("bypass-btn") as HTMLButtonElement;
  bypassBtn.addEventListener("click", async () => {
    const response = await chrome.runtime.sendMessage({ type: "ACTIVATE_BYPASS" });
    if (response.success) {
      removeModal();
    }
  });

  const retryBtn = shadow.getElementById("retry-btn") as HTMLButtonElement;
  retryBtn.addEventListener("click", async () => {
    retryBtn.disabled = true;
    retryBtn.textContent = "Connecting...";
    await chrome.runtime.sendMessage({ type: "RETRY_CONNECTION" });
    setTimeout(() => {
      retryBtn.disabled = false;
      retryBtn.textContent = "Retry Connection";
    }, 2000);
  });

  document.documentElement.appendChild(modalContainer);
  updateModalContent(shadow);
}

function updateModalContent(shadow: ShadowRoot) {
  const message = shadow.getElementById("message");
  const statusDot = shadow.getElementById("status-dot");
  const statusText = shadow.getElementById("status-text");
  const bypassBtn = shadow.getElementById("bypass-btn");
  const retryBtn = shadow.getElementById("retry-btn");
  const serverInfo = shadow.getElementById("server-info");

  if (!message || !statusDot || !statusText) return;

  if (bypassBtn) {
    bypassBtn.textContent = `Emergency Bypass (${formatDuration(currentState.bypassDuration)})`;
  }

  if (!currentState.serverConnected) {
    message.textContent = "Server offline. Start the blocker server to continue.";
    statusDot.className = "dot";
    statusText.textContent = "Server offline";
    retryBtn?.classList.remove("hidden");
    serverInfo?.classList.remove("hidden");
  } else {
    retryBtn?.classList.add("hidden");
    serverInfo?.classList.add("hidden");
    
    if (currentState.working === 0 && currentState.waitingForInput === 0) {
      message.textContent = "Your agent finished! Time to review.";
      statusDot.className = "dot connected";
      statusText.textContent = "Connected - Idle";
    } else {
      statusDot.className = "dot connected";
      statusText.textContent = `Working (${currentState.working} active)`;
    }
  }
}

function removeModal() {
  if (modalContainer) {
    modalContainer.remove();
    modalContainer = null;
    modalShadow = null;
  }
}

function createToast() {
  if (toastContainer) return;

  toastContainer = document.createElement("div");
  toastContainer.id = "opencode-blocker-toast";

  const shadow = toastContainer.attachShadow({ mode: "closed" });

  const style = document.createElement("style");
  style.textContent = `
    .toast {
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: #1e293b;
      color: white;
      padding: 1rem 1.5rem;
      border-radius: 8px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 0.9rem;
      z-index: 2147483646;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .pulse {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #fbbf24;
      animation: pulse 1.5s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
    .close {
      margin-left: 1rem;
      background: none;
      border: none;
      color: white;
      opacity: 0.6;
      cursor: pointer;
      font-size: 1.2rem;
    }
    .close:hover {
      opacity: 1;
    }
  `;

  const toast = document.createElement("div");
  toast.className = "toast";
  toast.innerHTML = `
    <div class="pulse"></div>
    <span>opencode has a question for you!</span>
    <button class="close">×</button>
  `;

  shadow.appendChild(style);
  shadow.appendChild(toast);

  const closeBtn = shadow.querySelector(".close") as HTMLButtonElement;
  closeBtn.addEventListener("click", () => {
    removeToast();
  });

  document.documentElement.appendChild(toastContainer);
}

function removeToast() {
  if (toastContainer) {
    toastContainer.remove();
    toastContainer = null;
  }
}

function updateUI() {
  if (!isBlockedDomain()) {
    removeModal();
    removeToast();
    return;
  }

  if (currentState.blocked && !currentState.bypassActive) {
    createModal();
  } else {
    removeModal();
  }

  if (currentState.waitingForInput > 0 && !currentState.blocked) {
    createToast();
  } else {
    removeToast();
  }
}

chrome.storage.sync.get(["blockedDomains"], (result) => {
  if (result.blockedDomains) {
    blockedDomains = result.blockedDomains;
  }
  updateUI();
});

chrome.storage.onChanged.addListener((changes) => {
  if (changes.blockedDomains) {
    blockedDomains = changes.blockedDomains.newValue || DEFAULT_BLOCKED_DOMAINS;
    updateUI();
  }
});

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "STATE") {
    currentState = {
      blocked: message.blocked,
      serverConnected: message.serverConnected,
      working: message.working,
      waitingForInput: message.waitingForInput,
      bypassActive: message.bypassActive,
      bypassDuration: message.bypassDuration || 300,
    };
    updateUI();
  }
});

chrome.runtime.sendMessage({ type: "GET_STATE" }).then((state) => {
  if (state) {
    currentState = {
      blocked: state.blocked,
      serverConnected: state.serverConnected,
      working: state.working,
      waitingForInput: state.waitingForInput,
      bypassActive: state.bypassActive,
      bypassDuration: state.bypassDuration || 300,
    };
    updateUI();
  }
}).catch(() => {});

const observer = new MutationObserver(() => {
  if (currentState.blocked && !currentState.bypassActive && isBlockedDomain() && !modalContainer) {
    createModal();
  }
});

observer.observe(document.documentElement, { childList: true, subtree: true });
