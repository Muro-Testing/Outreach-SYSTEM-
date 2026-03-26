import { Router } from "express";
import { createCampaignRequestSchema, runCampaignRequestSchema } from "@outreach/contracts";
import { supabase } from "../db.js";
import { executeCollectionRun, buildQueryFingerprint } from "../services/collection.js";

export const campaignsRouter = Router();

campaignsRouter.get("/", async (_, res) => {
  const result = await supabase.from("campaigns").select("*").order("created_at", { ascending: false });
  if (result.error) return res.status(500).json({ error: result.error.message });
  return res.json(result.data);
});

campaignsRouter.get("/:id/latest-run", async (req, res) => {
  const campaignId = req.params.id;
  const run = await supabase
    .from("collection_runs")
    .select("*")
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (run.error) return res.status(500).json({ error: run.error.message });
  if (!run.data) return res.json(null);

  const errors = await supabase
    .from("run_errors")
    .select("*")
    .eq("run_id", run.data.id)
    .order("created_at", { ascending: false })
    .limit(20);

  if (errors.error) return res.status(500).json({ error: errors.error.message });

  return res.json({
    ...run.data,
    errors: errors.data ?? []
  });
});

campaignsRouter.post("/", async (req, res) => {
  const parsed = createCampaignRequestSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const result = await supabase
    .from("campaigns")
    .insert({
      niche_keywords: parsed.data.nicheKeywords,
      sub_niche: parsed.data.subNiche,
      location_scope: parsed.data.locationScope,
      offer_note: parsed.data.offerNote,
      status: "active"
    })
    .select("*")
    .single();

  if (result.error) return res.status(500).json({ error: result.error.message });
  return res.status(201).json(result.data);
});

campaignsRouter.post("/:id/run", async (req, res) => {
  const campaignId = req.params.id;
  const runBody = runCampaignRequestSchema.safeParse(req.body ?? {});
  if (!runBody.success) return res.status(400).json({ error: runBody.error.flatten() });

  const sources = {
    google: runBody.data.sources?.google ?? true,
    yelp: runBody.data.sources?.yelp ?? false,
    apify: runBody.data.sources?.apify ?? false
  };

  const targetLeads = runBody.data.targetLeads ?? 30;

  if (!sources.google && !sources.yelp && !sources.apify) {
    return res.status(400).json({ error: "Select at least one source before running collection." });
  }

  const campaign = await supabase
    .from("campaigns")
    .select("id,niche_keywords,sub_niche,location_scope")
    .eq("id", campaignId)
    .single();

  if (campaign.error || !campaign.data) return res.status(404).json({ error: "Campaign not found" });

  const force = Boolean(runBody.data.force);
  if (!force) {
    const fingerprint = buildQueryFingerprint(campaign.data.niche_keywords, campaign.data.location_scope);
    const existing = await supabase
      .from("collection_runs")
      .select("id, campaign_id, inserted_count, updated_count, completed_at")
      .eq("query_fingerprint", fingerprint)
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing.data) {
      const leadCount = (existing.data.inserted_count ?? 0) + (existing.data.updated_count ?? 0);
      return res.status(409).json({
        duplicate: true,
        existingRunId: existing.data.id,
        existingCampaignId: existing.data.campaign_id,
        leadCount,
        completedAt: existing.data.completed_at
      });
    }
  }

  const run = await supabase
    .from("collection_runs")
    .insert({
      campaign_id: campaignId,
      status: "queued"
    })
    .select("*")
    .single();

  if (run.error || !run.data) return res.status(500).json({ error: run.error?.message ?? "Run create failed" });

  void executeCollectionRun(run.data.id, campaign.data, sources, { targetLeads }).catch(async (err) => {
    await supabase
      .from("collection_runs")
      .update({ status: "failed", completed_at: new Date().toISOString() })
      .eq("id", run.data.id);
    await supabase.from("run_errors").insert({
      run_id: run.data.id,
      campaign_id: campaignId,
      source_name: "apify",
      error_message: err instanceof Error ? err.message : "Unhandled run failure",
      error_detail: err instanceof Error ? String(err.stack ?? "") : "",
      retryable: false
    });
  });

  return res.status(202).json(run.data);
});
