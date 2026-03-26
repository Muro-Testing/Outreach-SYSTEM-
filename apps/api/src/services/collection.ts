import { fetchApifyLeads } from "../adapters/apify.js";
import { fetchGoogleLeads } from "../adapters/google.js";
import { fetchYelpLeads } from "../adapters/yelp.js";
import { supabase } from "../db.js";
import { crawlWebsiteForContactData } from "./crawler.js";
import { normalizeBusinessEmail } from "./email.js";
import { normalizeRawLead, payloadHash } from "./normalize.js";
import { enrichBusinessFromWebsite } from "./enrich.js";
import type { NormalizedLead, RawLead, RunCounters, SourceName } from "../types.js";

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

export async function executeCollectionRun(
  runId: string,
  campaign: CampaignRow,
  sources: RunSourceOptions,
  options: { targetLeads: number }
): Promise<void> {
  const counters = emptyCounters();

  await supabase
    .from("collection_runs")
    .update({ status: "running", started_at: new Date().toISOString() })
    .eq("id", runId);

  const fingerprint = buildQueryFingerprint(campaign.niche_keywords, campaign.location_scope);
  await supabase.from("collection_runs").update({ query_fingerprint: fingerprint }).eq("id", runId);

  const selectedSources = Object.entries(sources)
    .filter(([, enabled]) => enabled)
    .map(([name]) => name);
  const selectedSourceCount = Math.max(1, selectedSources.length);
  const perSourceTarget = Math.max(1, Math.ceil(options.targetLeads / selectedSourceCount));

  await logRunEvent(
    runId,
    campaign.id,
    `Starting run with sources: ${selectedSources.join(", ")} | target leads: ${options.targetLeads}`
  );
  await logRunEvent(runId, campaign.id, `Per-source target: ${perSourceTarget}`);

  const [nicheKeyword] = campaign.niche_keywords;
  const input = {
    niche: nicheKeyword,
    subNiche: campaign.sub_niche,
    location: campaign.location_scope,
    maxResults: perSourceTarget
  };

  const sourceTasks: Array<Promise<{ source: SourceName; leads: RawLead[] }>> = [];

  if (sources.google) {
    sourceTasks.push(
      (async () => {
        await logRunEvent(runId, campaign.id, `Fetching leads from google (target ${perSourceTarget})...`);
        const leads = await fetchGoogleLeads(input);
        return { source: "google" as const, leads };
      })()
    );
  }
  if (sources.yelp) {
    sourceTasks.push(
      (async () => {
        await logRunEvent(runId, campaign.id, `Fetching leads from yelp (target ${perSourceTarget})...`);
        const leads = await fetchYelpLeads(input);
        return { source: "yelp" as const, leads };
      })()
    );
  }
  if (sources.apify) {
    sourceTasks.push(
      (async () => {
        await logRunEvent(runId, campaign.id, `Fetching leads from apify (target ${perSourceTarget})...`);
        const leads = await fetchApifyLeads(input);
        return { source: "apify" as const, leads };
      })()
    );
  }

  const settled = await Promise.allSettled(sourceTasks);
  const allRaw: RawLead[] = [];

  for (const result of settled) {
    if (result.status === "fulfilled") {
      allRaw.push(...result.value.leads);
      await logRunEvent(runId, campaign.id, `Fetched ${result.value.leads.length} leads from ${result.value.source}.`);
    } else {
      await logRunError(runId, campaign.id, "pipeline", result.reason);
    }
  }

  const cappedRaw = allRaw.slice(0, Math.max(1, options.targetLeads));
  counters.totalCandidates = cappedRaw.length;
  await flushRunMetrics(runId, counters, "running");

  if (counters.totalCandidates === 0) {
    await logRunEvent(runId, campaign.id, "No candidates returned. Check source toggles, keys, and query.");
    await flushRunMetrics(runId, counters, "completed");
    return;
  }

  await logRunEvent(runId, campaign.id, `Normalizing and upserting ${counters.totalCandidates} leads...`);

  const enrichmentJobs: EnrichmentJob[] = [];
  let processed = 0;

  for (const raw of cappedRaw) {
    processed += 1;

    const baseNormalized = normalizeRawLead(raw);
    if (!baseNormalized) {
      counters.rejectedNoEmailCount += 1;
      if (processed % 5 === 0 || processed === cappedRaw.length) {
        await logRunEvent(
          runId,
          campaign.id,
          `Save progress: ${processed}/${cappedRaw.length} processed | inserted ${counters.insertedCount} | updated ${counters.updatedCount} | rejected ${counters.rejectedNoEmailCount}`
        );
        await flushRunMetrics(runId, counters, "running");
      }
      continue;
    }

    const normalized = await hydrateMissingEmail(baseNormalized);

    if (!normalized.email) {
      counters.rejectedNoEmailCount += 1;
      if (processed % 5 === 0 || processed === cappedRaw.length) {
        await logRunEvent(
          runId,
          campaign.id,
          `Save progress: ${processed}/${cappedRaw.length} processed | inserted ${counters.insertedCount} | updated ${counters.updatedCount} | rejected ${counters.rejectedNoEmailCount}`
        );
        await flushRunMetrics(runId, counters, "running");
      }
      continue;
    }

    const normalizedEmail = normalized.email;
    let leadId: string | null = null;

    if (normalized.websiteDomain) {
      const existing = await supabase
        .from("leads")
        .select("id,email")
        .eq("website_domain", normalized.websiteDomain)
        .maybeSingle();

      if (existing.data?.id) {
        counters.dedupedCount += 1;
        counters.updatedCount += 1;
        leadId = existing.data.id;

        await supabase
          .from("leads")
          .update({
            email: normalizedEmail,
            name: normalized.name,
            what_they_do_summary: normalized.whatTheyDoSummary,
            location_text: normalized.locationText,
            phone: normalized.phone,
            website: normalized.website,
            last_run_id: runId
          })
          .eq("id", leadId);
      }
    }

    if (!leadId) {
      const inserted = await supabase
        .from("leads")
        .insert({
          campaign_id: campaign.id,
          last_run_id: runId,
          name: normalized.name,
          email: normalizedEmail,
          what_they_do_summary: normalized.whatTheyDoSummary,
          location_text: normalized.locationText,
          phone: normalized.phone,
          website: normalized.website,
          website_domain: normalized.websiteDomain
        })
        .select("id")
        .single();

      if (inserted.error) {
        await logRunError(runId, campaign.id, raw.sourceName, inserted.error);
        if (processed % 5 === 0 || processed === cappedRaw.length) {
          await logRunEvent(
            runId,
            campaign.id,
            `Save progress: ${processed}/${cappedRaw.length} processed | inserted ${counters.insertedCount} | updated ${counters.updatedCount} | rejected ${counters.rejectedNoEmailCount}`
          );
          await flushRunMetrics(runId, counters, "running");
        }
        continue;
      }

      leadId = inserted.data.id;
      counters.insertedCount += 1;
    }

    if (!leadId) {
      if (processed % 5 === 0 || processed === cappedRaw.length) {
        await logRunEvent(
          runId,
          campaign.id,
          `Save progress: ${processed}/${cappedRaw.length} processed | inserted ${counters.insertedCount} | updated ${counters.updatedCount} | rejected ${counters.rejectedNoEmailCount}`
        );
        await flushRunMetrics(runId, counters, "running");
      }
      continue;
    }

    await supabase.from("lead_sources").insert({
      lead_id: leadId,
      campaign_id: campaign.id,
      run_id: runId,
      source_name: raw.sourceName,
      external_id: raw.externalId ?? null,
      external_url: raw.externalUrl ?? null,
      raw_payload_hash: payloadHash(raw.raw),
      raw_payload: raw.raw
    });

    enrichmentJobs.push({
      leadId,
      name: normalized.name,
      email: normalizedEmail,
      website: normalized.website,
      whatTheyDoSummary: normalized.whatTheyDoSummary
    });

    if (processed % 5 === 0 || processed === cappedRaw.length) {
      await logRunEvent(
        runId,
        campaign.id,
        `Save progress: ${processed}/${cappedRaw.length} processed | inserted ${counters.insertedCount} | updated ${counters.updatedCount} | rejected ${counters.rejectedNoEmailCount}`
      );
      await flushRunMetrics(runId, counters, "running");
    }
  }

  await logRunEvent(runId, campaign.id, `Starting enrichment on ${enrichmentJobs.length} leads (parallel x6)...`);

  let enrichedCount = 0;
  await mapLimit(enrichmentJobs, 6, async (job) => {
    await enrichAndPersistLead(runId, campaign.id, job);
    enrichedCount += 1;
    if (enrichedCount % 5 === 0 || enrichedCount === enrichmentJobs.length) {
      await logRunEvent(runId, campaign.id, `Enrichment progress: ${enrichedCount}/${enrichmentJobs.length}`);
    }
  });

  await logRunEvent(runId, campaign.id, "Run completed.");
  await flushRunMetrics(runId, counters, "completed");
}
