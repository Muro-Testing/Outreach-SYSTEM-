import { crawlWebsiteForContactData } from "./crawler.js";
import type { CrawlResult } from "./crawler.js";
import { summarizeBusinessWithMistral } from "./ai.js";
import { normalizeBusinessEmail } from "./email.js";
import type { EnrichmentResult } from "../types.js";

export async function enrichBusinessFromWebsite(input: {
  name: string;
  website: string | null;
  existingEmail: string | null;
  existingSummary: string | null;
}, prefetchedCrawl?: CrawlResult | null): Promise<EnrichmentResult | null> {
  if (!input.website) return null;

  const crawl = prefetchedCrawl ?? await crawlWebsiteForContactData(input.website, { maxPages: 8, maxDepth: 2 });

  const chosenEmail = normalizeBusinessEmail(input.existingEmail ?? "")
    ?? normalizeBusinessEmail(crawl.emails[0] ?? "")
    ?? null;

  const ai = await summarizeBusinessWithMistral(input.name, input.website, crawl.text);

  return {
    email: chosenEmail,
    summary: ai.summary || input.existingSummary || null,
    highlights: ai.highlights || null,
    pagesCrawled: crawl.visited.length
  };
}
