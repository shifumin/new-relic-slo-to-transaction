# CLAUDE.md

## Project Overview

New Relic SLO → APM Transaction — A Chrome extension that jumps from a New Relic SLO summary page to the APM transaction detail panel the SLI monitors, in one keyboard shortcut.

**Tech Stack**: TypeScript, [WXT](https://wxt.dev/) (Manifest V3), Vitest, [Biome](https://biomejs.dev/) (linter/formatter)

## Architecture

```
entrypoints/
├── background.ts                   # Service worker: command handler, NerdGraph fetch, new tab + message
├── transactions.content.ts         # Content script on APM transactions pages: receives target name, clicks row
└── popup/
    ├── index.html                  # Popup HTML
    ├── main.ts                     # Popup UI: page-status, jump button, API key config, shortcut display
    └── style.css                   # Popup styles (light/dark mode)
utils/
├── nrUrl.ts                        # Parse SLO summary URL, build APM transactions URL
├── nrUrl.test.ts
├── nrql.ts                         # Extract transaction name from SLI events WHERE clause; infer Web/Non-web transaction type
├── nrql.test.ts
├── nerdgraph.ts                    # NerdGraph fetch (SLI metadata)
├── nerdgraph.test.ts
├── clicker.ts                      # DOM helpers: findByExactText, setReactInputValue, waitFor, isVisible
└── clicker.test.ts
public/icon/                        # Extension icons (16–128px)
```

- Path alias: `@/` → project root
- WXT global functions (`defineBackground`, `defineContentScript`, `browser`, etc.) do not need to be imported

## End-to-end Flow

1. User presses keyboard shortcut on an SLO summary page.
2. `background.ts` reads the active tab URL, parses SLI GUID + account + duration.
3. Calls NerdGraph with the stored User API key:
   - Reads `nr.associatedEntityGuid` tag → APM entity GUID
   - Reads `serviceLevel.indicators[0].events.{goodEvents,validEvents}.where` → extracts transaction name via regex `/name\s*=\s*'([^']+)'/i`
4. Opens APM transactions page for that APM entity in a new tab.
5. After the new tab finishes loading (`tabs.onUpdated` with `status === "complete"`), `background.ts` sends a `clickTransaction` message with the transaction name.
6. `transactions.content.ts` runs a four-step UI automation chain:
   1. `waitFor` + `findByExactText("View full table")` → click. This expands the "Top 20 transactions" widget into the full transactions table. Timeout 15 s.
   2. `ensureTransactionTypeFilter(inferTransactionType(name))` syncs the "Transaction type" filter pill in `.common-filter-bar` with what the SLI's transaction needs. `OtherTransaction/...` (Sidekiq, background jobs) requires the `Non-web` option; everything else stays `Web`. If the pill text already matches `=<want>`, no-op. Otherwise click the pill, wait for an `[role="option"]` whose `.wnd-SearchSelectItem-label` text equals `Web`/`Non-web`, click it, and wait for the pill text to update. Timeouts: 5 s + 5 s + 3 s.
   3. `waitFor(input[type="search"])` → `setReactInputValue(input, name)`. The native `HTMLInputElement.value` setter is used so React's internal value-tracker sees the change; `input` + `change` events are dispatched. Timeout 8 s.
   4. `waitFor` until the **`[aria-label="Transaction Table"]` grid** contains exactly one `[role="row"].wnd-DataTableRow`, then click its `.interactiveLink` child. The grid scope is critical — a sibling `[aria-label="Breakdown table"]` shares the same row class and would otherwise inflate the row count for non-web jobs with segment breakdowns. NR's table search performs substring matching that accepts the full NRQL name (`Controller/...`, `OtherTransaction/...`). Timeout 8 s.
7. Failure paths surface differently:
   - `background.ts` errors (no API key, NerdGraph error, missing APM GUID, missing transaction name) inject an in-page toast on the SLO tab via `scripting.executeScript`.
   - `transactions.content.ts` step failures return `{ ok: false, step: ... }` to the background via `sendResponse`; the user sees the new tab stuck on the overview / full-table state. No clipboard fallback at present.

## Development Commands

```bash
mise exec -- pnpm dev        # Start dev server (hot reload)
mise exec -- pnpm build      # Production build (output: .output/chrome-mv3)
mise exec -- pnpm compile    # Type check (tsc --noEmit)
mise exec -- pnpm lint       # Lint and format check (Biome)
mise exec -- pnpm lint:fix   # Lint and format with auto-fix
mise exec -- pnpm test       # Run tests (Vitest)
mise exec -- pnpm zip        # Create ZIP for Chrome Web Store
```

## Testing Conventions

- **Framework**: Vitest
- **Location**: Place `*.test.ts` in the same directory as the test target
- **Structure**: Group with `describe`, cover normal cases, error cases, and edge cases
- **Scope**: Only test public functions (private methods are out of scope)

## Code Conventions

- TypeScript strict mode
- Prefer arrow functions
- Naming: camelCase (variables/functions), PascalCase (types), kebab-case (CSS classes)

## Invariants Not Obvious From Code

- **NerdGraph US region hardcoded** (`https://api.newrelic.com/graphql`). For EU, change `NERDGRAPH_ENDPOINT` in `utils/nerdgraph.ts`.
- **Transaction-name extraction depends on the SLI being defined with a literal `name = '...'` predicate.** SLIs defined with `name LIKE`, regex, or other patterns will open the transactions list but cannot auto-fill the search; the chain stops with a `filtered-row` failure.
- **Transaction type (`Web` vs `Non-web`) is inferred from the name prefix**, not from the NRQL. `OtherTransaction/` → `Non-web`; everything else → `Web`. This matches NR's own classification and works for Rails (`Controller/...`), Sinatra/Rack (`WebTransaction/...`), and Sidekiq/background jobs (`OtherTransaction/SidekiqJob/...`). The NR APM Transactions full table only shows one type at a time, so the wrong filter means the search returns zero rows and `filtered-row` times out.
- **The Transaction Table row selector MUST scope to `[aria-label="Transaction Table"]`**. NR renders a sibling `[aria-label="Breakdown table"]` (segment breakdown for the focused transaction) that uses the same `.wnd-DataTableRow` class. For non-web jobs with external service segments, the unscoped query returned 5 rows instead of 1, breaking the "exactly one row" check.
- **The state UUID in NR's APM transactions URL (`?state=<uuid>`) is server-side session state** and cannot be deep-linked across sessions or users. NR auto-rewrites the URL to a fresh state UUID per page load. The extension therefore does NOT pass `state` in the URL; instead, the three-step UI automation drives NR to the detail view through real DOM interactions, and NR generates the correct `state` server-side on each step.
- **`findByExactText` prefers `cursor: pointer` over leaf-most matches.** NR1 wraps clickable spans in non-interactive parent spans whose `textContent` also equals the target. Picking the wrapper means `.click()` fires on an element with no React `onClick` handler. The helper deliberately scans all matches and prefers a pointer-cursor element.
- **`setReactInputValue` invokes the native `HTMLInputElement.value` setter** (via `Object.getOwnPropertyDescriptor`). Just assigning `input.value = "..."` does NOT trigger React's internal value tracker, so the search box doesn't filter.
- **User API key is stored in `browser.storage.local`** (persistent). It is required because NR's `/graphql` rejects cookie-only auth from non-NR1 clients — NR1 UI itself authenticates via a Service-Worker-injected bouncer header that extension code cannot replicate.
- **Content script matches** are scoped to `https://one.newrelic.com/nr1-core/apm-features/transactions/*`; the matcher includes the tab opened by the extension.
