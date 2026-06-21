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
  return {
    sliGuid: match.groups.guid,
    account: parsed.searchParams.get("account") ?? "",
    duration: parsed.searchParams.get("duration") ?? DEFAULT_DURATION_MS,
  };
}

export function buildApmTransactionsUrl(
  apmGuid: string,
  account: string,
  duration: string,
): string {
  const params = new URLSearchParams({ account, duration });
  return `https://one.newrelic.com/nr1-core/apm-features/transactions/${apmGuid}?${params.toString()}`;
}
