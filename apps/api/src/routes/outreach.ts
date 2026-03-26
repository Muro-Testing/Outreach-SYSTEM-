import { Router } from "express";
import { z } from "zod";
import { supabase } from "../db.js";
import { generateEmailsForLeads } from "../services/outreach.js";
import type { LeadForOutreach, OfferForOutreach } from "../services/outreach.js";
import { env } from "../env.js";

export const outreachRouter = Router();

const generateOutreachRequestSchema = z
  .object({
    campaignId: z.string().uuid().optional(),
    listId: z.string().uuid().optional(),
    offerId: z.string().uuid()
  })
  .refine((data) => Boolean(data.campaignId || data.listId), {
    message: "campaignId or listId required"
  });

const outreachHistoryListQuerySchema = z.object({
  campaignId: z.string().uuid().optional(),
  listId: z.string().uuid().optional(),
  offerId: z.string().uuid().optional(),
  limit: z
    .union([z.string(), z.number()])
    .optional()
    .transform((value) => {
      if (value === undefined) return 30;
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) return 30;
      return Math.max(1, Math.min(100, Math.floor(parsed)));
    })
});

type OutreachSource =
  | { sourceType: "campaign"; campaignId: string; listId: null }
  | { sourceType: "list"; campaignId: null; listId: string };

type OutreachHistorySummaryRow = {
  id: string;
  source_type: "campaign" | "list";
  campaign_id: string | null;
  list_id: string | null;
  offer_id: string;
  generated_count: number;
  model_version: string;
  created_at: string;
  offer_name: string;
  campaign_name: string | null;
  list_name: string | null;
};

function getOutreachSource(input: { campaignId?: string; listId?: string }): OutreachSource {
  if (input.listId) {
    return { sourceType: "list", campaignId: null, listId: input.listId };
  }
  return { sourceType: "campaign", campaignId: input.campaignId!, listId: null };
}

function mapRowsForResponse(rows: Record<string, unknown>[]) {
  return rows.map((row) => ({
    lead_id: String(row.lead_id ?? ""),
    offer_id: String(row.offer_id ?? ""),
    name: String(row.name ?? ""),
    email: (row.email as string | null | undefined) ?? null,
    phone: (row.phone as string | null | undefined) ?? null,
    website: (row.website as string | null | undefined) ?? null,
    location_text: (row.location_text as string | null | undefined) ?? null,
    opener_subject: String(row.opener_subject ?? ""),
    opener_body: String(row.opener_body ?? ""),
    followup1_subject: String(row.followup1_subject ?? ""),
    followup1_body: String(row.followup1_body ?? ""),
    followup2_subject: String(row.followup2_subject ?? ""),
    followup2_body: String(row.followup2_body ?? "")
  }));
}

async function fetchOffer(offerId: string): Promise<OfferForOutreach | null> {
  const result = await supabase
    .from("offers")
    .select("id,offer_name,offer_summary,target_problem,key_outcome,call_to_action")
    .eq("id", offerId)
    .single();

  if (result.error || !result.data) {
    return null;
  }

  return result.data;
}

async function fetchLeadsForOutreach(source: OutreachSource): Promise<LeadForOutreach[]> {
  if (source.listId) {
    const result = await supabase
      .from("outreach_list_leads")
      .select("leads(id, name, email, phone, website, location_text, what_they_do_summary)")
      .eq("list_id", source.listId);

    if (result.error) {
      throw new Error(result.error.message);
    }

    return (result.data ?? []).map((row: any) => row.leads).filter(Boolean);
  }

  const result = await supabase
    .from("leads")
    .select("id,name,email,phone,website,location_text,what_they_do_summary")
    .eq("campaign_id", source.campaignId);

  if (result.error) {
    throw new Error(result.error.message);
  }

  return result.data ?? [];
}

async function listOutreachHistory(filters: {
  campaignId?: string;
  listId?: string;
  offerId?: string;
  limit: number;
}): Promise<OutreachHistorySummaryRow[]> {
  let query = supabase
    .from("outreach_generations")
    .select(`
      id,
      source_type,
      campaign_id,
      list_id,
      offer_id,
      generated_count,
      model_version,
      created_at,
      offers!inner(offer_name),
      campaigns(sub_niche,location_scope),
      outreach_lists(name)
    `)
    .order("created_at", { ascending: false })
    .limit(filters.limit);

  if (filters.campaignId) query = query.eq("campaign_id", filters.campaignId);
  if (filters.listId) query = query.eq("list_id", filters.listId);
  if (filters.offerId) query = query.eq("offer_id", filters.offerId);

  const result = await query;

  if (result.error) {
    throw new Error(result.error.message);
  }

  return (result.data ?? []).map((row: any) => ({
    id: row.id,
    source_type: row.source_type,
    campaign_id: row.campaign_id,
    list_id: row.list_id,
    offer_id: row.offer_id,
    generated_count: row.generated_count,
    model_version: row.model_version,
    created_at: row.created_at,
    offer_name: row.offers?.offer_name ?? "",
    campaign_name: row.campaigns ? `${row.campaigns.sub_niche} - ${row.campaigns.location_scope}` : null,
    list_name: row.outreach_lists?.name ?? null
  }));
}

