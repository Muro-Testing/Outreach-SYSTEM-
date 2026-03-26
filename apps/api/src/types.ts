export type SourceName = "google" | "yelp" | "apify";

export type RawLead = {
  sourceName: SourceName;
  matchedKeyword?: string | null;
  externalId?: string;
  externalUrl?: string;
  name: string;
  email?: string;
  description?: string;
  locationText?: string;
  phone?: string;
  website?: string;
  raw: Record<string, unknown>;
};

export type NormalizedLead = {
  name: string;
  email: string | null;
  whatTheyDoSummary: string | null;
  locationText: string | null;
  phone: string | null;
  website: string | null;
  websiteDomain: string | null;
};

export type EnrichmentResult = {
  email: string | null;
  summary: string | null;
  highlights: string | null;
  pagesCrawled: number;
};

export type RunCounters = {
  totalCandidates: number;
  insertedCount: number;
  updatedCount: number;
  dedupedCount: number;
  rejectedNoEmailCount: number;
};
