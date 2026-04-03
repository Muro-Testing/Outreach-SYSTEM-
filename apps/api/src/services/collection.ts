import { fetchApifyLeads } from "../adapters/apify.js";
import { GoogleKeywordFetchTimeoutError, fetchGoogleLeadsForKeyword } from "../adapters/google.js";
import { fetchYelpLeads } from "../adapters/yelp.js";
import { supabase } from "../db.js";
import { crawlWebsiteForContactData } from "./crawler.js";
import type { CrawlResult } from "./crawler.js";
import { normalizeBusinessEmail } from "./email.js";
import { normalizeRawLead, payloadHash } from "./normalize.js";
import { enrichBusinessFromWebsite } from "./enrich.js";
import { expandKeywordsWithAI } from "./keyword-expander.js";
import type { NormalizedLead, RawLead, RunCounters, SourceName } from "../types.js";

// Estimated fraction of raw Google candidates that yield a confirmed email after crawling.
// Used to pre-calculate how many keywords/candidates we need upfront.
const EMAIL_YIELD_RATE = 0.38;
// Maximum extra Google keywords AI can generate per run.
const MAX_AI_KEYWORDS = 15;
// Each Google keyword returns at most this many unique results (3 pages x 20).
const GOOGLE_MAX_PER_KEYWORD = 60;
const CRAWL_CONCURRENCY = 8;
const CRAWL_PROGRESS_INTERVAL = 10;
const RUN_STATUS_CHECK_INTERVAL_MS = 1500;
const GOOGLE_KEYWORD_FETCH_STAGE_TIMEOUT_MS = 120000;

export function buildQueryFingerprint(keywords: string[], location: string): string {
  const sorted = [...keywords].map((k) => k.toLowerCase().trim()).sort().join("|");
  const loc = location.toLowerCase().trim();
  return `${sorted}::${loc}`;
}

type CampaignRow = {
  id: string;
  niche_keywords: string[];
  sub_niche: string;
  location_scope: string;
};

export type RunSourceOptions = {
  google: boolean;
  yelp: boolean;
  apify: boolean;
};

type EnrichmentJob = {
  leadId: string;
  name: string;
  email: string;
  website: string | null;
  whatTheyDoSummary: string | null;
  crawlResult: CrawlResult | null;
};

type LeadProcessingFailure = {
  raw: RawLead;
  message: string;
};

const INFO_PREFIX = "[info]";

class RunStoppedError extends Error {
  constructor() {
    super("Run stopped by user.");
    this.name = "RunStoppedError";
  }
}

const emptyCounters = (): RunCounters => ({
  totalCandidates: 0,
  insertedCount: 0,
  updatedCount: 0,
  dedupedCount: 0,
  rejectedNoEmailCount: 0
});

async function mapLimit<T>(items: T[], limit: number, worker: (item: T, index: number) => Promise<void>): Promise<void> {
  let cursor = 0;

  async function runWorker() {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      await worker(items[index], index);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => runWorker());
  await Promise.all(workers);
}

function mergeSummary(summary: string | null, highlights: string | null): string | null {
  if (!summary && !highlights) return null;
  if (summary && highlights) return `${summary}\n\nKey specifics:\n${highlights}`;
  return summary ?? highlights;
}

async function getWebsiteCrawl(
  website: string,
  cache: Map<string, Promise<CrawlResult>>
): Promise<CrawlResult> {
  const key = website.toLowerCase().trim();
  const existing = cache.get(key);
  if (existing) return existing;

  const promise = crawlWebsiteForContactData(website, {
    maxPages: 14,
    maxDepth: 2,
    timeoutMs: 12000
  });

  cache.set(key, promise);
  return promise;
}

