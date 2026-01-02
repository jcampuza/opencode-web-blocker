const statusDot = document.getElementById("status-dot") as HTMLDivElement;
const sessionsEl = document.getElementById("sessions") as HTMLDivElement;
const workingEl = document.getElementById("working") as HTMLDivElement;
const blockStatus = document.getElementById("block-status") as HTMLDivElement;
const blockText = document.getElementById("block-text") as HTMLSpanElement;
const settingsBtn = document.getElementById("settings-btn") as HTMLButtonElement;

function updateUI(state: {
  serverConnected: boolean;
  sessions: number;
  working: number;
  blocked: boolean;
  bypassActive: boolean;
}) {
  statusDot.className = state.serverConnected ? "status-dot connected" : "status-dot";
  sessionsEl.textContent = String(state.sessions);
  workingEl.textContent = String(state.working);

  blockStatus.className = "block-status";
  if (state.bypassActive) {
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

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "STATE") {
    updateUI(message);
  }
});

settingsBtn.addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});
