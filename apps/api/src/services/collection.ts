import { fetchApifyLeads } from "../adapters/apify.js";
import { fetchGoogleLeads } from "../adapters/google.js";
import { fetchYelpLeads } from "../adapters/yelp.js";
import { supabase } from "../db.js";
import { crawlWebsiteForContactData } from "./crawler.js";
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
// Each Google keyword returns at most this many unique results (3 pages × 20).
const GOOGLE_MAX_PER_KEYWORD = 60;

export function buildQueryFingerprint(keywords: string[], location: string): string {
  const sorted = [...keywords].map(k => k.toLowerCase().trim()).sort().join("|");
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
};

const INFO_PREFIX = "[info]";

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

async function hydrateMissingEmail(normalized: NormalizedLead): Promise<NormalizedLead> {
  if (normalized.email || !normalized.website) return normalized;

  try {
    const crawl = await crawlWebsiteForContactData(normalized.website, {
      maxPages: 14,
      maxDepth: 2,
      timeoutMs: 12000
    });

    const email = normalizeBusinessEmail(crawl.emails[0] ?? "");
    if (!email) return normalized;

    return {
      ...normalized,
      email
    };
  } catch {
    return normalized;
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
    rejected_no_email_count: counters.rejectedNoEmailCount
  };

  if (status) payload.status = status;
  if (status === "completed" || status === "failed") payload.completed_at = new Date().toISOString();

  await supabase.from("collection_runs").update(payload).eq("id", runId);
}

