import { env } from "../env.js";
import type { RawLead } from "../types.js";

type SearchInput = {
  niche: string;
  location: string;
  maxResults: number;
};

type ActorSpec = {
  actorId: string;
  channel: "google" | "yelp" | "linkedin" | "generic";
};

function toActorSpecs(): ActorSpec[] {
  const specs: ActorSpec[] = [];

  // If direct Google Maps API is configured, skip the Apify Google actor to avoid duplicate coverage.
  if (env.apifyGoogleMapsActorId && !env.googleMapsApiKey) {
    specs.push({ actorId: env.apifyGoogleMapsActorId, channel: "google" });
  }
  if (env.apifyYelpActorId) {
    specs.push({ actorId: env.apifyYelpActorId, channel: "yelp" });
  }
  if (env.apifyLinkedinActorId) {
    specs.push({ actorId: env.apifyLinkedinActorId, channel: "linkedin" });
  }

  if (specs.length === 0 && env.apifyActorId) {
    specs.push({ actorId: env.apifyActorId, channel: "generic" });
  }

  return specs;
}

function actorInput(input: SearchInput, channel: ActorSpec["channel"]) {
  const query = `${input.niche} ${input.location}`.trim();
  const maxItems = Math.max(1, Math.min(input.maxResults, 100));

  if (channel === "linkedin") {
    return {
      companyNames: [query],
      maxItems
    };
  }

  if (channel === "yelp") {
    return {
      search: query,
      location: input.location,
      maxResults: maxItems,
      maxItems
    };
  }

  return {
    searchStringsArray: [query],
    query,
    location: input.location,
    maxCrawledPlacesPerSearch: maxItems,
    maxItems
  };
}

async function runActorAndGetItems(spec: ActorSpec, input: SearchInput): Promise<Array<Record<string, unknown>>> {
  const endpoint = `https://api.apify.com/v2/acts/${encodeURIComponent(spec.actorId)}/run-sync-get-dataset-items`;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.apifyToken}`
    },
    body: JSON.stringify(actorInput(input, spec.channel))
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Apify ${spec.channel} actor failed (${res.status}): ${text.slice(0, 220)}`);
  }

  return (await res.json()) as Array<Record<string, unknown>>;
}

function toRawLead(item: Record<string, unknown>, spec: ActorSpec): RawLead {
  const website = String(item.website ?? item.web ?? item.businessWebsite ?? item.url ?? "");
  const linkedinWebsite = String(item.companyWebsite ?? item.websiteUrl ?? website);
  const email = String(item.email ?? item.primaryEmail ?? item.contactEmail ?? "");

  const name =
    String(item.title ?? item.name ?? item.companyName ?? item.businessName ?? "").trim() ||
    "Unknown business";

  const locationText =
    String(item.address ?? item.location ?? item.city ?? item.headquarter ?? "").trim() || "";

  const description =
    String(item.categoryName ?? item.description ?? item.industry ?? item.about ?? "").trim() || "";

  return {
    sourceName: "apify",
    externalId: String(item.placeId ?? item.id ?? item.companyId ?? ""),
    externalUrl: String(item.url ?? item.linkedinUrl ?? ""),
    name,
    email,
    phone: String(item.phone ?? item.displayPhone ?? ""),
    website: spec.channel === "linkedin" ? linkedinWebsite : website,
    locationText,
    description: spec.channel === "linkedin" ? `LinkedIn: ${description}` : description,
    raw: {
      ...item,
      _apifyChannel: spec.channel,
      _apifyActorId: spec.actorId
    }
  };
}

export async function fetchApifyLeads(input: SearchInput): Promise<RawLead[]> {
  if (!env.apifyToken) {
    throw new Error("APIFY_TOKEN is missing.");
  }

  const specs = toActorSpecs();
  if (specs.length === 0) {
    throw new Error("No Apify actor IDs configured. Set APIFY_YELP_ACTOR_ID, APIFY_LINKEDIN_ACTOR_ID, or APIFY_ACTOR_ID.");
  }

  const merged: RawLead[] = [];

  for (const spec of specs) {
    const items = await runActorAndGetItems(spec, input);
    merged.push(...items.map((item) => toRawLead(item, spec)));
  }

  const seen = new Set<string>();
  const deduped: RawLead[] = [];
  for (const lead of merged) {
    const key = `${lead.name.toLowerCase()}|${(lead.website ?? "").toLowerCase()}|${(lead.email ?? "").toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(lead);
  }

  return deduped.slice(0, Math.max(1, Math.min(input.maxResults, 500)));
}
