import { env } from "../env.js";
import type { RawLead } from "../types.js";

type SearchInput = {
  niche: string;
  subNiche: string;
  location: string;
  maxResults: number;
  assertActive?: () => Promise<void>;
  fetchDeadlineAt?: number;
  onPlaceProcessed?: (input: {
    keyword: string;
    index: number;
    total: number;
    name: string;
    website?: string;
    email?: string;
  }) => Promise<void> | void;
};

const GOOGLE_FETCH_TIMEOUT_MS = 15000;

export class GoogleKeywordFetchTimeoutError extends Error {
  keyword: string;

  constructor(keyword: string) {
    super(`Google fetch timed out for keyword "${keyword}".`);
    this.name = "GoogleKeywordFetchTimeoutError";
    this.keyword = keyword;
  }
}

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

async function assertFetchStageActive(input: SearchInput): Promise<void> {
  await input.assertActive?.();
  if (input.fetchDeadlineAt && Date.now() > input.fetchDeadlineAt) {
    throw new GoogleKeywordFetchTimeoutError(input.niche);
  }
}

async function fetchPlaceDetails(placeId: string): Promise<GooglePlaceDetailsResponse["result"]> {
  const fields = encodeURIComponent("website,url,formatted_phone_number,formatted_address,types");
  const endpoint =
    `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}` +
    `&fields=${fields}&key=${env.googleMapsApiKey}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GOOGLE_FETCH_TIMEOUT_MS);
  const res = await fetch(endpoint, { signal: controller.signal }).finally(() => clearTimeout(timer));
  if (!res.ok) {
    throw new Error(`Google details fetch failed: ${res.status}`);
  }
  const data = (await res.json()) as GooglePlaceDetailsResponse;
  if (data.status && data.status !== "OK" && data.status !== "ZERO_RESULTS") {
    throw new Error(`Google details error: ${data.status}${data.error_message ? ` - ${data.error_message}` : ""}`);
  }
  return data.result;
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
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GOOGLE_FETCH_TIMEOUT_MS);
  const res = await fetch(endpoint, { signal: controller.signal }).finally(() => clearTimeout(timer));
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
    signal: AbortSignal.timeout(GOOGLE_FETCH_TIMEOUT_MS),
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
  await assertFetchStageActive(input);
  const maxResults = Math.max(1, Math.min(input.maxResults, 60));
  const merged: NonNullable<GoogleTextSearchResponse["results"]> = [];

  let page = await fetchPage(input);
  merged.push(...(page.results ?? []));

  while (merged.length < maxResults && page.next_page_token) {
    await assertFetchStageActive(input);
    let nextPage: GoogleTextSearchResponse | null = null;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      await assertFetchStageActive(input);
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

  await assertFetchStageActive(input);
  const results = await fetchGoogleTextSearchResults(input);

  const leads = await mapLimit(results, 8, async (item, itemIndex) => {
    await assertFetchStageActive(input);
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

    await input.onPlaceProcessed?.({
      keyword: input.niche,
      index: itemIndex + 1,
      total: results.length,
      name: String(item.name ?? "Unknown business"),
      website: website || undefined
    });

    return {
      sourceName: "google" as const,
      matchedKeyword: input.niche,
      externalId: placeId,
      externalUrl: placeId
        ? `https://www.google.com/maps/place/?q=place_id:${placeId}`
        : undefined,
      name: String(item.name ?? "Unknown business"),
      email: undefined,
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
  const allLeads: RawLead[] = [];

  for (const keyword of keywords) {
    const leads = await fetchGoogleLeadsForKeyword({
      ...input,
      niche: keyword
    });
    allLeads.push(...leads);
  }

  return allLeads;
}