async function hydrateMissingEmail(
  normalized: NormalizedLead,
  crawlCache: Map<string, Promise<CrawlResult>>
): Promise<{ normalized: NormalizedLead; crawlResult: CrawlResult | null }> {
  if (normalized.email || !normalized.website) {
    return { normalized, crawlResult: null };
  }

  try {
    const crawl = await getWebsiteCrawl(normalized.website, crawlCache);
    const email = normalizeBusinessEmail(crawl.emails[0] ?? "");
    if (!email) {
      return { normalized, crawlResult: crawl };
    }

    return {
      normalized: {
        ...normalized,
        email
      },
      crawlResult: crawl
    };
  } catch {
    return { normalized, crawlResult: null };
  }
}

async function logRunEvent(runId: string, campaignId: string, message: string): Promise<void> {
  await supabase.from("run_errors").insert({
    run_id: runId,
    campaign_id: campaignId,
    source_name: "pipeline",
    error_message: `${INFO_PREFIX} ${message}`,
    error_detail: null,
    retryable: false
  });
}

async function logRunError(runId: string, campaignId: string, source: SourceName | "pipeline", err: unknown) {
  await supabase.from("run_errors").insert({
    run_id: runId,
    campaign_id: campaignId,
    source_name: source,
    error_message: err instanceof Error ? err.message : "Unknown source error",
    error_detail: err instanceof Error ? String(err.stack ?? "") : "",
    retryable: true
  });
}

async function flushRunMetrics(runId: string, counters: RunCounters, status?: "running" | "completed" | "failed") {
  const payload: Record<string, unknown> = {
    total_candidates: counters.totalCandidates,
    inserted_count: counters.insertedCount,
    updated_count: counters.updatedCount,
    deduped_count: counters.dedupedCount,
    rejected_no_email_count: counters.rejectedNoEmailCount,
    updated_at: new Date().toISOString()
  };

  if (status) payload.status = status;
  if (status === "completed" || status === "failed") payload.completed_at = new Date().toISOString();

  await supabase.from("collection_runs").update(payload).eq("id", runId);
}

function createRunStopGuard(runId: string) {
  let stopped = false;
  let lastChecked = 0;

  async function refresh(force = false): Promise<boolean> {
    if (stopped) return true;

    const now = Date.now();
    if (!force && now - lastChecked < RUN_STATUS_CHECK_INTERVAL_MS) {
      return false;
    }

    lastChecked = now;
    const result = await supabase
      .from("collection_runs")
      .select("status")
      .eq("id", runId)
      .single();

    stopped = Boolean(result.data && result.data.status !== "running" && result.data.status !== "queued");
    return stopped;
  }

  return {
    async assertActive() {
      if (await refresh()) throw new RunStoppedError();
    },
    async isStopped() {
      return refresh(true);
    }
  };
}

async function enrichAndPersistLead(runId: string, campaignId: string, input: EnrichmentJob): Promise<void> {
  try {
    const enriched = await enrichBusinessFromWebsite({
      name: input.name,
      website: input.website,
      existingEmail: input.email,
      existingSummary: input.whatTheyDoSummary
    }, input.crawlResult);

    if (!enriched) return;

    const updatePayload: Record<string, string | null> = {
      what_they_do_summary: mergeSummary(enriched.summary, enriched.highlights),
      last_run_id: runId
    };

    if (enriched.email) {
      updatePayload.email = enriched.email;
    }

    await supabase.from("leads").update(updatePayload).eq("id", input.leadId);
  } catch (err) {
    await logRunError(runId, campaignId, "pipeline", err);
  }
}

async function logSearchQuery(
  runId: string,
  campaignId: string,
  fingerprint: string,
  keyword: string,
  location: string,
  resultsCount: number,
  aiGenerated: boolean
): Promise<void> {
  await supabase.from("search_queries").insert({
    run_id: runId,
    campaign_id: campaignId,
    campaign_fingerprint: fingerprint,
    keyword,
    location,
    results_count: resultsCount,
    ai_generated: aiGenerated
  });
}

