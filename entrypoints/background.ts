import { fetchSliMetadata } from "@/utils/nerdgraph";
import { buildApmTransactionsUrl, parseSloUrl } from "@/utils/nrUrl";

const COMMAND_NAME = "jump-to-apm";

export default defineBackground(() => {
  browser.commands.onCommand.addListener(async (command) => {
    if (command !== COMMAND_NAME) return;
    await runJump();
  });

  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "jump-now") {
      runJump().then(
        (result) => sendResponse({ ok: true, ...result }),
        (err: unknown) => sendResponse({ ok: false, error: errorMessage(err) }),
      );
      return true;
    }
    return false;
  });
});

type JumpResult =
  | { opened: false; reason: string }
  | { opened: true; transactionName: string | null };

async function runJump(): Promise<JumpResult> {
  const [activeTab] = await browser.tabs.query({ active: true, currentWindow: true });
  const url = activeTab?.url ?? "";
  const parsed = parseSloUrl(url);

  if (!parsed) {
    await toastOnTab(activeTab?.id, "現在のタブは SLO summary ページではありません");
    return { opened: false, reason: "not-slo" };
  }
  if (!parsed.account) {
    await toastOnTab(activeTab?.id, "URL に account パラメータがありません");
    return { opened: false, reason: "no-account" };
  }

  const { apiKey } = await browser.storage.local.get("apiKey");
  if (typeof apiKey !== "string" || !apiKey) {
    await toastOnTab(activeTab?.id, "User API key が未設定です（拡張のポップアップで設定）");
    return { opened: false, reason: "no-api-key" };
  }

  let apmGuid: string | null;
  let transactionName: string | null;
  try {
    const meta = await fetchSliMetadata(parsed.sliGuid, apiKey);
    apmGuid = meta.apmGuid;
    transactionName = meta.transactionName;
  } catch (err) {
    await toastOnTab(activeTab?.id, errorMessage(err));
    return { opened: false, reason: "nerdgraph-error" };
  }

  if (!apmGuid) {
    await toastOnTab(activeTab?.id, "SLI に紐づく APM エンティティが見つかりません");
    return { opened: false, reason: "no-apm-guid" };
  }

  const newUrl = buildApmTransactionsUrl(apmGuid, parsed.account, parsed.duration);
  const newTab = await browser.tabs.create({ url: newUrl });
  const newTabId = newTab.id;

  if (transactionName && typeof newTabId === "number") {
    sendClickWhenReady(newTabId, transactionName);
  }

  return { opened: true, transactionName };
}

function sendClickWhenReady(tabId: number, transactionName: string): void {
  const listener: Parameters<typeof browser.tabs.onUpdated.addListener>[0] = (
    updatedTabId,
    info,
  ) => {
    if (updatedTabId !== tabId || info.status !== "complete") return;
    browser.tabs.onUpdated.removeListener(listener);
    browser.tabs.sendMessage(tabId, { type: "clickTransaction", transactionName }).catch(() => {
      // content script may not be ready or the user navigated away; ignore.
    });
  };
  browser.tabs.onUpdated.addListener(listener);
}

async function toastOnTab(tabId: number | undefined, message: string): Promise<void> {
  if (typeof tabId !== "number") return;
  try {
    await browser.scripting.executeScript({
      target: { tabId },
      func: showToast,
      args: [message],
    });
  } catch {
    // can't inject into chrome:// pages etc.
  }
}

function showToast(message: string): void {
  const hostId = "nr-slo-to-tx-toast-host";
  const existing = document.getElementById(hostId);
  if (existing) existing.remove();

  const host = document.createElement("div");
  host.id = hostId;
  host.style.cssText =
    "all: initial; position: fixed; z-index: 2147483647; top: 16px; right: 16px; pointer-events: none;";

  const shadow = host.attachShadow({ mode: "closed" });
  const toast = document.createElement("div");
  toast.textContent = message;
  toast.style.cssText = [
    'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    "font-size: 14px",
    "line-height: 1.5",
    "padding: 8px 16px",
    "background: rgba(0, 0, 0, 0.85)",
    "color: #fff",
    "border-radius: 8px",
    "box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2)",
    "opacity: 0",
    "transform: translateY(-8px)",
    "transition: opacity 0.15s ease, transform 0.15s ease",
    "pointer-events: none",
    "max-width: 360px",
  ].join("; ");

  shadow.appendChild(toast);
  document.body.appendChild(host);

  requestAnimationFrame(() => {
    toast.style.opacity = "1";
    toast.style.transform = "translateY(0)";
  });
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(-8px)";
    setTimeout(() => host.remove(), 300);
  }, 2500);
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
