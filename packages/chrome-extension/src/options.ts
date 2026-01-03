const DEFAULT_BLOCKED_DOMAINS = ["x.com", "twitter.com", "youtube.com"];
const DEFAULT_BYPASS_DURATION = 300;
const DEFAULT_SERVER_PORT = 8765;

const domainList = document.getElementById("domain-list") as HTMLUListElement;
const newDomainInput = document.getElementById("new-domain") as HTMLInputElement;
const addBtn = document.getElementById("add-btn") as HTMLButtonElement;
const errorEl = document.getElementById("error") as HTMLDivElement;
const bypassBtn = document.getElementById("bypass-btn") as HTMLButtonElement;
const bypassStatus = document.getElementById("bypass-status") as HTMLDivElement;
const bypassDurationInput = document.getElementById("bypass-duration") as HTMLInputElement;
const serverPortInput = document.getElementById("server-port") as HTMLInputElement;

let blockedDomains: string[] = [];
let bypassDuration: number = DEFAULT_BYPASS_DURATION;
let serverPort: number = DEFAULT_SERVER_PORT;

function isValidDomain(domain: string): boolean {
  const regex = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,}$/;
  return regex.test(domain);
}

function normalizeDomain(input: string): string {
  let domain = input.toLowerCase().trim();
  domain = domain.replace(/^(https?:\/\/)?(www\.)?/, "");
  domain = domain.split("/")[0] ?? "";
  return domain;
}

function renderDomains() {
  domainList.innerHTML = "";
  for (const domain of blockedDomains) {
    const li = document.createElement("li");
    li.className = "domain-item";
    li.innerHTML = `
      <span>${domain}</span>
      <button data-domain="${domain}">Remove</button>
    `;
    domainList.appendChild(li);
  }

  domainList.querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", () => {
      const domain = btn.getAttribute("data-domain");
      if (domain) {
        blockedDomains = blockedDomains.filter((d) => d !== domain);
        chrome.storage.sync.set({ blockedDomains });
        renderDomains();
      }
    });
  });
}

function addDomain() {
  errorEl.textContent = "";
  const domain = normalizeDomain(newDomainInput.value);

  if (!domain) {
    errorEl.textContent = "Please enter a domain";
    return;
  }

  if (!isValidDomain(domain)) {
    errorEl.textContent = "Invalid domain format";
    return;
  }

  if (blockedDomains.includes(domain)) {
    errorEl.textContent = "Domain already blocked";
    return;
  }

  blockedDomains.push(domain);
  chrome.storage.sync.set({ blockedDomains });
  newDomainInput.value = "";
  renderDomains();
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function updateBypassUI(bypassUntil: number | null) {
  if (bypassUntil && bypassUntil > Date.now()) {
    const remainingSeconds = Math.ceil((bypassUntil - Date.now()) / 1000);
    bypassBtn.textContent = `Bypass Active (${formatDuration(remainingSeconds)} left)`;
    bypassBtn.disabled = true;
    bypassStatus.textContent = "";
  } else {
    bypassBtn.textContent = `Activate Bypass (${formatDuration(bypassDuration)})`;
    bypassBtn.disabled = false;
    bypassStatus.textContent = "";
  }
}

chrome.storage.sync.get(["blockedDomains", "bypassDuration", "serverPort"], (result) => {
  blockedDomains = result.blockedDomains || DEFAULT_BLOCKED_DOMAINS;
  bypassDuration = result.bypassDuration || DEFAULT_BYPASS_DURATION;
  serverPort = result.serverPort || DEFAULT_SERVER_PORT;
  bypassDurationInput.value = String(bypassDuration);
  serverPortInput.value = String(serverPort);
  renderDomains();
  updateBypassUI(null);
});

chrome.runtime.sendMessage({ type: "GET_STATE" }).then((response) => {
  if (response) {
    updateBypassUI(response.bypassUntil);
  }
});

addBtn.addEventListener("click", addDomain);
newDomainInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") addDomain();
});

bypassDurationInput.addEventListener("change", () => {
  const value = parseInt(bypassDurationInput.value, 10);
  if (value >= 5 && value <= 3600) {
    bypassDuration = value;
    chrome.storage.sync.set({ bypassDuration });
    updateBypassUI(null);
  }
});

serverPortInput.addEventListener("change", () => {
  const value = parseInt(serverPortInput.value, 10);
  if (value >= 1 && value <= 65535) {
    serverPort = value;
    chrome.storage.sync.set({ serverPort });
    chrome.runtime.sendMessage({ type: "RETRY_CONNECTION" });
  }
});

bypassBtn.addEventListener("click", async () => {
  const response = await chrome.runtime.sendMessage({ type: "ACTIVATE_BYPASS" });
  if (response.success) {
    updateBypassUI(response.bypassUntil);
  }
});

setInterval(() => {
  chrome.runtime.sendMessage({ type: "GET_STATE" }).then((response) => {
    if (response) {
      updateBypassUI(response.bypassUntil);
    }
  }).catch(() => {});
}, 1000);
