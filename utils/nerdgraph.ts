import { extractTransactionName } from "./nrql";

const NERDGRAPH_ENDPOINT = "https://api.newrelic.com/graphql";
const ASSOCIATED_ENTITY_TAG_KEY = "nr.associatedEntityGuid";

export type SliMetadata = {
  apmGuid: string | null;
  transactionName: string | null;
};

type EntityTag = { key: string; values: string[] };
type EventsQuery = { where: string | null };
type IndicatorEvents = {
  goodEvents?: EventsQuery | null;
  validEvents?: EventsQuery | null;
};
type Indicator = { events?: IndicatorEvents | null };
type Entity = {
  tags?: EntityTag[] | null;
  serviceLevel?: { indicators?: Indicator[] | null } | null;
};
type NerdGraphResponse = {
  data?: { actor?: { entity?: Entity | null } | null } | null;
  errors?: { message: string }[];
};

export async function fetchSliMetadata(
  sliGuid: string,
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<SliMetadata> {
  const query = `{
    actor {
      entity(guid: "${sliGuid}") {
        tags { key values }
        ... on ExternalEntity {
          serviceLevel {
            indicators {
              events {
                goodEvents { where }
                validEvents { where }
              }
            }
          }
        }
      }
    }
  }`;

  const res = await fetchImpl(NERDGRAPH_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "API-Key": apiKey,
    },
    body: JSON.stringify({ query }),
  });

  if (!res.ok) {
    throw new Error(`NerdGraph HTTP ${res.status}`);
  }

  const json = (await res.json()) as NerdGraphResponse;
  if (json.errors?.length) {
    throw new Error(`NerdGraph: ${json.errors[0].message}`);
  }
  const entity = json.data?.actor?.entity;
  if (!entity) {
    throw new Error("Entity not found");
  }

  const tag = entity.tags?.find((t) => t.key === ASSOCIATED_ENTITY_TAG_KEY);
  const apmGuid = tag?.values?.[0] ?? null;

  const indicator = entity.serviceLevel?.indicators?.[0];
  const where =
    indicator?.events?.goodEvents?.where ?? indicator?.events?.validEvents?.where ?? null;
  const transactionName = extractTransactionName(where);

  return { apmGuid, transactionName };
}
