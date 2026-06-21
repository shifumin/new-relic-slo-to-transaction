const TRANSACTION_NAME_REGEX = /\bname\s*=\s*'([^']+)'/i;

/**
 * Extract a transaction name from an SLI events WHERE clause.
 *
 * Looks for a literal `name = '...'` predicate. Returns the unescaped string,
 * or null if no literal match is present (e.g. `name LIKE '%...%'`).
 */
export function extractTransactionName(whereClause: string | null | undefined): string | null {
  if (!whereClause) return null;
  const match = TRANSACTION_NAME_REGEX.exec(whereClause);
  return match ? match[1] : null;
}

export type TransactionType = "Web" | "Non-web";

/**
 * Infer the NR APM "Transaction type" filter value from a Rails-style
 * transaction name. Names starting with `OtherTransaction/` (Sidekiq,
 * background jobs, rake tasks, etc.) are Non-web; everything else
 * (`Controller/...`, `WebTransaction/...`, anonymous) defaults to Web,
 * which is the NR APM transactions table default filter.
 */
export function inferTransactionType(name: string): TransactionType {
  return name.startsWith("OtherTransaction/") ? "Non-web" : "Web";
}
