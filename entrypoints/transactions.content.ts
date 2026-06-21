import { findByExactText, setReactInputValue, waitFor } from "@/utils/clicker";
import { inferTransactionType, type TransactionType } from "@/utils/nrql";

const WAIT_FOR_VIEW_FULL_TABLE_MS = 15_000;
const WAIT_FOR_FILTER_PILL_MS = 5_000;
const WAIT_FOR_FILTER_OPTION_MS = 5_000;
const WAIT_FOR_FILTER_CONFIRMED_MS = 3_000;
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
      step:
        | "view-full-table"
        | "filter-pill"
        | "filter-option"
        | "filter-confirm"
        | "search-input"
        | "filtered-row"
        | "exception";
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

  const filterResult = await ensureTransactionTypeFilter(inferTransactionType(name));
  if (filterResult !== "ok") return { ok: false, step: filterResult };

  const searchInput = await waitFor(
    () => document.querySelector<HTMLInputElement>('input[type="search"]'),
    WAIT_FOR_SEARCH_INPUT_MS,
    POLL_INTERVAL_MS,
  );
  if (!searchInput) return { ok: false, step: "search-input" };
  setReactInputValue(searchInput, name);

  const rowLink = await waitFor(
    () => {
      // Scope to the "Transaction Table" grid — there is also a sibling
      // "Breakdown table" that shares the same `.wnd-DataTableRow` class
      // and would otherwise inflate the row count for transactions that
      // have segment breakdowns (typical for non-web/Sidekiq jobs).
      const grid = document.querySelector('[aria-label="Transaction Table"]');
      if (!grid) return null;
      const rows = grid.querySelectorAll('[role="row"].wnd-DataTableRow');
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

/**
 * Ensure the "Transaction type" filter pill in the full transactions table
 * matches `want`. If the pill already shows the desired value, no-op.
 * Otherwise click the pill, wait for the dropdown listbox, and click the
 * matching option, then wait until the pill text reflects the new value.
 */
async function ensureTransactionTypeFilter(
  want: TransactionType,
): Promise<"ok" | "filter-pill" | "filter-option" | "filter-confirm"> {
  const findPill = (): HTMLElement | null => {
    const pills = document.querySelectorAll<HTMLElement>(".common-filter-bar .wnd-Pill--clickable");
    for (const p of pills) {
      if ((p.textContent ?? "").includes("Transaction type")) return p;
    }
    return null;
  };

  const pill = await waitFor(findPill, WAIT_FOR_FILTER_PILL_MS, POLL_INTERVAL_MS);
  if (!pill) return "filter-pill";
  if ((pill.textContent ?? "").includes(`=${want}`)) return "ok";

  pill.click();

  const option = await waitFor(
    () => {
      const opts = document.querySelectorAll<HTMLElement>('[role="option"]');
      for (const opt of opts) {
        const label = opt.querySelector(".wnd-SearchSelectItem-label");
        if (label && (label.textContent ?? "").trim() === want) return opt;
      }
      return null;
    },
    WAIT_FOR_FILTER_OPTION_MS,
    POLL_INTERVAL_MS,
  );
  if (!option) return "filter-option";
  option.click();

  const confirmed = await waitFor(
    () => {
      const updated = findPill();
      return updated && (updated.textContent ?? "").includes(`=${want}`) ? true : null;
    },
    WAIT_FOR_FILTER_CONFIRMED_MS,
    POLL_INTERVAL_MS,
  );
  return confirmed ? "ok" : "filter-confirm";
}
