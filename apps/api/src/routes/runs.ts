import { Router } from "express";
import { supabase } from "../db.js";

export const runsRouter = Router();

const RUN_EVENT_LIMIT = 120;

runsRouter.get("/:id", async (req, res) => {
  const runId = req.params.id;
  const run = await supabase.from("collection_runs").select("*").eq("id", runId).single();
  if (run.error || !run.data) return res.status(404).json({ error: "Run not found" });

  const errors = await supabase
    .from("run_errors")
    .select("*")
    .eq("run_id", runId)
    .order("created_at", { ascending: false })
    .limit(RUN_EVENT_LIMIT);

  return res.json({
    ...run.data,
    errors: errors.data ?? []
  });
});

runsRouter.post("/:id/cancel", async (req, res) => {
  const runId = req.params.id;

  const run = await supabase
    .from("collection_runs")
    .select("id,campaign_id,status")
    .eq("id", runId)
    .single();

  if (run.error || !run.data) return res.status(404).json({ error: "Run not found" });
  if (run.data.status !== "queued" && run.data.status !== "running") {
    return res.status(400).json({ error: `Only queued or running runs can be stopped. Current status: ${run.data.status}` });
  }

  const stoppedAt = new Date().toISOString();
  const update = await supabase
    .from("collection_runs")
    .update({
      status: "failed",
      completed_at: stoppedAt,
      updated_at: stoppedAt
    })
    .eq("id", runId)
    .select("*")
    .single();

  if (update.error || !update.data) {
    return res.status(500).json({ error: update.error?.message ?? "Failed to stop run" });
  }

  await supabase.from("run_errors").insert({
    run_id: runId,
    campaign_id: run.data.campaign_id,
    source_name: "pipeline",
    error_message: "[info] Run stop requested by user.",
    error_detail: null,
    retryable: false
  });

  const errors = await supabase
    .from("run_errors")
    .select("*")
    .eq("run_id", runId)
    .order("created_at", { ascending: false })
    .limit(RUN_EVENT_LIMIT);

  return res.json({
    ...update.data,
    errors: errors.data ?? []
  });
});
