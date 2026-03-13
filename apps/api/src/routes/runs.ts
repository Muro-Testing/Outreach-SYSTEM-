import { Router } from "express";
import { supabase } from "../db.js";

export const runsRouter = Router();

runsRouter.get("/:id", async (req, res) => {
  const runId = req.params.id;
  const run = await supabase.from("collection_runs").select("*").eq("id", runId).single();
  if (run.error || !run.data) return res.status(404).json({ error: "Run not found" });

  const errors = await supabase
    .from("run_errors")
    .select("*")
    .eq("run_id", runId)
    .order("created_at", { ascending: false })
    .limit(20);

  return res.json({
    ...run.data,
    errors: errors.data ?? []
  });
});