async function upsertLead(
  runId: string,
  campaign: CampaignRow,
  raw: RawLead,
  counters: RunCounters,
  crawlCache: Map<string, Promise<CrawlResult>>
): Promise<EnrichmentJob | null> {
  const baseNormalized = normalizeRawLead(raw);
  if (!baseNormalized) {
    counters.rejectedNoEmailCount += 1;
    return null;
  }

  const { normalized, crawlResult } = await hydrateMissingEmail(baseNormalized, crawlCache);
  if (!normalized.email) {
    counters.rejectedNoEmailCount += 1;
    return null;
  }

  const normalizedEmail = normalized.email;
  let leadId: string | null = null;

  if (normalized.websiteDomain) {
    const existing = await supabase
      .from("leads")
      .select("id,email")
      .eq("website_domain", normalized.websiteDomain)
      .maybeSingle();

    if (existing.error) {
      throw new Error(`Lead lookup failed for domain ${normalized.websiteDomain}: ${existing.error.message}`);
    }

    if (existing.data?.id) {
      counters.dedupedCount += 1;
      counters.updatedCount += 1;
      leadId = existing.data.id;

      const updated = await supabase.from("leads").update({
        email: normalizedEmail,
        name: normalized.name,
        what_they_do_summary: normalized.whatTheyDoSummary,
        location_text: normalized.locationText,
        phone: normalized.phone,
        website: normalized.website,
        last_run_id: runId
      }).eq("id", leadId);

      if (updated.error) {
        throw new Error(`Lead update failed for ${normalized.name}: ${updated.error.message}`);
      }
    }
  }

  if (!leadId) {
    const inserted = await supabase.from("leads").insert({
      campaign_id: campaign.id,
      last_run_id: runId,
      name: normalized.name,
      email: normalizedEmail,
      what_they_do_summary: normalized.whatTheyDoSummary,
      location_text: normalized.locationText,
      phone: normalized.phone,
      website: normalized.website,
      website_domain: normalized.websiteDomain
    }).select("id").single();

    if (inserted.error || !inserted.data) {
      throw new Error(inserted.error?.message ?? `Lead insert returned no row for ${normalized.name}`);
    }

    leadId = inserted.data.id;
    counters.insertedCount += 1;
  }

  if (!leadId) return null;

  const sourceInsert = await supabase.from("lead_sources").insert({
    lead_id: leadId,
    campaign_id: campaign.id,
    run_id: runId,
    matched_keyword: raw.matchedKeyword ?? null,
    source_name: raw.sourceName,
    external_id: raw.externalId ?? null,
    external_url: raw.externalUrl ?? null,
    raw_payload_hash: payloadHash(raw.raw),
    raw_payload: raw.raw
  });

  if (sourceInsert.error) {
    throw new Error(`Lead source insert failed for ${normalized.name}: ${sourceInsert.error.message}`);
  }

  return {
    leadId,
    name: normalized.name,
    email: normalizedEmail,
    website: normalized.website,
    whatTheyDoSummary: normalized.whatTheyDoSummary,
    crawlResult
  };
}

function formatLeadLabel(raw: RawLead): string {
  const source = raw.sourceName ? `[${raw.sourceName}] ` : "";
  const website = raw.website ? ` | ${raw.website.replace(/^https?:\/\//, "")}` : "";
  return `${source}${raw.name}${website}`;
}

async function processRawLead(
  runId: string,
  campaign: CampaignRow,
  raw: RawLead,
  counters: RunCounters,
  crawlCache: Map<string, Promise<CrawlResult>>,
  runGuard: ReturnType<typeof createRunStopGuard>
): Promise<{ job: EnrichmentJob | null; failure: LeadProcessingFailure | null }> {
  await runGuard.assertActive();
  await logRunEvent(runId, campaign.id, `Crawling ${formatLeadLabel(raw)}`);

  try {
    const job = await upsertLead(runId, campaign, raw, counters, crawlCache);
    return { job, failure: null };
  } catch (err) {
    if (err instanceof RunStoppedError) {
      throw err;
    }

    await logRunError(runId, campaign.id, raw.sourceName, err);
    const message = err instanceof Error ? err.message : "Unknown lead processing failure";
    await logRunEvent(runId, campaign.id, `Lead failed and was skipped: ${formatLeadLabel(raw)} | ${message}`);
    return { job: null, failure: { raw, message } };
  }
}