outreachRouter.post("/generate", async (req, res) => {
  const parsed = generateOutreachRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const { campaignId, listId, offerId } = parsed.data;
  const source = getOutreachSource({ campaignId, listId });

  const offer = await fetchOffer(offerId);
  if (!offer) {
    return res.status(404).json({ error: "Offer not found" });
  }

  let leads: LeadForOutreach[] = [];
  try {
    leads = await fetchLeadsForOutreach(source);
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : "Failed to load leads" });
  }

  if (leads.length === 0) {
    return res.json({ generated: 0, rows: [], history: null });
  }

  const generated = await generateEmailsForLeads(leads, offer, 5);
  const now = new Date().toISOString();

  const generationInsert = await supabase
    .from("outreach_generations")
    .insert({
      source_type: source.sourceType,
      campaign_id: source.campaignId,
      list_id: source.listId,
      offer_id: offerId,
      generated_count: generated.length,
      model_version: env.mistralModel,
      created_at: now
    })
    .select("id")
    .single();

  if (generationInsert.error || !generationInsert.data) {
    return res.status(500).json({ error: generationInsert.error?.message ?? "Failed to save outreach history" });
  }

  const generationId = generationInsert.data.id;

  const historyRows = generated.map(({ lead, emails }) => ({
    generation_id: generationId,
    lead_id: lead.id,
    offer_id: offerId,
    name: lead.name,
    email: lead.email,
    phone: lead.phone,
    website: lead.website,
    location_text: lead.location_text,
    opener_subject: emails.opener_subject,
    opener_body: emails.opener_body,
    followup1_subject: emails.followup1_subject,
    followup1_body: emails.followup1_body,
    followup2_subject: emails.followup2_subject,
    followup2_body: emails.followup2_body,
    created_at: now
  }));

  const historyInsert = await supabase.from("outreach_generation_rows").insert(historyRows);
  if (historyInsert.error) {
    await supabase.from("outreach_generations").delete().eq("id", generationId);
    return res.status(500).json({ error: historyInsert.error.message });
  }

  const upsertRows = generated.map(({ lead, emails }) => ({
    lead_id: lead.id,
    offer_id: offerId,
    opener_subject: emails.opener_subject,
    opener_body: emails.opener_body,
    followup1_subject: emails.followup1_subject,
    followup1_body: emails.followup1_body,
    followup2_subject: emails.followup2_subject,
    followup2_body: emails.followup2_body,
    model_version: env.mistralModel,
    generated_at: now,
    updated_at: now
  }));

  const upsertResult = await supabase
    .from("lead_outreach")
    .upsert(upsertRows, { onConflict: "lead_id,offer_id" });

  if (upsertResult.error) {
    return res.status(500).json({ error: upsertResult.error.message });
  }

  const rows = generated.map(({ lead, emails }) => ({
    lead_id: lead.id,
    offer_id: offerId,
    name: lead.name,
    email: lead.email,
    phone: lead.phone,
    website: lead.website,
    location_text: lead.location_text,
    ...emails
  }));

  const [historySummary] = await listOutreachHistory({
    campaignId: source.campaignId ?? undefined,
    listId: source.listId ?? undefined,
    offerId,
    limit: 1
  });

  return res.json({
    generated: rows.length,
    rows,
    history: historySummary ?? null
  });
});

outreachRouter.get("/history", async (req, res) => {
  const parsed = outreachHistoryListQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  try {
    const history = await listOutreachHistory(parsed.data);
    return res.json(history);
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : "Failed to load outreach history" });
  }
});

