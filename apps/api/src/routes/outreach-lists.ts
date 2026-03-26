import { Router } from "express";
import { supabase } from "../db.js";
import { z } from "zod";

export const outreachListsRouter = Router();

// GET / — list all outreach lists with lead count
outreachListsRouter.get("/", async (_, res) => {
  const { data: lists, error } = await supabase
    .from("outreach_lists")
    .select("id, name, created_at")
    .order("created_at", { ascending: false });
  if (error) return res.status(500).json({ error: error.message });

  // Get lead counts for each list
  const withCounts = await Promise.all(
    (lists ?? []).map(async (list) => {
      const { count } = await supabase
        .from("outreach_list_leads")
        .select("*", { count: "exact", head: true })
        .eq("list_id", list.id);
      return { ...list, lead_count: count ?? 0 };
    })
  );
  return res.json(withCounts);
});

// POST / — create a new outreach list, optionally with initial lead IDs
// Body: { name: string, leadIds?: string[] }
outreachListsRouter.post("/", async (req, res) => {
  const schema = z.object({
    name: z.string().min(1),
    leadIds: z.array(z.string().uuid()).optional()
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { data: list, error } = await supabase
    .from("outreach_lists")
    .insert({ name: parsed.data.name })
    .select("*")
    .single();
  if (error || !list) return res.status(500).json({ error: error?.message ?? "Insert failed" });

  if (parsed.data.leadIds && parsed.data.leadIds.length > 0) {
    const rows = parsed.data.leadIds.map((lead_id) => ({ list_id: list.id, lead_id }));
    await supabase.from("outreach_list_leads").upsert(rows, { onConflict: "list_id,lead_id" });
  }

  return res.status(201).json({ ...list, lead_count: parsed.data.leadIds?.length ?? 0 });
});

// POST /:id/leads — add lead IDs to existing list
// Body: { leadIds: string[] }
outreachListsRouter.post("/:id/leads", async (req, res) => {
  const listId = req.params.id;
  const schema = z.object({ leadIds: z.array(z.string().uuid()).min(1) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const rows = parsed.data.leadIds.map((lead_id) => ({ list_id: listId, lead_id }));
  const { error } = await supabase
    .from("outreach_list_leads")
    .upsert(rows, { onConflict: "list_id,lead_id" });
  if (error) return res.status(500).json({ error: error.message });

  const { count } = await supabase
    .from("outreach_list_leads")
    .select("*", { count: "exact", head: true })
    .eq("list_id", listId);

  return res.json({ added: parsed.data.leadIds.length, total: count ?? 0 });
});

// DELETE /:id — delete the list (not the leads)
outreachListsRouter.delete("/:id", async (req, res) => {
  const { error } = await supabase.from("outreach_lists").delete().eq("id", req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  return res.status(204).send();
});