type CollectionProgressState = {
  enrichmentJobsByLeadId: Map<string, EnrichmentJob>;
  crawlCache: Map<string, Promise<CrawlResult>>;
  processed: number;
  failedLeadCount: number;
  uniqueVerifiedLeadCount: number;
};

async function processCollectedLeadsBatch(
  runId: string,
  campaign: CampaignRow,
  rawLeads: RawLead[],
  counters: RunCounters,
  progress: CollectionProgressState,
  runGuard: ReturnType<typeof createRunStopGuard>,
  batchLabel: string
): Promise<void> {
  if (rawLeads.length === 0) {
    await logRunEvent(runId, campaign.id, `No candidates returned from ${batchLabel}.`);
    return;
  }

  counters.totalCandidates += rawLeads.length;
  await flushRunMetrics(runId, counters, "running");
  await logRunEvent(
    runId,
    campaign.id,
    `${rawLeads.length} candidates ready from ${batchLabel}. Crawling for emails now...`
  );

  await mapLimit(rawLeads, CRAWL_CONCURRENCY, async (raw) => {
    try {
      const { job, failure } = await processRawLead(runId, campaign, raw, counters, progress.crawlCache, runGuard);

      if (failure) {
        progress.failedLeadCount += 1;
      } else if (job && !progress.enrichmentJobsByLeadId.has(job.leadId)) {
        progress.enrichmentJobsByLeadId.set(job.leadId, job);
        progress.uniqueVerifiedLeadCount += 1;
        await logRunEvent(runId, campaign.id, `Verified email kept for ${job.name}: ${job.email}`);
      } else if (!job) {
        await logRunEvent(runId, campaign.id, `No verified email found for ${raw.name}`);
      }
    } finally {
      progress.processed += 1;
    }

    if (progress.processed % CRAWL_PROGRESS_INTERVAL === 0 || progress.processed === counters.totalCandidates) {
      await logRunEvent(
        runId,
        campaign.id,
        `Progress: ${progress.processed}/${counters.totalCandidates} prospects crawled | ` +
          `${progress.uniqueVerifiedLeadCount} unique email-verified leads | ${progress.failedLeadCount} skipped due to errors`
      );
      await flushRunMetrics(runId, counters, "running");
    }
  });

  await logRunEvent(
    runId,
    campaign.id,
    `Batch complete for ${batchLabel}: ${progress.uniqueVerifiedLeadCount} unique email-verified leads so far | ` +
      `${progress.failedLeadCount} skipped due to errors`
  );
}

