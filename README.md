# New Relic SLO → APM Transaction

A Chrome extension that jumps from a New Relic SLO summary page to the APM transaction detail panel the SLI monitors, in one keyboard shortcut.

```
SLO summary page (active)
        │
        │  ⌃⇧L (configurable)
        ▼
APM transactions page → row for the SLI's target transaction auto-clicked
        │
        ▼
Transaction detail panel open, ready to inspect
```

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/shifumin/new-relic-slo-to-transaction.git
   cd new-relic-slo-to-transaction
   ```
2. Install dependencies:
   ```bash
   pnpm install
   ```
3. Build the extension:
   ```bash
   pnpm build
   ```
4. Open `chrome://extensions/` in Chrome
5. Enable **Developer mode** (toggle in the top right)
6. Click **Load unpacked** and select the `.output/chrome-mv3` directory

## Setup

### 1. Issue a User API key

1. Visit https://one.newrelic.com/api-keys.
2. **Create a key** → key type **User** (not Ingest) → name e.g. `slo-to-transaction-extension`.
3. Copy the `NRAK-...` value.

### 2. Save the key in the extension

1. Click the extension icon to open its popup.
2. Expand **API key 設定** and paste the User API key.
3. Click **保存**.

### 3. Assign a keyboard shortcut (optional)

Defaults to `Alt+Shift+L` (Win/Linux) and `MacCtrl+Shift+L` (= ⌃⇧L on macOS). To customize, click **Customize shortcut** in the popup (or open `chrome://extensions/shortcuts`).

## Usage

1. Open any New Relic SLO summary page, e.g. `https://one.newrelic.com/nr1-core/service-levels-management/summary/<SLI_GUID>?account=<ACCT>&duration=<MS>`.
2. Press the shortcut (or click the extension icon → **Jump to APM transaction**).
3. A new tab opens with the APM transactions page. The row for the SLI's target transaction is auto-selected, revealing the detail panel.

If the SLI's NRQL contains no literal `name = '...'` predicate (e.g. it uses `LIKE`), the extension cannot extract a transaction name and surfaces an in-page toast on the SLO tab; the APM transactions page is not opened.

## How It Works

1. Reads the SLI GUID from the current SLO summary URL.
2. Calls NerdGraph with the stored User API key to fetch:
   - The associated APM entity GUID (`nr.associatedEntityGuid` tag).
   - The SLI's `events.where` NRQL clause, from which the target transaction name (`name = '...'`) is extracted.
3. Opens the APM transactions page for that APM entity in a new tab.
4. The content script then runs a four-step automation chain inside that tab:
   1. Find and click the **View full table** link in the "Top 20 transactions" widget (waits up to 15 s).
   2. Ensure the **Transaction type** filter pill matches what the SLI tracks. `OtherTransaction/...` names (Sidekiq jobs, rake tasks) need `Non-web`; everything else stays on `Web`. If a switch is needed, the pill is clicked, the dropdown's matching option is clicked, and the new value is confirmed.
   3. Wait for the search input, then fill the full transaction name via a React-aware setter (waits up to 8 s).
   4. Wait for the **Transaction Table** grid (scoped explicitly — the sibling "Breakdown table" also uses the same row class for non-web jobs with segment breakdowns) to filter down to exactly one row, then click the row's interactive link (waits up to 8 s).
5. NR opens the transaction detail panel — same UI as if you had navigated by hand.

## Limitations

- US region only (NerdGraph `https://api.newrelic.com/graphql`). For EU, change `NERDGRAPH_ENDPOINT` in `utils/nerdgraph.ts`.
- Works only when the SLI's `events.where` NRQL contains a literal `name = 'TransactionName'` clause.
- The four-step automation depends on NR1's current DOM (the "View full table" link text, the `.common-filter-bar .wnd-Pill--clickable` filter pill, `[role="option"] .wnd-SearchSelectItem-label`, `input[type="search"]`, `[aria-label="Transaction Table"]`, the `wnd-DataTableRow` class, and the `interactiveLink` child). If New Relic redesigns the transactions UI, any step may fail. Each step has its own timeout (15 s / 5 s+5 s+3 s / 8 s / 8 s) so a stale tab won't hang indefinitely.
- The detail panel's state UUID (`?state=<uuid>` in the URL) is session-tied server-side state in NR1 and **cannot be deep-linked across users or sessions** — that's why the extension goes through the four-step UI automation instead of synthesizing a `state` URL.
- Only when Chrome is the front app — same precondition as any Chrome-based hotkey extension.

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Toast: "User API key が未設定です" | No key saved in the popup | Save a User API key from the popup's API key panel |
| Toast: "NerdGraph HTTP 401/403" | Invalid key / Ingest key saved by mistake / insufficient scope | Reissue a User API key and save it |
| Toast: "SLI に紐づく APM エンティティが見つかりません" | SLI has no `nr.associatedEntityGuid` tag | Attach an APM service to the SLI in its source configuration |
| Stops at the overview (step: `view-full-table`) | NR DOM change — "View full table" element not found | Update the target text in the content script's `findByExactText` call |
| Stops at `step: filter-pill` / `filter-option` / `filter-confirm` | NR's Transaction type filter UI changed (pill / option / update propagation) | Revisit the selectors in `ensureTransactionTypeFilter` (`.common-filter-bar .wnd-Pill--clickable`, `[role="option"] .wnd-SearchSelectItem-label`) |
| Stops at `step: search-input` | Post "View full table" DOM change — `input[type="search"]` no longer matches | Update the selector in the content script |
| Stops at `step: filtered-row` | NRQL lacks a literal `name = '...'` / the search filter did not narrow the table / DataTable class names changed / cannot distinguish the Transaction Table from a sibling grid | Verify the SLI's NRQL, or update the `aria-label="Transaction Table"` / `.wnd-DataTableRow` / `.interactiveLink` selectors |

## Tech Stack

- TypeScript
- [WXT](https://wxt.dev/)
- Manifest V3
- Vitest (tests)
- Biome (lint/format)

## License

MIT.
