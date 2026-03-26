import { aggregateLeadCatalogRows, matchesLeadSearch } from "../apps/api/src/services/lead-catalog.js";

const leads = [
  {
    id: "lead-1",
    campaign_id: "campaign-a",
    last_run_id: "run-1",
    name: "Bright Dental",
    email: "hello@bright.example",
    what_they_do_summary: "Dental implants and cosmetic dentistry",
    location_text: "London, UK",
    phone: "123",
    website: "https://bright.example",
    website_domain: "bright.example",
    created_at: "2026-03-26T10:00:00.000Z",
    updated_at: "2026-03-26T10:00:00.000Z"
  },
  {
    id: "lead-2",
    campaign_id: "campaign-c",
    last_run_id: "run-2",
    name: "Calm Skin Studio",
    email: "hello@calmskin.example",
    what_they_do_summary: "Skin clinic and facial treatments",
    location_text: "Manchester, UK",
    phone: "456",
    website: "https://calmskin.example",
    website_domain: "calmskin.example",
    created_at: "2026-03-26T09:00:00.000Z",
    updated_at: "2026-03-26T09:00:00.000Z"
  }
];

const sourceRows = [
  {
    lead_id: "lead-1",
    source_name: "google" as const,
    matched_keyword: "dentist",
    campaign: { id: "campaign-a", sub_niche: "Cosmetic Dentistry", location_scope: "London, UK", status: "active" }
  },
  {
    lead_id: "lead-1",
    source_name: "google" as const,
    matched_keyword: "dental implants",
    campaign: { id: "campaign-b", sub_niche: "Implant Clinic", location_scope: "London, UK", status: "archived" }
  },
  {
    lead_id: "lead-2",
    source_name: "yelp" as const,
    matched_keyword: null,
    campaign: { id: "campaign-c", sub_niche: "Skin Clinic", location_scope: "Manchester, UK", status: "active" }
  }
];

const aggregated = aggregateLeadCatalogRows(leads, sourceRows);

const output = {
  metadata: {
    task: "global-leads-validation",
    executedAt: new Date().toISOString(),
    leadCount: leads.length,
    sourceRowCount: sourceRows.length
  },
  raw_output: {
    leads,
    sourceRows
  },
  processed_output: {
    aggregated,
    dentistKeywordLeadIds: aggregated.filter((lead) => lead.matched_keywords.includes("dentist")).map((lead) => lead.id),
    implantTextLeadIds: aggregated.filter((lead) => matchesLeadSearch(lead, { q: "implant" })).map((lead) => lead.id),
    londonLeadIds: aggregated.filter((lead) => matchesLeadSearch(lead, { location: "london" })).map((lead) => lead.id)
  }
};

console.log(JSON.stringify(output, null, 2));
