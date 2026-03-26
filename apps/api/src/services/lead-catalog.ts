import type { SourceName } from "../types.js";

type LeadRecord = {
  id: string;
  campaign_id: string;
  last_run_id: string | null;
  name: string;
  email: string | null;
  what_they_do_summary: string | null;
  location_text: string | null;
  phone: string | null;
  website: string | null;
  website_domain?: string | null;
  created_at: string;
  updated_at?: string;
};

type CampaignSummary = {
  id: string;
  sub_niche: string;
  location_scope: string;
  status: string;
  niche_keywords?: string[];
};

type SourceRow = {
  lead_id: string;
  source_name: SourceName;
  matched_keyword: string | null;
  campaign: CampaignSummary | null;
};

export type LeadCatalogRow = LeadRecord & {
  matched_keywords: string[];
  source_names: SourceName[];
  campaigns: CampaignSummary[];
};

function contains(haystack: string | null | undefined, needle: string): boolean {
  return (haystack ?? "").toLowerCase().includes(needle);
}

export function matchesLeadSearch(
  lead: LeadRecord,
  filters: { q?: string; location?: string }
): boolean {
  const q = filters.q?.trim().toLowerCase();
  const location = filters.location?.trim().toLowerCase();

  if (q) {
    const qMatched =
      contains(lead.name, q) ||
      contains(lead.email, q) ||
      contains(lead.what_they_do_summary, q) ||
      contains(lead.website, q) ||
      contains(lead.location_text, q);

    if (!qMatched) return false;
  }

  if (location && !contains(lead.location_text, location)) {
    return false;
  }

  return true;
}

export function sourceRowMatchesKeyword(
  row: { matched_keyword: string | null; campaign: CampaignSummary | null },
  keyword: string
): boolean {
  const needle = keyword.trim().toLowerCase();
  if (!needle) return true;
  if ((row.matched_keyword ?? "").trim().toLowerCase() === needle) return true;
  return (row.campaign?.niche_keywords ?? []).some((value) => value.trim().toLowerCase() === needle);
}

export function aggregateLeadCatalogRows(leads: LeadRecord[], sourceRows: SourceRow[]): LeadCatalogRow[] {
  const sourceMap = new Map<string, SourceRow[]>();
  for (const row of sourceRows) {
    const list = sourceMap.get(row.lead_id) ?? [];
    list.push(row);
    sourceMap.set(row.lead_id, list);
  }

  return leads
    .map((lead) => {
      const related = sourceMap.get(lead.id) ?? [];
      const keywordSet = new Set<string>();
      const sourceNameSet = new Set<SourceName>();
      const campaignMap = new Map<string, CampaignSummary>();

      for (const row of related) {
        if (row.matched_keyword) keywordSet.add(row.matched_keyword);
        for (const keyword of row.campaign?.niche_keywords ?? []) keywordSet.add(keyword);
        sourceNameSet.add(row.source_name);
        if (row.campaign?.id) campaignMap.set(row.campaign.id, row.campaign);
      }

      return {
        ...lead,
        matched_keywords: [...keywordSet].sort((a, b) => a.localeCompare(b)),
        source_names: [...sourceNameSet],
        campaigns: [...campaignMap.values()]
      };
    })
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}
