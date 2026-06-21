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
