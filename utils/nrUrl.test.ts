import { describe, expect, it } from "vitest";
import { accountIdFromEntityGuid, buildApmTransactionsUrl, parseSloUrl } from "./nrUrl";

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

  it("falls back to account encoded in the SLI GUID when query param is missing", () => {
    // base64("3271041|EXT|SERVICE_LEVEL|2260257")
    const url =
      "https://one.newrelic.com/nr1-core/service-levels-management/summary/MzI3MTA0MXxFWFR8U0VSVklDRV9MRVZFTHwyMjYwMjU3?duration=604800000&state=8f3413b4-5edc-5a7f-b64e-298041154635";
    const parsed = parseSloUrl(url);
    expect(parsed?.account).toBe("3271041");
  });

  it("prefers the explicit ?account= over the GUID-encoded account", () => {
    // GUID encodes 3271041, but the URL says 9999999.
    const url =
      "https://one.newrelic.com/nr1-core/service-levels-management/summary/MzI3MTA0MXxFWFR8U0VSVklDRV9MRVZFTHwyMjYwMjU3?account=9999999";
    expect(parseSloUrl(url)?.account).toBe("9999999");
  });

  it("returns empty string for account when neither the URL nor the GUID encodes one", () => {
    const url =
      "https://one.newrelic.com/nr1-core/service-levels-management/summary/not-a-base64-guid?duration=86400000";
    expect(parseSloUrl(url)?.account).toBe("");
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

describe("accountIdFromEntityGuid", () => {
  it("extracts the numeric account id from a standard base64 GUID", () => {
    // base64("3271041|EXT|SERVICE_LEVEL|2260257")
    expect(accountIdFromEntityGuid("MzI3MTA0MXxFWFR8U0VSVklDRV9MRVZFTHwyMjYwMjU3")).toBe("3271041");
  });

  it("handles URL-safe base64 variants (- and _)", () => {
    // Encode "12345|APM|APPLICATION|99" then swap any +/ for -_ to mimic URL-safe form.
    const stdBase64 = btoa("12345|APM|APPLICATION|99");
    const urlSafe = stdBase64.replace(/\+/g, "-").replace(/\//g, "_");
    expect(accountIdFromEntityGuid(urlSafe)).toBe("12345");
  });

  it("returns empty string when the GUID is not base64 decodable", () => {
    expect(accountIdFromEntityGuid("not!base64@@@")).toBe("");
  });

  it("returns empty string when the decoded first segment is not numeric", () => {
    // base64("NOT_A_NUMBER|EXT|SERVICE_LEVEL|1")
    const guid = btoa("NOT_A_NUMBER|EXT|SERVICE_LEVEL|1");
    expect(accountIdFromEntityGuid(guid)).toBe("");
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
