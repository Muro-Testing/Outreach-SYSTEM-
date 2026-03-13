import { Router } from "express";
import { listLeadsQuerySchema } from "@outreach/contracts";
import { supabase } from "../db.js";

export const leadsRouter = Router();

leadsRouter.get("/", async (req, res) => {
  const parsed = listLeadsQuerySchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  let query = supabase
    .from("leads")
    .select("*")
    .not("email", "ilike", "%@pending.local")
    .order("created_at", { ascending: false })
    .limit(500);

  if (parsed.data.campaignId) query = query.eq("campaign_id", parsed.data.campaignId);
  if (parsed.data.runId) query = query.eq("last_run_id", parsed.data.runId);
  if (parsed.data.location) query = query.ilike("location_text", `%${parsed.data.location}%`);
  if (parsed.data.q) query = query.or(`name.ilike.%${parsed.data.q}%,email.ilike.%${parsed.data.q}%`);

  const result = await query;
  if (result.error) return res.status(500).json({ error: result.error.message });
  return res.json(result.data);
});