outreachRouter.get("/history/:id", async (req, res) => {
  const id = req.params.id;

  const generationResult = await supabase
    .from("outreach_generations")
    .select(`
      id,
      source_type,
      campaign_id,
      list_id,
      offer_id,
      generated_count,
      model_version,
      created_at,
      offers!inner(offer_name),
      campaigns(sub_niche,location_scope),
      outreach_lists(name)
    `)
    .eq("id", id)
    .single();

  if (generationResult.error || !generationResult.data) {
    return res.status(404).json({ error: "Outreach history entry not found" });
  }

  const rowsResult = await supabase
    .from("outreach_generation_rows")
    .select(`
      lead_id,
      offer_id,
      name,
      email,
      phone,
      website,
      location_text,
      opener_subject,
      opener_body,
      followup1_subject,
      followup1_body,
      followup2_subject,
      followup2_body
    `)
    .eq("generation_id", id)
    .order("name", { ascending: true });

  if (rowsResult.error) {
    return res.status(500).json({ error: rowsResult.error.message });
  }

  const generation = generationResult.data as any;

  return res.json({
    id: generation.id,
    source_type: generation.source_type,
    campaign_id: generation.campaign_id,
    list_id: generation.list_id,
    offer_id: generation.offer_id,
    generated_count: generation.generated_count,
    model_version: generation.model_version,
    created_at: generation.created_at,
    offer_name: generation.offers?.offer_name ?? "",
    campaign_name: generation.campaigns ? `${generation.campaigns.sub_niche} - ${generation.campaigns.location_scope}` : null,
    list_name: generation.outreach_lists?.name ?? null,
    rows: mapRowsForResponse(rowsResult.data ?? [])
  });
});

outreachRouter.get("/", async (req, res) => {
  const { campaignId, listId, offerId } = req.query as {
    campaignId?: string;
    listId?: string;
    offerId?: string;
  };

  if (!offerId) {
    return res.status(400).json({ error: "offerId is required" });
  }
  if (!campaignId && !listId) {
    return res.status(400).json({ error: "campaignId or listId is required" });
  }

  if (listId) {
    const listLeadsResult = await supabase
      .from("outreach_list_leads")
      .select("lead_id")
      .eq("list_id", listId);

    if (listLeadsResult.error) {
      return res.status(500).json({ error: listLeadsResult.error.message });
    }

    const leadIds = (listLeadsResult.data ?? []).map((row: any) => row.lead_id);
    if (leadIds.length === 0) {
      return res.json([]);
    }

    const result = await supabase
      .from("lead_outreach")
      .select(`
        lead_id,
        offer_id,
        opener_subject,
        opener_body,
        followup1_subject,
        followup1_body,
        followup2_subject,
        followup2_body,
        generated_at,
        leads!inner(id,name,email,phone,website,location_text)
      `)
      .eq("offer_id", offerId)
      .in("lead_id", leadIds);

    if (result.error) {
      return res.status(500).json({ error: result.error.message });
    }

    const rows = (result.data ?? []).map((row: any) => {
      const lead = row.leads as Record<string, unknown>;
      return {
        lead_id: row.lead_id,
        offer_id: row.offer_id,
        name: String(lead?.name ?? ""),
        email: (lead?.email as string | null | undefined) ?? null,
        phone: (lead?.phone as string | null | undefined) ?? null,
        website: (lead?.website as string | null | undefined) ?? null,
        location_text: (lead?.location_text as string | null | undefined) ?? null,
        opener_subject: row.opener_subject,
        opener_body: row.opener_body,
        followup1_subject: row.followup1_subject,
        followup1_body: row.followup1_body,
        followup2_subject: row.followup2_subject,
        followup2_body: row.followup2_body
      };
    });

    return res.json(rows);
  }

  const result = await supabase
    .from("lead_outreach")
    .select(`
      lead_id,
      offer_id,
      opener_subject,
      opener_body,
      followup1_subject,
      followup1_body,
      followup2_subject,
      followup2_body,
      generated_at,
      leads!inner(id,name,email,phone,website,location_text,campaign_id)
    `)
    .eq("offer_id", offerId)
    .eq("leads.campaign_id", campaignId);

  if (result.error) {
    return res.status(500).json({ error: result.error.message });
  }

  const rows = (result.data ?? []).map((row: any) => {
    const lead = row.leads as Record<string, unknown>;
    return {
      lead_id: row.lead_id,
      offer_id: row.offer_id,
      name: String(lead?.name ?? ""),
      email: (lead?.email as string | null | undefined) ?? null,
      phone: (lead?.phone as string | null | undefined) ?? null,
      website: (lead?.website as string | null | undefined) ?? null,
      location_text: (lead?.location_text as string | null | undefined) ?? null,
      opener_subject: row.opener_subject,
      opener_body: row.opener_body,
      followup1_subject: row.followup1_subject,
      followup1_body: row.followup1_body,
      followup2_subject: row.followup2_subject,
      followup2_body: row.followup2_body
    };
  });

  return res.json(rows);
});
