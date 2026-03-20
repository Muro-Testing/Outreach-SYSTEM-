import { Router } from "express";
import { generateOutreachRequestSchema } from "@outreach/contracts";
import { supabase } from "../db.js";
import { generateEmailsForLeads } from "../services/outreach.js";
import type { LeadForOutreach, OfferForOutreach } from "../services/outreach.js";
import { env } from "../env.js";

export const outreachRouter = Router();

// POST /api/outreach/generate
// Generates emails for all leads in a campaign using a saved offer.
// Upserts into lead_outreach (unique on lead_id + offer_id).
outreachRouter.post("/generate", async (req, res) => {
  const parsed = generateOutreachRequestSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { campaignId, offerId } = parsed.data;

  // Fetch offer
  const offerResult = await supabase
    .from("offers")
    .select("id,offer_name,offer_summary,target_problem,key_outcome,call_to_action")
    .eq("id", offerId)
    .single();

  if (offerResult.error || !offerResult.data) {
    return res.status(404).json({ error: "Offer not found" });
  }

  const offer: OfferForOutreach = offerResult.data;

  // Fetch all leads for campaign
  const leadsResult = await supabase
    .from("leads")
    .select("id,name,email,phone,website,location_text,what_they_do_summary")
    .eq("campaign_id", campaignId);

  if (leadsResult.error) {
    return res.status(500).json({ error: leadsResult.error.message });
  }

  const leads: LeadForOutreach[] = leadsResult.data ?? [];

  if (leads.length === 0) {
    return res.json({ generated: 0, rows: [] });
  }

  // Generate emails (concurrency = 5)
  const generated = await generateEmailsForLeads(leads, offer, 5);

  // Upsert into lead_outreach
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
    generated_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }));

  const upsertResult = await supabase
    .from("lead_outreach")
    .upsert(upsertRows, { onConflict: "lead_id,offer_id" });

  if (upsertResult.error) {
    return res.status(500).json({ error: upsertResult.error.message });
  }

  // Return combined rows
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

  return res.json({ generated: rows.length, rows });
});

// GET /api/outreach?campaignId=...&offerId=...
// Returns saved outreach rows for export.
outreachRouter.get("/", async (req, res) => {
  const { campaignId, offerId } = req.query as { campaignId?: string; offerId?: string };

  if (!campaignId || !offerId) {
    return res.status(400).json({ error: "campaignId and offerId are required" });
  }

  // Join lead_outreach with leads to get contact fields
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

  if (result.error) return res.status(500).json({ error: result.error.message });

  const rows = (result.data ?? []).map((row: Record<string, unknown>) => {
    const lead = row.leads as Record<string, unknown>;
    return {
      lead_id: row.lead_id,
      offer_id: row.offer_id,
      name: lead?.name ?? "",
      email: lead?.email ?? null,
      phone: lead?.phone ?? null,
      website: lead?.website ?? null,
      location_text: lead?.location_text ?? null,
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
