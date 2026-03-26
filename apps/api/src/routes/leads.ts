import { Router } from "express";
import { listLeadsQuerySchema } from "@outreach/contracts";
import { supabase } from "../db.js";
import { aggregateLeadCatalogRows, matchesLeadSearch, sourceRowMatchesKeyword } from "../services/lead-catalog.js";

export const leadsRouter = Router();

leadsRouter.get("/", async (req, res) => {
  const parsed = listLeadsQuerySchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const includeArchivedCampaigns = parsed.data.includeArchivedCampaigns ?? true;
  const needsSourceFirst = Boolean(parsed.data.campaignId || parsed.data.keyword || parsed.data.sourceName);

  let sourceRows:
    Array<{
      lead_id: string;
      source_name: "google" | "yelp" | "apify";
      matched_keyword: string | null;
      campaigns: Array<{ id: string; sub_niche: string; location_scope: string; status: string; niche_keywords: string[] }> | null;
    }> = [];

  let leads:
    Array<{
      id: string;
      campaign_id: string;
      last_run_id: string | null;
      name: string;
      email: string | null;
      what_they_do_summary: string | null;
      location_text: string | null;
      phone: string | null;
      website: string | null;
      website_domain: string | null;
      created_at: string;
      updated_at: string;
    }> = [];

  if (needsSourceFirst) {
    let sourceQuery = supabase
      .from("lead_sources")
      .select("lead_id,source_name,matched_keyword,campaigns(id,sub_niche,location_scope,status,niche_keywords)")
      .order("created_at", { ascending: false })
      .limit(5000);

    if (parsed.data.campaignId) sourceQuery = sourceQuery.eq("campaign_id", parsed.data.campaignId);
    if (parsed.data.sourceName) sourceQuery = sourceQuery.eq("source_name", parsed.data.sourceName);

    const sourceResult = await sourceQuery;
    if (sourceResult.error) return res.status(500).json({ error: sourceResult.error.message });

    sourceRows = (sourceResult.data ?? [])
      .filter((row) => includeArchivedCampaigns ? true : row.campaigns?.[0]?.status !== "archived")
      .filter((row) => parsed.data.keyword
        ? sourceRowMatchesKeyword({ matched_keyword: row.matched_keyword, campaign: row.campaigns?.[0] ?? null }, parsed.data.keyword)
        : true);

    const leadIds = [...new Set(sourceRows.map((row) => row.lead_id))];
    if (!leadIds.length) return res.json([]);

    let leadQuery = supabase
      .from("leads")
      .select("*")
      .in("id", leadIds)
      .not("email", "ilike", "%@pending.local")
      .order("created_at", { ascending: false })
      .limit(2000);

    if (parsed.data.runId) leadQuery = leadQuery.eq("last_run_id", parsed.data.runId);

    const leadResult = await leadQuery;
    if (leadResult.error) return res.status(500).json({ error: leadResult.error.message });
    leads = (leadResult.data ?? []).filter((lead) => matchesLeadSearch(lead, parsed.data));

    const visibleLeadIds = new Set(leads.map((lead) => lead.id));
    sourceRows = sourceRows.filter((row) => visibleLeadIds.has(row.lead_id));
  } else {
    let leadQuery = supabase
      .from("leads")
      .select("*")
      .not("email", "ilike", "%@pending.local")
      .order("created_at", { ascending: false })
      .limit(2000);

    if (parsed.data.runId) leadQuery = leadQuery.eq("last_run_id", parsed.data.runId);

    const leadResult = await leadQuery;
    if (leadResult.error) return res.status(500).json({ error: leadResult.error.message });

    leads = (leadResult.data ?? []).filter((lead) => matchesLeadSearch(lead, parsed.data));
    const leadIds = leads.map((lead) => lead.id);
    if (!leadIds.length) return res.json([]);

    const sourceResult = await supabase
      .from("lead_sources")
      .select("lead_id,source_name,matched_keyword,campaigns(id,sub_niche,location_scope,status,niche_keywords)")
      .in("lead_id", leadIds)
      .limit(5000);

    if (sourceResult.error) return res.status(500).json({ error: sourceResult.error.message });

    sourceRows = (sourceResult.data ?? [])
      .filter((row) => includeArchivedCampaigns ? true : row.campaigns?.[0]?.status !== "archived")
      .filter((row) => parsed.data.keyword
        ? sourceRowMatchesKeyword({ matched_keyword: row.matched_keyword, campaign: row.campaigns?.[0] ?? null }, parsed.data.keyword)
        : true);

    if (parsed.data.keyword) {
      const visibleLeadIds = new Set(sourceRows.map((row) => row.lead_id));
      leads = leads.filter((lead) => visibleLeadIds.has(lead.id));
    }
  }

  const rows = aggregateLeadCatalogRows(
    leads.slice(0, 500),
    sourceRows.map((row) => ({
      lead_id: row.lead_id,
      source_name: row.source_name,
      matched_keyword: row.matched_keyword,
      campaign: row.campaigns?.[0] ?? null
    }))
  );

  return res.json(rows.slice(0, 500));
});