async function enrichAndPersistLead(runId: string, campaignId: string, input: EnrichmentJob): Promise<void> {
  try {
    const enriched = await enrichBusinessFromWebsite({
      name: input.name,
      website: input.website,
      existingEmail: input.email,
      existingSummary: input.whatTheyDoSummary
    });

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

// ── Search query logger ────────────────────────────────────────────────────────
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

// ── Lead upsert helper ─────────────────────────────────────────────────────────
async function upsertLead(
  runId: string,
  campaign: CampaignRow,
  raw: RawLead,
  counters: RunCounters
): Promise<EnrichmentJob | null> {
  const baseNormalized = normalizeRawLead(raw);
  if (!baseNormalized) { counters.rejectedNoEmailCount += 1; return null; }

  const normalized = await hydrateMissingEmail(baseNormalized);
  if (!normalized.email) { counters.rejectedNoEmailCount += 1; return null; }

  const normalizedEmail = normalized.email;
  let leadId: string | null = null;

  if (normalized.websiteDomain) {
    const existing = await supabase
      .from("leads").select("id,email")
      .eq("website_domain", normalized.websiteDomain).maybeSingle();

    if (existing.data?.id) {
      counters.dedupedCount += 1;
      counters.updatedCount += 1;
      leadId = existing.data.id;
      await supabase.from("leads").update({
        email: normalizedEmail, name: normalized.name,
        what_they_do_summary: normalized.whatTheyDoSummary,
        location_text: normalized.locationText, phone: normalized.phone,
        website: normalized.website, last_run_id: runId
      }).eq("id", leadId);
    }
  }

  if (!leadId) {
    const inserted = await supabase.from("leads").insert({
      campaign_id: campaign.id, last_run_id: runId, name: normalized.name,
      email: normalizedEmail, what_they_do_summary: normalized.whatTheyDoSummary,
      location_text: normalized.locationText, phone: normalized.phone,
      website: normalized.website, website_domain: normalized.websiteDomain
    }).select("id").single();

    if (inserted.error || !inserted.data) { return null; }
    leadId = inserted.data.id;
    counters.insertedCount += 1;
  }

  if (!leadId) return null;

  await supabase.from("lead_sources").insert({
    lead_id: leadId, campaign_id: campaign.id, run_id: runId,
    source_name: raw.sourceName, external_id: raw.externalId ?? null,
    external_url: raw.externalUrl ?? null,
    raw_payload_hash: payloadHash(raw.raw), raw_payload: raw.raw
  });

  return {
    leadId, name: normalized.name, email: normalizedEmail,
    website: normalized.website, whatTheyDoSummary: normalized.whatTheyDoSummary
  };
}

// ── Main collection runner ─────────────────────────────────────────────────────
export async function executeCollectionRun(
  runId: string,
  campaign: CampaignRow,
  sources: RunSourceOptions,
  options: { targetLeads: number }
): Promise<void> {
  const counters = emptyCounters();
  const targetEmails = Math.max(1, options.targetLeads);

  await supabase.from("collection_runs")
    .update({ status: "running", started_at: new Date().toISOString() })
    .eq("id", runId);

  const fingerprint = buildQueryFingerprint(campaign.niche_keywords, campaign.location_scope);
  await supabase.from("collection_runs").update({ query_fingerprint: fingerprint }).eq("id", runId);

  const selectedSources = Object.entries(sources).filter(([, e]) => e).map(([n]) => n);
  await logRunEvent(runId, campaign.id,
    `Sources: ${selectedSources.join(", ")} | target email-verified leads: ${targetEmails}`);

  // ── Step 1: Calculate how many Google keywords are needed ──────────────────
  // To get targetEmails confirmed emails we need (target / yield_rate) raw candidates.
  // Each keyword gives at most GOOGLE_MAX_PER_KEYWORD results.
  let allKeywords = [...campaign.niche_keywords];

  if (sources.google) {
    const rawCandidatesNeeded = Math.ceil(targetEmails / EMAIL_YIELD_RATE);
    const keywordsNeeded = Math.ceil(rawCandidatesNeeded / GOOGLE_MAX_PER_KEYWORD);
    const aiKeywordsNeeded = Math.max(0, keywordsNeeded - allKeywords.length);

    if (aiKeywordsNeeded > 0) {
      const capped = Math.min(aiKeywordsNeeded, MAX_AI_KEYWORDS);
      await logRunEvent(runId, campaign.id,
        `Need ~${rawCandidatesNeeded} raw candidates for ${targetEmails} email target. ` +
        `${allKeywords.length} keyword(s) provided → generating ${capped} more with AI...`);

      const expanded = await expandKeywordsWithAI(allKeywords, campaign.location_scope, capped);
      if (expanded.length > 0) {
        await logRunEvent(runId, campaign.id,
          `AI added ${expanded.length} keyword(s): ${expanded.map(k => `"${k}"`).join(", ")}`);
        allKeywords = [...allKeywords, ...expanded];
      } else {
        await logRunEvent(runId, campaign.id, "AI keyword expansion returned no results — using original keywords only.");
      }
    }

    await logRunEvent(runId, campaign.id,
      `Searching Google with ${allKeywords.length} keyword(s): ${allKeywords.map(k => `"${k}"`).join(", ")}`);
  }

  // ── Step 2: Fetch raw candidates from all sources ──────────────────────────
  const sourceTasks: Array<Promise<{ source: SourceName; leads: RawLead[]; keywords?: string[] }>> = [];

  if (sources.google) {
    sourceTasks.push((async () => {
      const leads = await fetchGoogleLeads({
        niche: allKeywords[0],
        allKeywords,
        subNiche: campaign.sub_niche,
        location: campaign.location_scope,
        maxResults: GOOGLE_MAX_PER_KEYWORD
      });
      return { source: "google" as const, leads, keywords: allKeywords };
    })());
  }
  if (sources.yelp) {
    sourceTasks.push((async () => {
      await logRunEvent(runId, campaign.id, "Fetching leads from Yelp...");
      const leads = await fetchYelpLeads({
        niche: allKeywords[0],
        location: campaign.location_scope, maxResults: targetEmails
      });
      return { source: "yelp" as const, leads };
    })());
  }
  if (sources.apify) {
    sourceTasks.push((async () => {
      await logRunEvent(runId, campaign.id, "Fetching leads from Apify...");
      const leads = await fetchApifyLeads({
        niche: allKeywords[0],
        location: campaign.location_scope, maxResults: targetEmails
      });
      return { source: "apify" as const, leads };
    })());
  }

  const settled = await Promise.allSettled(sourceTasks);
  const allRaw: RawLead[] = [];

  for (const result of settled) {
    if (result.status === "fulfilled") {
      allRaw.push(...result.value.leads);
      await logRunEvent(runId, campaign.id,
        `Fetched ${result.value.leads.length} candidates from ${result.value.source}.`);

      // Log each keyword searched to search_queries table
      if (result.value.source === "google" && result.value.keywords) {
        const perKeyword = Math.ceil(result.value.leads.length / result.value.keywords.length);
        const origSet = new Set(campaign.niche_keywords.map(k => k.toLowerCase().trim()));
        for (const kw of result.value.keywords) {
          await logSearchQuery(runId, campaign.id, fingerprint, kw,
            campaign.location_scope, perKeyword,
            !origSet.has(kw.toLowerCase().trim()));
        }
      } else {
        await logSearchQuery(runId, campaign.id, fingerprint, allKeywords[0],
          campaign.location_scope, result.value.leads.length, false);
      }
    } else {
      await logRunError(runId, campaign.id, "pipeline", result.reason);
    }
  }

  counters.totalCandidates = allRaw.length;
  await flushRunMetrics(runId, counters, "running");

  if (counters.totalCandidates === 0) {
    await logRunEvent(runId, campaign.id, "No candidates returned. Check source toggles, API keys, and keywords.");
    await flushRunMetrics(runId, counters, "completed");
    return;
  }

  await logRunEvent(runId, campaign.id,
    `${counters.totalCandidates} unique candidates. Crawling all for emails...`);

  // ── Step 3: Upsert all leads — crawl every candidate for maximum emails ────
  const enrichmentJobs: EnrichmentJob[] = [];
  let emailCount = 0;
  let processed = 0;

  for (const raw of allRaw) {
    processed += 1;
    const job = await upsertLead(runId, campaign, raw, counters);

    if (job) {
      enrichmentJobs.push(job);
      emailCount += 1;
    }

    if (processed % 5 === 0 || processed === allRaw.length) {
      await logRunEvent(runId, campaign.id,
        `Progress: ${processed}/${allRaw.length} crawled | ${emailCount} emails found so far`);
      await flushRunMetrics(runId, counters, "running");
    }
  }

  await logRunEvent(runId, campaign.id,
    `Crawl complete: ${emailCount} email-verified leads from ${counters.totalCandidates} candidates` +
    (emailCount < targetEmails
      ? ` (target was ${targetEmails} — try more keywords or sources for next run)`
      : ` ✓ target of ${targetEmails} reached`)
  );

  // ── Step 4: Enrich leads (AI summary + extra email discovery) ─────────────
  await logRunEvent(runId, campaign.id,
    `Starting enrichment on ${enrichmentJobs.length} leads (parallel x6)...`);

  let enrichedCount = 0;
  await mapLimit(enrichmentJobs, 6, async (job) => {
    await enrichAndPersistLead(runId, campaign.id, job);
    enrichedCount += 1;
    if (enrichedCount % 5 === 0 || enrichedCount === enrichmentJobs.length) {
      await logRunEvent(runId, campaign.id,
        `Enrichment: ${enrichedCount}/${enrichmentJobs.length}`);
    }
  });

  await logRunEvent(runId, campaign.id, "Run completed.");
  await flushRunMetrics(runId, counters, "completed");
}
