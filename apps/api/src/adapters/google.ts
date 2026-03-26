import { env } from "../env.js";
import { crawlWebsiteForContactData } from "../services/crawler.js";
import { normalizeBusinessEmail } from "../services/email.js";
import type { RawLead } from "../types.js";

type SearchInput = {
  niche: string;
  subNiche: string;
  location: string;
  maxResults: number;
};

type GoogleTextSearchResponse = {
  status?: string;
  error_message?: string;
  next_page_token?: string;
  results?: Array<{
    place_id?: string;
    name?: string;
    formatted_address?: string;
    types?: string[];
  }>;
};

type GoogleTextSearchV1Response = {
  nextPageToken?: string;
  places?: Array<{
    id?: string;
    displayName?: {
      text?: string;
    };
    formattedAddress?: string;
    types?: string[];
  }>;
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
};

type GooglePlaceDetailsResponse = {
  status?: string;
  error_message?: string;
  result?: {
    website?: string;
    url?: string;
    formatted_phone_number?: string;
    formatted_address?: string;
    types?: string[];
  };
};

async function mapLimit<T, R>(items: T[], limit: number, mapper: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;

  async function worker() {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      results[index] = await mapper(items[index], index);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

async function fetchPlaceDetails(placeId: string): Promise<GooglePlaceDetailsResponse["result"]> {
  const fields = encodeURIComponent("website,url,formatted_phone_number,formatted_address,types");
  const endpoint =
    `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}` +
    `&fields=${fields}&key=${env.googleMapsApiKey}`;
  const res = await fetch(endpoint);
  if (!res.ok) {
    throw new Error(`Google details fetch failed: ${res.status}`);
  }
  const data = (await res.json()) as GooglePlaceDetailsResponse;
  if (data.status && data.status !== "OK" && data.status !== "ZERO_RESULTS") {
    throw new Error(`Google details error: ${data.status}${data.error_message ? ` - ${data.error_message}` : ""}`);
  }
  return data.result;
}

async function extractEmailFromWebsite(website?: string): Promise<string | undefined> {
  if (!website) return undefined;

  try {
    const crawl = await crawlWebsiteForContactData(website, {
      maxPages: 12,
      maxDepth: 2,
      timeoutMs: 12000
    });

    const email = normalizeBusinessEmail(crawl.emails[0] ?? "");
    return email ?? undefined;
  } catch {
    return undefined;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildSearchQuery(input: SearchInput): string {
  const parts = [input.niche, input.subNiche, input.location]
    .map((value) => value.trim())
    .filter(Boolean);

  const query = parts.join(" ");
  if (!query) {
    throw new Error("Google text search requires at least one non-empty search term.");
  }

  return query;
}

function isPendingPageTokenError(message?: string): boolean {
  return (message ?? "").toLowerCase().includes("page token");
}

async function fetchGoogleTextSearchLegacyPage(input: SearchInput, pageToken?: string): Promise<GoogleTextSearchResponse> {
  const params = new URLSearchParams({
    key: env.googleMapsApiKey
  });

  if (pageToken) {
    params.set("pagetoken", pageToken);
  } else {
    params.set("query", buildSearchQuery(input));
  }

  const endpoint = `https://maps.googleapis.com/maps/api/place/textsearch/json?${params.toString()}`;
  const res = await fetch(endpoint);
  if (!res.ok) throw new Error(`Google fetch failed: ${res.status}`);

  const data = (await res.json()) as GoogleTextSearchResponse;
  if (
    pageToken &&
    data.status === "INVALID_REQUEST" &&
    (data.error_message ?? "").toLowerCase().includes("next_page_token")
  ) {
    return data;
  }

  if (data.status && data.status !== "OK" && data.status !== "ZERO_RESULTS") {
    throw new Error(`Google text search error: ${data.status}${data.error_message ? ` - ${data.error_message}` : ""}`);
  }

  return data;
}

async function fetchGoogleTextSearchV1Page(input: SearchInput, pageToken?: string): Promise<GoogleTextSearchResponse> {
  const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": env.googleMapsApiKey,
      "X-Goog-FieldMask": "places.id,places.displayName.text,places.formattedAddress,places.types,nextPageToken"
    },
    body: JSON.stringify({
      textQuery: buildSearchQuery(input),
      pageSize: Math.max(1, Math.min(input.maxResults, 20)),
      ...(pageToken ? { pageToken } : {})
    })
  });

  const data = (await response.json()) as GoogleTextSearchV1Response;
  if (!response.ok) {
    const message = data.error?.message ?? `Google fetch failed: ${response.status}`;
    throw new Error(`Google text search error: ${data.error?.status ?? response.status}${message ? ` - ${message}` : ""}`);
  }

  if (data.error) {
    if (pageToken && isPendingPageTokenError(data.error.message)) {
      return {
        status: "INVALID_REQUEST",
        error_message: data.error.message
      };
    }

    throw new Error(
      `Google text search error: ${data.error.status ?? "UNKNOWN"}${data.error.message ? ` - ${data.error.message}` : ""}`
    );
  }

  return {
    status: data.places?.length ? "OK" : "ZERO_RESULTS",
    next_page_token: data.nextPageToken,
    results: (data.places ?? []).map((place) => ({
      place_id: place.id,
      name: place.displayName?.text,
      formatted_address: place.formattedAddress,
      types: place.types
    }))
  };
}

async function fetchGoogleTextSearchResultsFrom(
  input: SearchInput,
  fetchPage: (input: SearchInput, pageToken?: string) => Promise<GoogleTextSearchResponse>
): Promise<NonNullable<GoogleTextSearchResponse["results"]>> {
  const maxResults = Math.max(1, Math.min(input.maxResults, 60));
  const merged: NonNullable<GoogleTextSearchResponse["results"]> = [];

  let page = await fetchPage(input);
  merged.push(...(page.results ?? []));

  while (merged.length < maxResults && page.next_page_token) {
    let nextPage: GoogleTextSearchResponse | null = null;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      await sleep(1800 + attempt * 400);
      const candidate = await fetchPage(input, page.next_page_token);
      if (candidate.status !== "INVALID_REQUEST") {
        nextPage = candidate;
        break;
      }
    }

    if (!nextPage || nextPage.status === "INVALID_REQUEST") {
      break;
    }

    page = nextPage;
    merged.push(...(page.results ?? []));
  }

  return merged.slice(0, maxResults);
}

