const SLO_URL_REGEX = /\/nr1-core\/service-levels-management\/summary\/(?<guid>[^/?#]+)/;
const DEFAULT_DURATION_MS = "604800000";

export type ParsedSloUrl = {
  sliGuid: string;
  account: string;
  duration: string;
};

export function parseSloUrl(url: string): ParsedSloUrl | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const match = SLO_URL_REGEX.exec(parsed.pathname);
  if (!match?.groups?.guid) return null;
  const sliGuid = match.groups.guid;
  return {
    sliGuid,
    account: parsed.searchParams.get("account") || accountIdFromEntityGuid(sliGuid),
    duration: parsed.searchParams.get("duration") ?? DEFAULT_DURATION_MS,
  };
}

// New Relic entity GUIDs are base64 of `accountId|domain|type|entityId`.
// When the SLO URL omits `?account=...` (e.g. landed from a permalink with
// only `?duration=` and `?state=`), fall back to the accountId encoded in
// the SLI GUID itself.
export function accountIdFromEntityGuid(guid: string): string {
  try {
    const normalized = guid.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = atob(normalized);
    const accountId = decoded.split("|")[0] ?? "";
    return /^\d+$/.test(accountId) ? accountId : "";
  } catch {
    return "";
  }
}

export function buildApmTransactionsUrl(
  apmGuid: string,
  account: string,
  duration: string,
): string {
  const params = new URLSearchParams({ account, duration });
  return `https://one.newrelic.com/nr1-core/apm-features/transactions/${apmGuid}?${params.toString()}`;
}
