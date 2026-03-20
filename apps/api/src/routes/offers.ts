import { Router } from "express";
import { createOfferRequestSchema } from "@outreach/contracts";
import { supabase } from "../db.js";

export const offersRouter = Router();

offersRouter.get("/", async (_, res) => {
  const result = await supabase
    .from("offers")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false });
  if (result.error) return res.status(500).json({ error: result.error.message });
  return res.json(result.data);
});

offersRouter.post("/", async (req, res) => {
  const parsed = createOfferRequestSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const result = await supabase
    .from("offers")
    .insert({
      offer_name: parsed.data.offerName,
      offer_summary: parsed.data.offerSummary,
      target_problem: parsed.data.targetProblem,
      key_outcome: parsed.data.keyOutcome,
      call_to_action: parsed.data.callToAction
    })
    .select("*")
    .single();

  if (result.error) return res.status(500).json({ error: result.error.message });
  return res.status(201).json(result.data);
});

offersRouter.delete("/:id", async (req, res) => {
  const { id } = req.params;
  const result = await supabase.from("offers").update({ is_active: false }).eq("id", id);
  if (result.error) return res.status(500).json({ error: result.error.message });
  return res.json({ ok: true });
});
