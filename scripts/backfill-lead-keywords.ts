import { supabase } from "../apps/api/src/db.js";

type LeadSourceRow = {
  id: string;
  run_id: string;
  campaign_id: string;
  matched_keyword: string | null;
  campaigns: Array<{ id: string; niche_keywords: string[] }> | null;
};

async function main() {
  const sourceResult = await supabase
    .from("lead_sources")
    .select("id,run_id,campaign_id,matched_keyword,campaigns(id,niche_keywords)")
    .eq("source_name", "google")
    .is("matched_keyword", null)
    .limit(10000);

  if (sourceResult.error) throw new Error(sourceResult.error.message);
  const rows = (sourceResult.data ?? []) as LeadSourceRow[];

  const runIds = [...new Set(rows.map((row) => row.run_id))];
  const queryResult = runIds.length
    ? await supabase
        .from("search_queries")
        .select("run_id,keyword")
        .in("run_id", runIds)
        .limit(20000)
    : { data: [], error: null as null | { message: string } };

  if (queryResult.error) throw new Error(queryResult.error.message);

  const keywordsByRun = new Map<string, string[]>();
  for (const row of queryResult.data ?? []) {
    const list = keywordsByRun.get(row.run_id) ?? [];
    list.push(row.keyword);
    keywordsByRun.set(row.run_id, list);
  }

  const updates: Array<{ id: string; matched_keyword: string }> = [];
  let assignedFromRun = 0;
  let assignedFromCampaign = 0;
  let unresolved = 0;

  for (const row of rows) {
    const distinctRunKeywords = [...new Set((keywordsByRun.get(row.run_id) ?? []).map((value) => value.trim()).filter(Boolean))];
    if (distinctRunKeywords.length === 1) {
      updates.push({ id: row.id, matched_keyword: distinctRunKeywords[0] });
      assignedFromRun += 1;
      continue;
    }

    const campaignKeywords = [...new Set((row.campaigns?.[0]?.niche_keywords ?? []).map((value) => value.trim()).filter(Boolean))];
    if (campaignKeywords.length === 1) {
      updates.push({ id: row.id, matched_keyword: campaignKeywords[0] });
      assignedFromCampaign += 1;
      continue;
    }

    unresolved += 1;
  }

  for (let i = 0; i < updates.length; i += 200) {
    const batch = updates.slice(i, i + 200);
    for (const update of batch) {
      const result = await supabase
        .from("lead_sources")
        .update({ matched_keyword: update.matched_keyword })
        .eq("id", update.id);
      if (result.error) throw new Error(result.error.message);
    }
  }

  const output = {
    metadata: {
      executedAt: new Date().toISOString(),
      scannedRows: rows.length,
      updatedRows: updates.length
    },
    processed_output: {
      assignedFromRun,
      assignedFromCampaign,
      unresolved
    }
  };

  console.log(JSON.stringify(output, null, 2));
}

void main().catch((err) => {
  console.error(JSON.stringify({
    error: err instanceof Error ? err.message : String(err)
  }, null, 2));
  process.exit(1);
});
