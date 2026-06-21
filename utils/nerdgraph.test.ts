import { describe, expect, it, vi } from "vitest";
import { fetchSliMetadata } from "./nerdgraph";

function makeFetch(body: unknown, _ok = true, status = 200): typeof fetch {
  return vi.fn(async () => {
    return new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }) as unknown as typeof fetch;
}

describe("fetchSliMetadata", () => {
  it("returns apmGuid and transactionName from a typical response", async () => {
    const body = {
      data: {
        actor: {
          entity: {
            tags: [{ key: "nr.associatedEntityGuid", values: ["APM_GUID"] }],
            serviceLevel: {
              indicators: [
                {
                  events: {
                    goodEvents: {
                      where:
                        "entityGuid = 'X'\nAND name = 'Controller/admin/create'\nAND duration < 20",
                    },
                    validEvents: { where: "entityGuid = 'X' AND name = 'Other'" },
                  },
                },
              ],
            },
          },
        },
      },
    };

    const result = await fetchSliMetadata("SLI_GUID", "key", makeFetch(body));
    expect(result).toEqual({
      apmGuid: "APM_GUID",
      transactionName: "Controller/admin/create",
    });
  });

  it("falls back to validEvents WHERE when goodEvents is missing", async () => {
    const body = {
      data: {
        actor: {
          entity: {
            tags: [{ key: "nr.associatedEntityGuid", values: ["APM_GUID"] }],
            serviceLevel: {
              indicators: [
                {
                  events: { validEvents: { where: "name = 'Fallback/Tx'" } },
                },
              ],
            },
          },
        },
      },
    };
    const result = await fetchSliMetadata("SLI_GUID", "key", makeFetch(body));
    expect(result.transactionName).toBe("Fallback/Tx");
  });

  it("returns null transactionName when WHERE has no name predicate", async () => {
    const body = {
      data: {
        actor: {
          entity: {
            tags: [{ key: "nr.associatedEntityGuid", values: ["APM"] }],
            serviceLevel: {
              indicators: [{ events: { goodEvents: { where: "duration < 1" } } }],
            },
          },
        },
      },
    };
    const { apmGuid, transactionName } = await fetchSliMetadata("SLI_GUID", "key", makeFetch(body));
    expect(apmGuid).toBe("APM");
    expect(transactionName).toBeNull();
  });

  it("returns null apmGuid when the associated tag is missing", async () => {
    const body = {
      data: {
        actor: {
          entity: {
            tags: [{ key: "owner", values: ["team"] }],
            serviceLevel: { indicators: [] },
          },
        },
      },
    };
    const { apmGuid } = await fetchSliMetadata("SLI_GUID", "key", makeFetch(body));
    expect(apmGuid).toBeNull();
  });

  it("throws when NerdGraph returns errors", async () => {
    const body = { errors: [{ message: "bad key" }] };
    await expect(fetchSliMetadata("SLI_GUID", "key", makeFetch(body))).rejects.toThrow(
      /NerdGraph: bad key/,
    );
  });

  it("throws when HTTP status is not OK", async () => {
    await expect(fetchSliMetadata("SLI_GUID", "key", makeFetch({}, false, 401))).rejects.toThrow(
      /HTTP 401/,
    );
  });

  it("throws when the entity is missing from the response", async () => {
    await expect(
      fetchSliMetadata("SLI_GUID", "key", makeFetch({ data: { actor: { entity: null } } })),
    ).rejects.toThrow(/Entity not found/);
  });
});