export async function executeCollectionRun(
  runId: string,
  campaign: CampaignRow,
  sources: RunSourceOptions,
  options: { targetLeads: number }
): Promise<void> {
  const counters = emptyCounters();
  const targetEmails = Math.max(1, options.targetLeads);
  const runGuard = createRunStopGuard(runId);

  await supabase
    .from("collection_runs")
    .update({ status: "running", started_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", runId);

  const fingerprint = buildQueryFingerprint(campaign.niche_keywords, campaign.location_scope);
  await supabase.from("collection_runs").update({ query_fingerprint: fingerprint, updated_at: new Date().toISOString() }).eq("id", runId);

  const selectedSources = Object.entries(sources).filter(([, enabled]) => enabled).map(([name]) => name);
  await logRunEvent(
    runId,
    campaign.id,
    `Sources: ${selectedSources.join(", ")} | target email-verified leads: ${targetEmails}`
  );

  let allKeywords = [...campaign.niche_keywords];
  const progress: CollectionProgressState = {
    enrichmentJobsByLeadId: new Map<string, EnrichmentJob>(),
    crawlCache: new Map<string, Promise<CrawlResult>>(),
    processed: 0,
    failedLeadCount: 0,
    uniqueVerifiedLeadCount: 0
  };

  try {
    if (sources.google) {
      const rawCandidatesNeeded = Math.ceil(targetEmails / EMAIL_YIELD_RATE);
      const keywordsNeeded = Math.ceil(rawCandidatesNeeded / GOOGLE_MAX_PER_KEYWORD);
      const aiKeywordsNeeded = Math.max(0, keywordsNeeded - allKeywords.length);

      if (aiKeywordsNeeded > 0) {
        const capped = Math.min(aiKeywordsNeeded, MAX_AI_KEYWORDS);
        await logRunEvent(
          runId,
          campaign.id,
          `Need ~${rawCandidatesNeeded} raw candidates for ${targetEmails} email target. ` +
            `${allKeywords.length} keyword(s) provided -> generating ${capped} more with AI...`
        );

        await runGuard.assertActive();
        const expanded = await expandKeywordsWithAI(allKeywords, campaign.location_scope, capped);
        if (expanded.length > 0) {
          await logRunEvent(
            runId,
            campaign.id,
            `AI added ${expanded.length} keyword(s): ${expanded.map((keyword) => `"${keyword}"`).join(", ")}`
          );
          allKeywords = [...allKeywords, ...expanded];
        } else {
          await logRunEvent(runId, campaign.id, "AI keyword expansion returned no results; using original keywords only.");
        }
      }

      await logRunEvent(
        runId,
        campaign.id,
        `Searching Google with ${allKeywords.length} keyword(s): ${allKeywords.map((keyword) => `"${keyword}"`).join(", ")}`
      );
    }

    const sourceTasks: Array<Promise<{ source: SourceName; leads: RawLead[] }>> = [];

    if (sources.yelp) {
      sourceTasks.push((async () => {
        await runGuard.assertActive();
        await logRunEvent(runId, campaign.id, "Fetching leads from Yelp...");
        const leads = await fetchYelpLeads({
          niche: allKeywords[0],
          location: campaign.location_scope,
          maxResults: targetEmails
        });
        return { source: "yelp" as const, leads };
      })());
    }

    if (sources.apify) {
      sourceTasks.push((async () => {
        await runGuard.assertActive();
        await logRunEvent(runId, campaign.id, "Fetching leads from Apify...");
        const leads = await fetchApifyLeads({
          niche: allKeywords[0],
          location: campaign.location_scope,
          maxResults: targetEmails
        });
        return { source: "apify" as const, leads };
      })());
    }

    if (sources.google) {
      for (let idx = 0; idx < allKeywords.length; idx += 1) {
        const keyword = allKeywords[idx];
        await runGuard.assertActive();
        await logRunEvent(runId, campaign.id, `Google keyword ${idx + 1}/${allKeywords.length}: ${keyword}`);

        try {
          const leads = await fetchGoogleLeadsForKeyword({
            niche: keyword,
            subNiche: campaign.sub_niche,
            location: campaign.location_scope,
            maxResults: GOOGLE_MAX_PER_KEYWORD,
            assertActive: () => runGuard.assertActive(),
            fetchDeadlineAt: Date.now() + GOOGLE_KEYWORD_FETCH_STAGE_TIMEOUT_MS,
            onPlaceProcessed: async ({ keyword: activeKeyword, index, total, name, website }) => {
              const websiteLabel = website ? website.replace(/^https?:\/\//, "") : "no website";
              await logRunEvent(
                runId,
                campaign.id,
                `Google prospect ${index}/${total} for "${activeKeyword}": ${name} | ${websiteLabel}`
              );
            }
          });

          await logRunEvent(runId, campaign.id, `Google keyword ${idx + 1}/${allKeywords.length} complete: ${keyword} -> ${leads.length} places`);
          await logSearchQuery(
            runId,
            campaign.id,
            fingerprint,
            keyword,
            campaign.location_scope,
            leads.length,
            !campaign.niche_keywords.some((original) => original.toLowerCase().trim() === keyword.toLowerCase().trim())
          );
          await processCollectedLeadsBatch(
            runId,
            campaign,
            leads,
            counters,
            progress,
            runGuard,
            `Google keyword "${keyword}"`
          );
        } catch (err) {
          if (err instanceof RunStoppedError) {
            throw err;
          }

          if (err instanceof GoogleKeywordFetchTimeoutError) {
            await logRunEvent(
              runId,
              campaign.id,
              `Google keyword ${idx + 1}/${allKeywords.length} timed out and was skipped: ${keyword}`
            );
            await logRunError(runId, campaign.id, "google", err);
            continue;
          }

          await logRunError(runId, campaign.id, "google", err);
          await logRunEvent(
            runId,
            campaign.id,
            `Google keyword ${idx + 1}/${allKeywords.length} failed and was skipped: ${keyword}`
          );
        }
      }
    }

    const settled = await Promise.allSettled(sourceTasks);

    for (const result of settled) {
      if (result.status === "fulfilled") {
        await logRunEvent(runId, campaign.id, `Fetched ${result.value.leads.length} candidates from ${result.value.source}.`);

        await logSearchQuery(
          runId,
          campaign.id,
          fingerprint,
          allKeywords[0],
          campaign.location_scope,
          result.value.leads.length,
          false
        );
        await processCollectedLeadsBatch(
          runId,
          campaign,
          result.value.leads,
          counters,
          progress,
          runGuard,
          result.value.source
        );
      } else if (result.reason instanceof RunStoppedError) {
        await logRunEvent(runId, campaign.id, "Run stopped before source fetch completed.");
      } else {
        await logRunError(runId, campaign.id, "pipeline", result.reason);
      }
    }

    if (counters.totalCandidates === 0) {
      await logRunEvent(runId, campaign.id, "No candidates returned. Check source toggles, API keys, and keywords.");
      await flushRunMetrics(runId, counters, "completed");
      return;
    }

    await logRunEvent(
      runId,
      campaign.id,
      `Crawl complete: ${progress.uniqueVerifiedLeadCount} unique email-verified leads from ${counters.totalCandidates} candidates` +
        ` | ${progress.failedLeadCount} skipped due to errors` +
        (progress.uniqueVerifiedLeadCount < targetEmails
          ? ` (target was ${targetEmails} - try more keywords or sources for next run)`
          : ` - target of ${targetEmails} reached`)
    );

    const enrichmentJobs = [...progress.enrichmentJobsByLeadId.values()];
    await logRunEvent(runId, campaign.id, `Starting enrichment on ${enrichmentJobs.length} unique leads (parallel x6)...`);

    let enrichedCount = 0;
    await mapLimit(enrichmentJobs, 6, async (job) => {
      await runGuard.assertActive();
      await logRunEvent(runId, campaign.id, `Enriching ${job.name}${job.website ? ` | ${job.website.replace(/^https?:\/\//, "")}` : ""}`);
      await enrichAndPersistLead(runId, campaign.id, job);
      enrichedCount += 1;
      if (enrichedCount % 5 === 0 || enrichedCount === enrichmentJobs.length) {
        await logRunEvent(runId, campaign.id, `Enrichment: ${enrichedCount}/${enrichmentJobs.length}`);
      }
    });

    await logRunEvent(runId, campaign.id, "Run completed.");
    await flushRunMetrics(runId, counters, "completed");
  } catch (err) {
    if (err instanceof RunStoppedError || await runGuard.isStopped()) {
      await logRunEvent(runId, campaign.id, "Run stopped by user.");
      await flushRunMetrics(runId, counters, "failed");
      return;
    }

    throw err;
  }
}
