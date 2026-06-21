import { describe, expect, it } from "vitest";
import { buildApmTransactionsUrl, parseSloUrl } from "./nrUrl";

describe("parseSloUrl", () => {
  it("parses a typical SLO summary URL with account and duration", () => {
    const url =
      "https://one.newrelic.com/nr1-core/service-levels-management/summary/MzI3MTA0MXxFWFR8U0VSVklDRV9MRVZFTHw5MDg2Mjk?account=3271041&duration=604800000";
    expect(parseSloUrl(url)).toEqual({
      sliGuid: "MzI3MTA0MXxFWFR8U0VSVklDRV9MRVZFTHw5MDg2Mjk",
      account: "3271041",
      duration: "604800000",
    });
  });

  it("falls back to 7-day default duration when none is in the URL", () => {
    const url =
      "https://one.newrelic.com/nr1-core/service-levels-management/summary/SOME_GUID?account=42";
    const parsed = parseSloUrl(url);
    expect(parsed?.duration).toBe("604800000");
  });

  it("returns empty string for account when missing", () => {
    const url =
      "https://one.newrelic.com/nr1-core/service-levels-management/summary/SOME_GUID?duration=86400000";
    const parsed = parseSloUrl(url);
    expect(parsed?.account).toBe("");
  });

  it("returns null for a non-SLO URL", () => {
    expect(parseSloUrl("https://example.com/foo")).toBeNull();
  });

  it("returns null for an APM transactions URL", () => {
    expect(
      parseSloUrl("https://one.newrelic.com/nr1-core/apm-features/transactions/GUID?account=1"),
    ).toBeNull();
  });

  it("returns null for an invalid URL string", () => {
    expect(parseSloUrl("not a url")).toBeNull();
  });

  it("ignores additional path segments and fragments", () => {
    const url =
      "https://one.newrelic.com/nr1-core/service-levels-management/summary/GUID/details?account=1&duration=1#abc";
    expect(parseSloUrl(url)?.sliGuid).toBe("GUID");
  });
});

describe("buildApmTransactionsUrl", () => {
  it("builds a transactions URL with the given GUID, account, and duration", () => {
    expect(buildApmTransactionsUrl("APM_GUID", "42", "604800000")).toBe(
      "https://one.newrelic.com/nr1-core/apm-features/transactions/APM_GUID?account=42&duration=604800000",
    );
  });

  it("URL-encodes special characters in query parameters", () => {
    expect(buildApmTransactionsUrl("APM_GUID", "a b", "1")).toContain("account=a+b");
  });
});
