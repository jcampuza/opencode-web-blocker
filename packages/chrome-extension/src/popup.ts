const statusDot = document.getElementById("status-dot") as HTMLDivElement;
const sessionsEl = document.getElementById("sessions") as HTMLDivElement;
const workingEl = document.getElementById("working") as HTMLDivElement;
const blockStatus = document.getElementById("block-status") as HTMLDivElement;
const blockText = document.getElementById("block-text") as HTMLSpanElement;
const settingsBtn = document.getElementById("settings-btn") as HTMLButtonElement;
const extensionToggle = document.getElementById("extension-toggle") as HTMLInputElement;

type PopupState = {
  serverConnected: boolean;
  sessions: number;
  working: number;
  blocked: boolean;
  bypassActive: boolean;
  extensionEnabled: boolean;
};

let currentState: PopupState | null = null;

function updateUI(state: PopupState) {
  const extensionEnabled = state.extensionEnabled ?? true;
  currentState = { ...state, extensionEnabled };
  statusDot.className = state.serverConnected ? "status-dot connected" : "status-dot";
  sessionsEl.textContent = String(state.sessions);
  workingEl.textContent = String(state.working);
  extensionToggle.checked = extensionEnabled;

  blockStatus.className = "block-status";
  if (!extensionEnabled) {
    blockStatus.classList.add("disabled");
    blockText.textContent = "Extension Disabled";
  } else if (state.bypassActive) {
    blockStatus.classList.add("open");
    blockText.textContent = "Bypass Active";
  } else if (state.blocked) {
    blockStatus.classList.add("blocked");
    blockText.textContent = "Sites Blocked";
  } else {
    blockStatus.classList.add("open");
    blockText.textContent = "Sites Open";
  }
}

chrome.runtime.sendMessage({ type: "GET_STATE" }).then((state) => {
  if (state) updateUI(state);
});

chrome.storage.sync.get(["extensionEnabled"], (result) => {
  if (result.extensionEnabled === undefined) return;
  extensionToggle.checked = result.extensionEnabled;
});

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "STATE") {
    updateUI(message);
  }
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "sync") return;
  if (changes.extensionEnabled && currentState) {
    updateUI({ ...currentState, extensionEnabled: changes.extensionEnabled.newValue ?? true });
  }
});

settingsBtn.addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

extensionToggle.addEventListener("change", () => {
  const extensionEnabled = extensionToggle.checked;
  chrome.storage.sync.set({ extensionEnabled });
  if (currentState) {
    updateUI({ ...currentState, extensionEnabled });
  }
});
