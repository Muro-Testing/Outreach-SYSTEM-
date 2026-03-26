import { describe, expect, it } from "vitest";
import { aggregateLeadCatalogRows, matchesLeadSearch, sourceRowMatchesKeyword } from "../src/services/lead-catalog.js";

describe("lead catalog", () => {
  it("aggregates matched keywords and campaign provenance per lead", () => {
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
      }
    ];

    const rows = aggregateLeadCatalogRows(leads, [
      {
        lead_id: "lead-1",
        source_name: "google",
        matched_keyword: "dentist",
        campaign: { id: "campaign-a", sub_niche: "Cosmetic Dentistry", location_scope: "London, UK", status: "active", niche_keywords: ["dentist"] }
      },
      {
        lead_id: "lead-1",
        source_name: "google",
        matched_keyword: "dental implants",
        campaign: { id: "campaign-b", sub_niche: "Implant Clinic", location_scope: "London, UK", status: "archived", niche_keywords: ["dental implants", "dentist"] }
      }
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0].matched_keywords).toEqual(["dental implants", "dentist"]);
    expect(rows[0].campaigns).toEqual([
      { id: "campaign-a", sub_niche: "Cosmetic Dentistry", location_scope: "London, UK", status: "active", niche_keywords: ["dentist"] },
      { id: "campaign-b", sub_niche: "Implant Clinic", location_scope: "London, UK", status: "archived", niche_keywords: ["dental implants", "dentist"] }
    ]);
    expect(rows[0].source_names).toEqual(["google"]);
  });

  it("matches business text and location filters against lead-facing fields", () => {
    const lead = {
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
    };

    expect(matchesLeadSearch(lead, { q: "implant" })).toBe(true);
    expect(matchesLeadSearch(lead, { q: "bright.example" })).toBe(true);
    expect(matchesLeadSearch(lead, { q: "chiropractor" })).toBe(false);
    expect(matchesLeadSearch(lead, { location: "london" })).toBe(true);
    expect(matchesLeadSearch(lead, { location: "manchester" })).toBe(false);
  });

  it("falls back to campaign keywords for legacy rows without matched keyword", () => {
    expect(sourceRowMatchesKeyword({
      matched_keyword: null,
      campaign: {
        id: "campaign-a",
        sub_niche: "Cosmetic Dentistry",
        location_scope: "London, UK",
        status: "active",
        niche_keywords: ["dentist", "dental clinic"]
      }
    }, "dentist")).toBe(true);

    expect(sourceRowMatchesKeyword({
      matched_keyword: null,
      campaign: {
        id: "campaign-a",
        sub_niche: "Cosmetic Dentistry",
        location_scope: "London, UK",
        status: "active",
        niche_keywords: ["dentist", "dental clinic"]
      }
    }, "implant")).toBe(false);
  });
});