async function fetchGoogleTextSearchResults(input: SearchInput): Promise<NonNullable<GoogleTextSearchResponse["results"]>> {
  let newApiError: Error | null = null;

  try {
    return await fetchGoogleTextSearchResultsFrom(input, fetchGoogleTextSearchV1Page);
  } catch (err) {
    newApiError = err instanceof Error ? err : new Error("Google text search failed via Places API v1.");
  }

  try {
    return await fetchGoogleTextSearchResultsFrom(input, fetchGoogleTextSearchLegacyPage);
  } catch (legacyErr) {
    const legacyMessage = legacyErr instanceof Error ? legacyErr.message : "Unknown legacy Google text search error.";
    throw new Error(`${newApiError.message} | Legacy fallback failed: ${legacyMessage}`);
  }
}

export async function fetchGoogleLeadsForKeyword(input: SearchInput): Promise<RawLead[]> {
  if (!env.googleMapsApiKey) {
    throw new Error("GOOGLE_MAPS_API_KEY is missing.");
  }

  const results = await fetchGoogleTextSearchResults(input);

  const leads = await mapLimit(results, 8, async (item) => {
    const placeId = String(item.place_id ?? "");
    let details: GooglePlaceDetailsResponse["result"] | undefined;

    if (placeId) {
      try {
        details = await fetchPlaceDetails(placeId);
      } catch {
        details = undefined;
      }
    }

    const website = String(details?.website ?? "");
    const email = await extractEmailFromWebsite(website);

    return {
      sourceName: "google" as const,
      externalId: placeId,
      externalUrl: placeId
        ? `https://www.google.com/maps/place/?q=place_id:${placeId}`
        : undefined,
      name: String(item.name ?? "Unknown business"),
      email,
      phone: String(details?.formatted_phone_number ?? ""),
      website,
      description: String(details?.types ? details.types.join(", ") : item.types ? item.types.join(", ") : "Local business"),
      locationText: String(details?.formatted_address ?? item.formatted_address ?? ""),
      raw: {
        ...item,
        details: details ?? null
      }
    };
  });

  return leads;
}

export async function fetchGoogleLeads(input: SearchInput & { allKeywords?: string[] }): Promise<RawLead[]> {
  if (!env.googleMapsApiKey) {
    throw new Error("GOOGLE_MAPS_API_KEY is missing.");
  }

  const keywords = input.allKeywords && input.allKeywords.length > 0
    ? input.allKeywords
    : [input.niche];

  // Run one search per keyword, collecting all place_ids to deduplicate
  const seenPlaceIds = new Set<string>();
  const allLeads: RawLead[] = [];

  for (const keyword of keywords) {
    const keywordInput: SearchInput = { ...input, niche: keyword };
    const leads = await fetchGoogleLeadsForKeyword(keywordInput);
    for (const lead of leads) {
      const id = String(lead.externalId ?? "");
      if (id && seenPlaceIds.has(id)) continue;
      if (id) seenPlaceIds.add(id);
      allLeads.push(lead);
    }
  }

  return allLeads;
}

