import "./style.css";
import { parseSloUrl } from "@/utils/nrUrl";

// biome-ignore lint/style/noNonNullAssertion: #app is guaranteed to exist in index.html
const app = document.querySelector<HTMLDivElement>("#app")!;

app.innerHTML = `
  <div class="container">
    <h1>NR SLO → APM Transaction</h1>

    <div id="page-status" class="page-status">…</div>

    <button id="jump-btn" class="primary-btn" disabled>
      Jump to APM transaction
      <span class="shortcut" id="shortcut-hint" aria-hidden="true"></span>
    </button>

    <details class="config" id="api-key-config">
      <summary>API key 設定</summary>
      <label for="api-key-input">
        User API key
        <a
          href="https://one.newrelic.com/api-keys"
          target="_blank"
          rel="noopener noreferrer"
          class="help-link"
          >発行はこちら</a
        >
      </label>
      <input
        id="api-key-input"
        type="password"
        autocomplete="off"
        placeholder="NRAK-XXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
      />
      <button id="save-btn" class="secondary-btn">保存</button>
      <div id="api-key-status" class="status" role="status" aria-live="polite"></div>
    </details>

    <div id="status" class="status" role="status" aria-live="polite"></div>

    <div class="footer">
      <a id="customize-shortcuts" class="customize-link" href="#">Customize shortcut</a>
    </div>
  </div>
`;

function $<T extends HTMLElement>(selector: string): T {
  const el = document.querySelector<T>(selector);
  if (!el) throw new Error(`Popup element not found: ${selector}`);
  return el;
}

const pageStatus = $<HTMLDivElement>("#page-status");
const jumpBtn = $<HTMLButtonElement>("#jump-btn");
const shortcutHint = $<HTMLSpanElement>("#shortcut-hint");
const apiKeyConfig = $<HTMLDetailsElement>("#api-key-config");
const apiKeyInput = $<HTMLInputElement>("#api-key-input");
const saveBtn = $<HTMLButtonElement>("#save-btn");
const apiKeyStatus = $<HTMLDivElement>("#api-key-status");
const status = $<HTMLDivElement>("#status");
const customizeLink = $<HTMLAnchorElement>("#customize-shortcuts");

initialize();

async function initialize(): Promise<void> {
  await Promise.all([initPageStatus(), initApiKey(), initShortcut()]);
}

async function initPageStatus(): Promise<void> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  const url = tab?.url ?? "";
  const parsed = parseSloUrl(url);
  if (parsed) {
    pageStatus.textContent = "現在のタブ: SLO summary ページ ✓";
    pageStatus.classList.add("ok");
    jumpBtn.disabled = false;
  } else {
    pageStatus.textContent = "現在のタブ: SLO summary ページではありません";
    pageStatus.classList.add("warn");
  }
}

async function initApiKey(): Promise<void> {
  const { apiKey } = await browser.storage.local.get("apiKey");
  if (typeof apiKey === "string" && apiKey) {
    apiKeyInput.value = apiKey;
  } else {
    apiKeyConfig.open = true;
  }
}

async function initShortcut(): Promise<void> {
  const commands = await browser.commands.getAll();
  const command = commands.find((c) => c.name === "jump-to-apm");
  const isMac = navigator.platform.includes("Mac");
  shortcutHint.textContent = formatShortcut(command?.shortcut ?? "", isMac);
}

function formatShortcut(shortcut: string, isMac: boolean): string {
  if (!shortcut) return "";
  if (!isMac) return shortcut;
  return shortcut
    .replace(/MacCtrl\+/g, "⌃")
    .replace(/Command\+/g, "⌘")
    .replace(/Ctrl\+/g, "⌃")
    .replace(/Alt\+/g, "⌥")
    .replace(/Shift\+/g, "⇧");
}

jumpBtn.addEventListener("click", async () => {
  jumpBtn.disabled = true;
  setStatus("Calling NerdGraph…");
  try {
    const result = (await browser.runtime.sendMessage({ type: "jump-now" })) as {
      ok: boolean;
      error?: string;
      opened?: boolean;
      transactionName?: string | null;
    };
    if (result?.ok && result.opened) {
      setStatus(
        result.transactionName
          ? `Opening transaction: ${result.transactionName}`
          : "Opening transactions list (no transaction name in NRQL)",
      );
      setTimeout(() => window.close(), 800);
    } else {
      setStatus(result?.error ?? "Failed to open transaction", true);
      jumpBtn.disabled = false;
    }
  } catch (err) {
    setStatus(String(err), true);
    jumpBtn.disabled = false;
  }
});

saveBtn.addEventListener("click", async () => {
  const value = apiKeyInput.value.trim();
  if (!value.startsWith("NRAK-")) {
    setApiKeyStatus("User API key は通常 'NRAK-' で始まります", true);
    return;
  }
  await browser.storage.local.set({ apiKey: value });
  setApiKeyStatus("保存しました");
});

customizeLink.addEventListener("click", (e) => {
  e.preventDefault();
  browser.tabs.create({ url: "chrome://extensions/shortcuts" });
  window.close();
});

let statusTimeout: ReturnType<typeof setTimeout> | undefined;
function setStatus(message: string, isError = false): void {
  if (statusTimeout) clearTimeout(statusTimeout);
  status.textContent = message;
  status.className = `status ${isError ? "error" : "success"}`;
}

let apiKeyStatusTimeout: ReturnType<typeof setTimeout> | undefined;
function setApiKeyStatus(message: string, isError = false): void {
  if (apiKeyStatusTimeout) clearTimeout(apiKeyStatusTimeout);
  apiKeyStatus.textContent = message;
  apiKeyStatus.className = `status ${isError ? "error" : "success"}`;
  apiKeyStatusTimeout = setTimeout(() => {
    apiKeyStatus.textContent = "";
    apiKeyStatus.className = "status";
  }, 2500);
}
