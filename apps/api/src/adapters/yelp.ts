import { env } from "../env.js";
import type { RawLead } from "../types.js";

type SearchInput = {
  niche: string;
  location: string;
  maxResults: number;
};

type YelpBusiness = {
  id?: string;
  url?: string;
  name?: string;
  display_phone?: string;
  location?: { display_address?: string[] };
  categories?: Array<{ title?: string }>;
  [key: string]: unknown;
};

export async function fetchYelpLeads(input: SearchInput): Promise<RawLead[]> {
  if (!env.yelpApiKey) {
    throw new Error("YELP_API_KEY is missing.");
  }

  const limit = Math.max(1, Math.min(input.maxResults, 50));

  const params = new URLSearchParams({
    term: input.niche,
    location: input.location,
    limit: String(limit)
  });
  const res = await fetch(`https://api.yelp.com/v3/businesses/search?${params.toString()}`, {
    headers: { Authorization: `Bearer ${env.yelpApiKey}` }
  });

  if (!res.ok) throw new Error(`Yelp fetch failed: ${res.status}`);
  const data = (await res.json()) as { businesses?: YelpBusiness[] };

  return (data.businesses ?? []).slice(0, limit).map((item) => ({
    sourceName: "yelp",
    externalId: String(item.id ?? ""),
    externalUrl: String(item.url ?? ""),
    name: String(item.name ?? "Unknown business"),
    phone: String(item.display_phone ?? ""),
    website: String(item.url ?? ""),
    locationText: Array.isArray(item.location?.display_address)
      ? item.location?.display_address.join(", ")
      : "",
    description: Array.isArray(item.categories)
      ? item.categories.map((c) => c.title).filter(Boolean).join(", ")
      : "",
    raw: item as Record<string, unknown>
  }));
}
