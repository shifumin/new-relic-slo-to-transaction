import { describe, expect, it } from "vitest";
import { extractTransactionName, inferTransactionType } from "./nrql";

describe("extractTransactionName", () => {
  it("extracts a transaction name from a multi-condition WHERE clause", () => {
    const where = `entityGuid = 'GUID'
AND name = 'Controller/admin/workflow_templates/create'
AND duration < 20
`;
    expect(extractTransactionName(where)).toBe("Controller/admin/workflow_templates/create");
  });

  it("handles a single-condition WHERE clause", () => {
    expect(extractTransactionName("name = 'WebTransaction/Rack/path'")).toBe(
      "WebTransaction/Rack/path",
    );
  });

  it("is case-insensitive on the `name` keyword", () => {
    expect(extractTransactionName("NAME = 'X'")).toBe("X");
  });

  it("returns null when the WHERE clause uses LIKE (no literal equality)", () => {
    expect(extractTransactionName("name LIKE '%Controller%'")).toBeNull();
  });

  it("returns null when there is no name predicate", () => {
    expect(extractTransactionName("entityGuid = 'X' AND duration < 1")).toBeNull();
  });

  it("returns null for an empty or nullish input", () => {
    expect(extractTransactionName("")).toBeNull();
    expect(extractTransactionName(null)).toBeNull();
    expect(extractTransactionName(undefined)).toBeNull();
  });

  it("does not confuse attribute names that end in `name`", () => {
    // appName = 'foo' should not match as transaction name 'foo'.
    expect(extractTransactionName("appName = 'foo'")).toBeNull();
  });
});

describe("inferTransactionType", () => {
  it("classifies OtherTransaction/Sidekiq jobs as Non-web", () => {
    expect(inferTransactionType("OtherTransaction/SidekiqJob/Foo::Bar/perform")).toBe("Non-web");
  });

  it("classifies OtherTransaction/Background jobs as Non-web", () => {
    expect(inferTransactionType("OtherTransaction/Background/MyJob")).toBe("Non-web");
  });

  it("classifies Rails Controller routes as Web", () => {
    expect(inferTransactionType("Controller/admin/workflow_templates/create")).toBe("Web");
  });

  it("classifies WebTransaction/Rack paths as Web", () => {
    expect(inferTransactionType("WebTransaction/Rack/health")).toBe("Web");
  });

  it("defaults to Web for unknown prefixes", () => {
    expect(inferTransactionType("CustomNamespace/foo")).toBe("Web");
  });

  it("defaults to Web for empty input", () => {
    expect(inferTransactionType("")).toBe("Web");
  });
});
