import { findByExactText, setReactInputValue, waitFor } from "@/utils/clicker";

const WAIT_FOR_VIEW_FULL_TABLE_MS = 15_000;
const WAIT_FOR_SEARCH_INPUT_MS = 8_000;
const WAIT_FOR_FILTERED_ROW_MS = 8_000;
const POLL_INTERVAL_MS = 200;

export default defineContentScript({
  matches: ["https://one.newrelic.com/nr1-core/apm-features/transactions/*"],
  runAt: "document_idle",
  main() {
    browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message?.type !== "clickTransaction" || typeof message.transactionName !== "string") {
        return false;
      }
      jumpToTransactionDetail(message.transactionName).then(
        (result) => sendResponse(result),
        (err: unknown) => sendResponse({ ok: false, step: "exception", error: String(err) }),
      );
      return true;
    });
  },
});

type JumpResult =
  | { ok: true }
  | {
      ok: false;
      step: "view-full-table" | "search-input" | "filtered-row" | "exception";
      error?: string;
    };

async function jumpToTransactionDetail(name: string): Promise<JumpResult> {
  const fullTableLink = await waitFor(
    () => findByExactText(document, "View full table", ["a", "button", "span", "div"]),
    WAIT_FOR_VIEW_FULL_TABLE_MS,
    POLL_INTERVAL_MS,
  );
  if (!fullTableLink) return { ok: false, step: "view-full-table" };
  fullTableLink.click();

  const searchInput = await waitFor(
    () => document.querySelector<HTMLInputElement>('input[type="search"]'),
    WAIT_FOR_SEARCH_INPUT_MS,
    POLL_INTERVAL_MS,
  );
  if (!searchInput) return { ok: false, step: "search-input" };
  setReactInputValue(searchInput, name);

  const rowLink = await waitFor(
    () => {
      const rows = document.querySelectorAll('[role="row"].wnd-DataTableRow');
      if (rows.length !== 1) return null;
      return rows[0].querySelector<HTMLElement>(".interactiveLink");
    },
    WAIT_FOR_FILTERED_ROW_MS,
    POLL_INTERVAL_MS,
  );
  if (!rowLink) return { ok: false, step: "filtered-row" };
  rowLink.scrollIntoView({ block: "center" });
  rowLink.click();

  return { ok: true };
}
