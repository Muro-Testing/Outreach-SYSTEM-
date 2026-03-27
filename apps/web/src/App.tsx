import { FormEvent, useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { api } from "./lib/api";

// Ã¢â€â‚¬Ã¢â€â‚¬ Types Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
type Campaign = {
  id: string; niche_keywords: string[]; sub_niche: string;
  location_scope: string; offer_note: string; status: string; created_at: string;
};
type Run = {
  id: string; status: "queued" | "running" | "completed" | "failed";
  total_candidates: number; inserted_count: number; updated_count: number;
  deduped_count: number; rejected_no_email_count: number;
  errors?: Array<{ error_message: string; source_name: string; created_at: string }>;
};
type LeadCampaign = {
  id: string; sub_niche: string; location_scope: string; status: string;
};
type Lead = {
  id: string; name: string; email: string | null; what_they_do_summary: string | null;
  location_text: string | null; phone: string | null; website: string | null;
  matched_keywords: string[]; source_names: string[]; campaigns: LeadCampaign[];
};
type Offer = {
  id: string; offer_name: string; offer_summary: string; target_problem: string;
  key_outcome: string; call_to_action: string; is_active: boolean; created_at: string;
};
type OutreachList = { id: string; name: string; lead_count: number; created_at: string; };
type OutreachRow = {
  lead_id: string; offer_id: string; name: string; email: string | null;
  phone: string | null; website: string | null; location_text: string | null;
  opener_subject: string; opener_body: string; followup1_subject: string;
  followup1_body: string; followup2_subject: string; followup2_body: string;
};
type OutreachHistorySummary = {
  id: string; source_type: "campaign" | "list"; campaign_id: string | null; list_id: string | null;
  offer_id: string; generated_count: number; model_version: string; created_at: string;
  offer_name: string; campaign_name: string | null; list_name: string | null;
};
type OutreachHistoryDetail = OutreachHistorySummary & { rows: OutreachRow[] };
type ModalEmail = {
  name: string; opener_subject: string; opener_body: string;
  followup1_subject: string; followup1_body: string;
  followup2_subject: string; followup2_body: string;
};
type OutreachModelOption = "default" | "large" | "medium" | "small";
type OutreachExportFormat = "csv" | "xlsx";
type KeywordMatch = { keyword: string; resultsCount: number; searchedAt: string; runId: string; campaignId: string };
type DuplicateWarning =
  | { duplicateType: "campaign"; existingRunId: string; existingCampaignId: string; leadCount: number; completedAt: string }
  | { duplicateType: "keyword"; keywordMatches: KeywordMatch[] };
type OfferFields = {
  offerName: string; offerSummary: string; targetProblem: string;
  keyOutcome: string; callToAction: string;
};

function mapOfferToFields(offer: Offer): OfferFields {
  return {
    offerName: offer.offer_name,
    offerSummary: offer.offer_summary,
    targetProblem: offer.target_problem,
    keyOutcome: offer.key_outcome,
    callToAction: offer.call_to_action
  };
}

export function App() {
  // Ã¢â€â‚¬Ã¢â€â‚¬ Collection state Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState("");
  const [run, setRun] = useState<Run | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [leadViewMode, setLeadViewMode] = useState<"all" | "campaign">("all");
  const [filters, setFilters] = useState({ campaignId: "", keyword: "", q: "", location: "", sourceName: "" });
  const [sources, setSources] = useState({ google: true, yelp: false, apify: false });
  const [targetLeads, setTargetLeads] = useState(30);
  const [expandedSummaries, setExpandedSummaries] = useState<Record<string, boolean>>({});
  const [form, setForm] = useState({
    nicheKeywords: "dentist, dental clinic", subNiche: "cosmetic dentistry",
    locationScope: "London, UK"
  });
  const [duplicateWarning, setDuplicateWarning] = useState<DuplicateWarning | null>(null);

  // Ã¢â€â‚¬Ã¢â€â‚¬ Lead selection state Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());
  const [showListModal, setShowListModal] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [listModalLoading, setListModalLoading] = useState(false);
  const [listModalError, setListModalError] = useState("");

  // Ã¢â€â‚¬Ã¢â€â‚¬ Offers state Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  const [offers, setOffers] = useState<Offer[]>([]);
  const [selectedOfferId, setSelectedOfferId] = useState("");
  const [offerForm, setOfferForm] = useState<OfferFields>({
    offerName: "", offerSummary: "", targetProblem: "", keyOutcome: "", callToAction: ""
  });
  const [offerLoading, setOfferLoading] = useState(false);
  const [offerError, setOfferError] = useState("");
  const [showOfferForm, setShowOfferForm] = useState(false);
  const [editingOfferId, setEditingOfferId] = useState<string | null>(null);
  const [offerMode, setOfferMode] = useState<"manual" | "ai">("manual");
  const [aiIdeaText, setAiIdeaText] = useState("");
  const [aiDrafting, setAiDrafting] = useState(false);
  const [aiRefined, setAiRefined] = useState(false); // true after first AI draft Ã¢â‚¬â€ shows refine row
  const [refinementNote, setRefinementNote] = useState("");
  const [aiRefining, setAiRefining] = useState(false);

  // Ã¢â€â‚¬Ã¢â€â‚¬ Outreach Lists state Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  const [outreachLists, setOutreachLists] = useState<OutreachList[]>([]);

  // Ã¢â€â‚¬Ã¢â€â‚¬ Outreach generation state Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  const [outreachRows, setOutreachRows] = useState<OutreachRow[]>([]);
  const [generatingOutreach, setGeneratingOutreach] = useState(false);
  const [outreachError, setOutreachError] = useState("");
  const [outreachCampaignId, setOutreachCampaignId] = useState("");
  const [outreachListId, setOutreachListId] = useState("");
  const [outreachSourceMode, setOutreachSourceMode] = useState<"campaign" | "list">("campaign");
  const [outreachModel, setOutreachModel] = useState<OutreachModelOption>("default");
  const [outreachExportFormat, setOutreachExportFormat] = useState<OutreachExportFormat>("csv");
  const [outreachWebhookUrl, setOutreachWebhookUrl] = useState("");
  const [sendingOutreachWebhook, setSendingOutreachWebhook] = useState(false);
  const [outreachHistory, setOutreachHistory] = useState<OutreachHistorySummary[]>([]);
  const [outreachHistoryLoaded, setOutreachHistoryLoaded] = useState(false);
  const [selectedOutreachHistoryId, setSelectedOutreachHistoryId] = useState("");
  const [loadingOutreachHistory, setLoadingOutreachHistory] = useState(false);
  const [historyRestored, setHistoryRestored] = useState(false);
  const [modalEmail, setModalEmail] = useState<ModalEmail | null>(null);
  const [refineOpen, setRefineOpen] = useState(false);
  const [refineInstructions, setRefineInstructions] = useState("");
  const [refining, setRefining] = useState(false);
  const [refineError, setRefineError] = useState("");
  const [refineProgress, setRefineProgress] = useState<{ completed: number; total: number } | null>(null);

  // Ã¢â€â‚¬Ã¢â€â‚¬ Derived Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  const selectedCampaign = useMemo(() => campaigns.find(c => c.id === selectedCampaignId) ?? null, [campaigns, selectedCampaignId]);
  const selectedOffer = useMemo(() => offers.find(o => o.id === selectedOfferId) ?? null, [offers, selectedOfferId]);
  const outreachCampaign = useMemo(() => campaigns.find(c => c.id === outreachCampaignId) ?? null, [campaigns, outreachCampaignId]);
  const outreachList = useMemo(() => outreachLists.find(l => l.id === outreachListId) ?? null, [outreachLists, outreachListId]);
  const selectedOutreachHistory = useMemo(
    () => outreachHistory.find((entry) => entry.id === selectedOutreachHistoryId) ?? null,
    [outreachHistory, selectedOutreachHistoryId]
  );
  const visibleCampaignFilterId = leadViewMode === "campaign" ? selectedCampaignId : filters.campaignId;
  const hasActiveFilters = Boolean(
    filters.campaignId.trim() || filters.keyword.trim() || filters.q.trim() || filters.location.trim() || filters.sourceName.trim()
  );
  const allLeadsSelected = leads.length > 0 && leads.every(l => selectedLeadIds.has(l.id));
  const someLeadsSelected = selectedLeadIds.size > 0;
  const keywordOptions = useMemo(
    () => [...new Set(leads.flatMap((lead) => lead.matched_keywords))].sort((a, b) => a.localeCompare(b)),
    [leads]
  );
  const campaignFilterOptions = useMemo(() => {
    const seen = new Map<string, LeadCampaign>();
    for (const lead of leads) {
      for (const campaign of lead.campaigns) {
        if (!seen.has(campaign.id)) seen.set(campaign.id, campaign);
      }
    }
    return [...seen.values()].sort((a, b) => `${a.sub_niche} ${a.location_scope}`.localeCompare(`${b.sub_niche} ${b.location_scope}`));
  }, [leads]);
  const orderedOutreachHistory = useMemo(() => {
    const score = (entry: OutreachHistorySummary) => {
      let points = 0;
      if (selectedOfferId && entry.offer_id === selectedOfferId) points += 4;
      if (outreachSourceMode === "campaign" && outreachCampaignId && entry.campaign_id === outreachCampaignId) points += 3;
      if (outreachSourceMode === "list" && outreachListId && entry.list_id === outreachListId) points += 3;
      if (entry.source_type === outreachSourceMode) points += 1;
      return points;
    };
    return [...outreachHistory].sort((a, b) => {
      const diff = score(b) - score(a);
      if (diff !== 0) return diff;
      return b.created_at.localeCompare(a.created_at);
    });
  }, [outreachHistory, outreachSourceMode, outreachCampaignId, outreachListId, selectedOfferId]);

  const runEvents = [...(run?.errors ?? [])].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const latestRunEvent = [...runEvents].reverse().find(e => e.error_message.startsWith("[info]"))?.error_message.replace(/^\[info\]\s*/, "") ?? "";
  const processedCount = (run?.inserted_count ?? 0) + (run?.updated_count ?? 0) + (run?.rejected_no_email_count ?? 0);
  const progressPct = run ? (run.total_candidates > 0 ? Math.min(100, Math.round((processedCount / run.total_candidates) * 100)) : run.status === "completed" ? 100 : 0) : 0;

  // Ã¢â€â‚¬Ã¢â€â‚¬ Data loaders Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  async function loadCampaigns() {
    const data = await api<Campaign[]>("/api/campaigns");
    setCampaigns(data);
    if (!data.length) {
      setSelectedCampaignId("");
      return;
    }
    if (!selectedCampaignId || !data.some((campaign) => campaign.id === selectedCampaignId)) {
      setSelectedCampaignId(data[0].id);
    }
  }
  async function loadLeads() {
    const params = new URLSearchParams();
    if (visibleCampaignFilterId) params.set("campaignId", visibleCampaignFilterId);
    if (filters.keyword) params.set("keyword", filters.keyword);
    if (filters.q) params.set("q", filters.q);
    if (filters.location) params.set("location", filters.location);
    if (filters.sourceName) params.set("sourceName", filters.sourceName);
    const data = await api<Lead[]>(`/api/leads?${params.toString()}`);
    setLeads(data);
  }
  async function loadLatestRun(campaignId: string) {
    const data = await api<Run | null>(`/api/campaigns/${campaignId}/latest-run`);
    setRun(data);
  }
  async function loadOffers() {
    const data = await api<Offer[]>("/api/offers");
    setOffers(data);
    if (data[0] && !selectedOfferId) setSelectedOfferId(data[0].id);
  }
  async function loadOutreachLists() {
    const data = await api<OutreachList[]>("/api/outreach-lists");
    setOutreachLists(data);
  }
  async function loadOutreachHistory() {
    try {
      const data = await api<OutreachHistorySummary[]>("/api/outreach/history?limit=50");
      setOutreachHistory(data);
    } finally {
      setOutreachHistoryLoaded(true);
    }
  }
  async function loadOutreachHistoryEntry(historyId: string) {
    if (!historyId) return;
    setLoadingOutreachHistory(true);
    setOutreachError("");
    try {
      const data = await api<OutreachHistoryDetail>(`/api/outreach/history/${historyId}`);
      setSelectedOutreachHistoryId(data.id);
      setOutreachRows(data.rows);
      setSelectedOfferId(data.offer_id);
      if (data.source_type === "campaign") {
        setOutreachSourceMode("campaign");
        setOutreachCampaignId(data.campaign_id ?? "");
      } else {
        setOutreachSourceMode("list");
        setOutreachListId(data.list_id ?? "");
      }
      window.localStorage.setItem("outreach:last-history-id", data.id);
    } catch (err) {
      setOutreachError(err instanceof Error ? err.message : "Failed to load saved outreach");
    } finally {
      setLoadingOutreachHistory(false);
    }
  }

  // Ã¢â€â‚¬Ã¢â€â‚¬ Effects Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  useEffect(() => {
    void loadCampaigns().catch(err => setError((err as Error).message));
    void loadOffers().catch(() => undefined);
    void loadOutreachLists().catch(() => undefined);
    void loadOutreachHistory().catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!selectedCampaignId) { setRun(null); return; }
    void loadLatestRun(selectedCampaignId).catch(err => setError((err as Error).message));
  }, [selectedCampaignId]);

  useEffect(() => {
    void loadLeads().catch(err => setError((err as Error).message));
    setSelectedLeadIds(new Set());
  }, [selectedCampaignId, leadViewMode, filters.campaignId, filters.keyword, filters.q, filters.location, filters.sourceName]);

  useEffect(() => {
    if (!run || (run.status !== "queued" && run.status !== "running")) return;
    const interval = setInterval(() => {
      void api<Run>(`/api/runs/${run.id}`).then(setRun).catch(() => undefined);
      void loadLeads().catch(() => undefined);
    }, 1500);
    return () => clearInterval(interval);
  }, [run]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") { setModalEmail(null); setShowListModal(false); setDuplicateWarning(null); } }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const savedWebhookUrl = window.localStorage.getItem("outreach:webhook-url");
    if (savedWebhookUrl) setOutreachWebhookUrl(savedWebhookUrl);
  }, []);

  useEffect(() => {
    if (!outreachHistoryLoaded) return;
    if (historyRestored) return;
    if (outreachHistory.length === 0) {
      setHistoryRestored(true);
      return;
    }
    const lastHistoryId = window.localStorage.getItem("outreach:last-history-id");
    if (!lastHistoryId || !outreachHistory.some((entry) => entry.id === lastHistoryId)) {
      setHistoryRestored(true);
      return;
    }
    setHistoryRestored(true);
    void loadOutreachHistoryEntry(lastHistoryId);
  }, [historyRestored, outreachHistory, outreachHistoryLoaded]);

  // Ã¢â€â‚¬Ã¢â€â‚¬ Handlers: Collection Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  async function onCreateCampaign(e: FormEvent) {
    e.preventDefault(); setLoading(true); setError("");
    try {
      await api("/api/campaigns", {
        method: "POST",
        body: JSON.stringify({
          nicheKeywords: form.nicheKeywords.split(",").map(v => v.trim()).filter(Boolean),
          subNiche: form.subNiche, locationScope: form.locationScope
        })
      });
      await loadCampaigns();
    } catch (err) { setError(err instanceof Error ? err.message : "Campaign creation failed"); }
    finally { setLoading(false); }
  }

  async function onRunCampaign(force = false) {
    if (!selectedCampaignId) return;
    if (!sources.google && !sources.yelp && !sources.apify) { setError("Select at least one source."); return; }
    setLoading(true); setError(""); setDuplicateWarning(null);
    try {
      const createdRun = await api<Run>(`/api/campaigns/${selectedCampaignId}/run`, {
        method: "POST",
        body: JSON.stringify({ sources, targetLeads: Math.max(1, Math.min(500, Number(targetLeads) || 30)), force })
      });
      setRun(createdRun);
    } catch (err: unknown) {
      // 409 = duplicate search warning Ã¢â‚¬â€ body is attached to err.body by api()
      const apiErr = err as Error & { status?: number; body?: Record<string, unknown> };
      if (apiErr.status === 409 && apiErr.body?.duplicate) {
        setDuplicateWarning(apiErr.body as unknown as DuplicateWarning);
        setLoading(false);
        return;
      }
      setError(err instanceof Error ? err.message : "Run failed");
    }
    finally { setLoading(false); }
  }

  // Ã¢â€â‚¬Ã¢â€â‚¬ Handlers: Lead selection Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  function toggleLead(id: string) {
    setSelectedLeadIds(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  }
  function toggleAllLeads() {
    if (allLeadsSelected) setSelectedLeadIds(new Set());
    else setSelectedLeadIds(new Set(leads.map(l => l.id)));
  }

  async function onArchiveCampaign() {
    if (!selectedCampaignId) return;
    const confirmed = window.confirm("Archive this campaign? Its leads and run history will stay available in All Leads.");
    if (!confirmed) return;

    setLoading(true);
    setError("");
    try {
      await api(`/api/campaigns/${selectedCampaignId}/archive`, { method: "PATCH" });
      setLeadViewMode("all");
      if (filters.campaignId === selectedCampaignId) {
        setFilters((current) => ({ ...current, campaignId: "" }));
      }
      await loadCampaigns();
      await loadLeads();
      setRun(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to archive campaign");
    } finally {
      setLoading(false);
    }
  }

  async function onAddToExistingList(listId: string) {
    if (selectedLeadIds.size === 0) return;
    setListModalLoading(true); setListModalError("");
    try {
      await api(`/api/outreach-lists/${listId}/leads`, {
        method: "POST", body: JSON.stringify({ leadIds: [...selectedLeadIds] })
      });
      await loadOutreachLists();
      setShowListModal(false); setSelectedLeadIds(new Set());
    } catch (err) { setListModalError(err instanceof Error ? err.message : "Failed to add leads"); }
    finally { setListModalLoading(false); }
  }

  async function onCreateListWithLeads() {
    if (!newListName.trim() || selectedLeadIds.size === 0) return;
    setListModalLoading(true); setListModalError("");
    try {
      await api("/api/outreach-lists", {
        method: "POST", body: JSON.stringify({ name: newListName.trim(), leadIds: [...selectedLeadIds] })
      });
      await loadOutreachLists();
      setShowListModal(false); setNewListName(""); setSelectedLeadIds(new Set());
    } catch (err) { setListModalError(err instanceof Error ? err.message : "Failed to create list"); }
    finally { setListModalLoading(false); }
  }

  async function onDeleteList(id: string) {
    try {
      await api(`/api/outreach-lists/${id}`, { method: "DELETE" });
      setOutreachLists(prev => prev.filter(l => l.id !== id));
      if (outreachListId === id) setOutreachListId("");
    } catch { /* ignore */ }
  }

  // Ã¢â€â‚¬Ã¢â€â‚¬ Handlers: Offers Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  async function onSaveOffer(e: FormEvent) {
    e.preventDefault(); setOfferLoading(true); setOfferError("");
    try {
      const saved = editingOfferId
        ? await api<Offer>(`/api/offers/${editingOfferId}`, { method: "PATCH", body: JSON.stringify(offerForm) })
        : await api<Offer>("/api/offers", { method: "POST", body: JSON.stringify(offerForm) });
      setOffers(prev => editingOfferId
        ? prev.map((offer) => offer.id === editingOfferId ? saved : offer)
        : [saved, ...prev]);
      setSelectedOfferId(saved.id);
      setEditingOfferId(null);
      setOfferForm({ offerName: "", offerSummary: "", targetProblem: "", keyOutcome: "", callToAction: "" });
      setAiIdeaText(""); setAiRefined(false); setRefinementNote("");
      setShowOfferForm(false);
    } catch (err) { setOfferError(err instanceof Error ? err.message : "Failed to save offer"); }
    finally { setOfferLoading(false); }
  }

  function onEditOffer(offer: Offer, mode: "manual" | "ai" = "manual") {
    setSelectedOfferId(offer.id);
    setEditingOfferId(offer.id);
    setOfferForm(mapOfferToFields(offer));
    setOfferMode(mode);
    setShowOfferForm(true);
    setOfferError("");
    setAiIdeaText("");
    setRefinementNote("");
    setAiRefined(mode === "ai");
  }

  function onCancelOfferForm() {
    setShowOfferForm(false);
    setEditingOfferId(null);
    setOfferMode("manual");
    setOfferError("");
    setAiIdeaText("");
    setAiRefined(false);
    setRefinementNote("");
    setOfferForm({ offerName: "", offerSummary: "", targetProblem: "", keyOutcome: "", callToAction: "" });
  }

  async function onDeleteOffer(id: string) {
    try {
      await api(`/api/offers/${id}`, { method: "DELETE" });
      const remaining = offers.filter(o => o.id !== id);
      setOffers(remaining);
      if (selectedOfferId === id) setSelectedOfferId(remaining[0]?.id ?? "");
    } catch (err) { setOfferError(err instanceof Error ? err.message : "Failed to remove offer"); }
  }

  async function onAiDraft() {
    if (aiIdeaText.trim().length < 10) return;
    setAiDrafting(true); setOfferError("");
    try {
      const fields = await api<OfferFields>("/api/offers/ai-draft", {
        method: "POST", body: JSON.stringify({ userIdea: aiIdeaText })
      });
      setOfferForm(fields);
      setAiRefined(true);
    } catch (err) { setOfferError(err instanceof Error ? err.message : "AI draft failed"); }
    finally { setAiDrafting(false); }
  }

  async function onAiRefine() {
    if (!refinementNote.trim()) return;
    setAiRefining(true); setOfferError("");
    try {
      const fields = await api<OfferFields>("/api/offers/ai-refine", {
        method: "POST", body: JSON.stringify({ currentFields: offerForm, refinementNote })
      });
      setOfferForm(fields);
      setRefinementNote("");
    } catch (err) { setOfferError(err instanceof Error ? err.message : "Refinement failed"); }
    finally { setAiRefining(false); }
  }

  // Ã¢â€â‚¬Ã¢â€â‚¬ Handlers: Outreach Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  async function onGenerateOutreach() {
    const payload = outreachSourceMode === "campaign"
      ? { campaignId: outreachCampaignId, offerId: selectedOfferId, model: outreachModel }
      : { listId: outreachListId, offerId: selectedOfferId, model: outreachModel };
    setGeneratingOutreach(true); setOutreachError(""); setOutreachRows([]);
    try {
      const result = await api<{ generated: number; rows: OutreachRow[]; history: OutreachHistorySummary | null }>("/api/outreach/generate", {
        method: "POST", body: JSON.stringify(payload)
      });
      setOutreachRows(result.rows);
      if (result.history) {
        setSelectedOutreachHistoryId(result.history.id);
        window.localStorage.setItem("outreach:last-history-id", result.history.id);
      }
      await loadOutreachHistory();
    } catch (err) {
      if (err instanceof Error && "status" in err && (err as Error & { status?: number }).status === 504) {
        setOutreachError("Outreach generation timed out at the gateway. Try the Medium or Small model, or generate against a smaller lead set.");
      } else {
        setOutreachError(err instanceof Error ? err.message : "Generation failed");
      }
    }
    finally { setGeneratingOutreach(false); }
  }

  async function onRefineOutreach() {
    if (!selectedOutreachHistoryId) return;
    setRefining(true); setRefineError(""); setRefineProgress(null);
    try {
      const res = await fetch(`/api/outreach/refine/${selectedOutreachHistoryId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instructions: refineInstructions.trim() || undefined, model: outreachModel })
      });
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? `Request failed (${res.status})`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";
        for (const part of parts) {
          if (!part.startsWith("data: ")) continue;
          const evt = JSON.parse(part.slice(6)) as {
            type: string; completed?: number; total?: number;
            rows?: OutreachRow[]; history?: OutreachHistorySummary; error?: string;
          };
          if (evt.type === "start") {
            setRefineProgress({ completed: 0, total: evt.total ?? 0 });
          } else if (evt.type === "progress") {
            setRefineProgress({ completed: evt.completed ?? 0, total: evt.total ?? 0 });
          } else if (evt.type === "done") {
            setOutreachRows(evt.rows ?? []);
            if (evt.history) {
              setSelectedOutreachHistoryId(evt.history.id);
              window.localStorage.setItem("outreach:last-history-id", evt.history.id);
            }
            await loadOutreachHistory();
            setRefineOpen(false);
            setRefineInstructions("");
            setRefineProgress(null);
          } else if (evt.type === "error") {
            throw new Error(evt.error ?? "Refinement failed");
          }
        }
      }
    } catch (err) {
      setRefineError(err instanceof Error ? err.message : "Refinement failed");
      setRefineProgress(null);
    } finally {
      setRefining(false);
    }
  }


  // Ã¢â€â‚¬Ã¢â€â‚¬ Export helpers Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  function csvCell(v: string | null | undefined) { return `"${String(v ?? "").replace(/"/g, '""')}"`; }
  function today() { return new Date().toISOString().slice(0, 10); }
  function downloadCsv(rows: (string | null | undefined)[][], filename: string) {
    const csv = rows.map(r => r.map(v => csvCell(v)).join(",")).join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  }
  function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
  function getOutreachExportHeaders() {
    return ["Name", "Email", "Phone", "Website", "Location", "Opener Subject", "Opener Body", "Follow-up 1 Subject", "Follow-up 1 Body", "Follow-up 2 Subject", "Follow-up 2 Body"];
  }
  function getOutreachExportRows() {
    return outreachRows.map(r => [
      r.name,
      r.email?.endsWith("@pending.local") ? "" : r.email,
      r.phone ?? "",
      r.website ?? "",
      r.location_text ?? "",
      r.opener_subject,
      r.opener_body,
      r.followup1_subject,
      r.followup1_body,
      r.followup2_subject,
      r.followup2_body
    ]);
  }
  function getOutreachExportBaseName() {
    const slug = (selectedOffer?.offer_name ?? selectedOutreachHistory?.offer_name ?? "outreach").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    const created = selectedOutreachHistory?.created_at.slice(0, 10) ?? today();
    return `outreach-${slug}-${created}`;
  }
  function buildOutreachCsvBlob() {
    const rows = [getOutreachExportHeaders(), ...getOutreachExportRows()];
    const csv = rows.map(r => r.map(v => csvCell(v)).join(",")).join("\n");
    return new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
  }
  function buildOutreachXlsxBlob() {
    const worksheet = XLSX.utils.aoa_to_sheet([getOutreachExportHeaders(), ...getOutreachExportRows()]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Outreach");
    const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    return new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  }
  async function blobToBase64(blob: Blob) {
    const arrayBuffer = await blob.arrayBuffer();
    let binary = "";
    const bytes = new Uint8Array(arrayBuffer);
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    return btoa(binary);
  }
  function onExportLeads() {
    if (!leads.length) { setError("No leads to export."); return; }
    const headers = ["Name", "Email", "What they do", "Keywords", "Campaigns", "Location", "Phone", "Website"];
    const slugBase = leadViewMode === "campaign"
      ? (selectedCampaign?.sub_niche ?? "campaign-leads")
      : "all-leads";
    downloadCsv([headers, ...leads.map(l => [
      l.name,
      l.email?.endsWith("@pending.local") ? "" : l.email,
      l.what_they_do_summary ?? "",
      l.matched_keywords.join(" | "),
      l.campaigns.map((campaign) => `${campaign.sub_niche} - ${campaign.location_scope}`).join(" | "),
      l.location_text ?? "",
      l.phone ?? "",
      l.website ?? ""
    ])],
      `${slugBase.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${today()}.csv`);
  }
  function onExportOutreach() {
    if (!outreachRows.length) { setOutreachError("No rows to export."); return; }
    const fileBaseName = getOutreachExportBaseName();
    if (outreachExportFormat === "xlsx") {
      downloadBlob(buildOutreachXlsxBlob(), `${fileBaseName}.xlsx`);
      return;
    }
    downloadBlob(buildOutreachCsvBlob(), `${fileBaseName}.csv`);
  }
  async function onSendOutreachWebhook() {
    if (!outreachRows.length) { setOutreachError("No rows to send."); return; }
    if (!outreachWebhookUrl.trim()) { setOutreachError("Enter a webhook URL first."); return; }
    setSendingOutreachWebhook(true);
    setOutreachError("");
    try {
      const fileBaseName = getOutreachExportBaseName();
      const blob = outreachExportFormat === "xlsx" ? buildOutreachXlsxBlob() : buildOutreachCsvBlob();
      const fileName = `${fileBaseName}.${outreachExportFormat}`;
      const mimeType = outreachExportFormat === "xlsx"
        ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        : "text/csv;charset=utf-8;";
      const fileBase64 = await blobToBase64(blob);
      await api<{ ok: true; status: number }>("/api/outreach/export-webhook", {
        method: "POST",
        body: JSON.stringify({
          webhookUrl: outreachWebhookUrl.trim(),
          format: outreachExportFormat,
          fileName,
          mimeType,
          fileBase64,
          generatedCount: outreachRows.length,
          historyId: selectedOutreachHistoryId || null
        })
      });
      window.localStorage.setItem("outreach:webhook-url", outreachWebhookUrl.trim());
    } catch (err) {
      setOutreachError(err instanceof Error ? err.message : "Failed to send webhook");
    } finally {
      setSendingOutreachWebhook(false);
    }
  }

  function compactList(items: string[], limit = 1) {
    if (!items.length) return "-";
    if (items.length <= limit) return items.join(", ");
    return `${items.slice(0, limit).join(", ")} +${items.length - limit}`;
  }

  const canGenerate = selectedOfferId && (outreachSourceMode === "campaign" ? !!outreachCampaignId : !!outreachListId) && !generatingOutreach;

  function formatHistoryLabel(entry: OutreachHistorySummary) {
    const sourceLabel = entry.source_type === "campaign"
      ? (entry.campaign_name ?? "Campaign")
      : (entry.list_name ?? "Outreach list");
    const dateLabel = new Date(entry.created_at).toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit"
    });
    const refined = entry.model_version.startsWith("refined:") ? "Refined · " : "";
    return `${refined}${dateLabel} · ${sourceLabel} · ${entry.offer_name} · ${entry.generated_count} rows`;
  }

  function jumpToSection(sectionId: string) {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // Ã¢â€â‚¬Ã¢â€â‚¬ Render Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
  return (
    <>
      {/* Ã¢â€â‚¬Ã¢â€â‚¬ Duplicate Search Warning Modal Ã¢â€â‚¬Ã¢â€â‚¬ */}
      {duplicateWarning && (
        <div className="modal-backdrop" onClick={() => setDuplicateWarning(null)}>
          <div className="modal modal-warning" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Keywords already searched</h3>
              <button className="modal-close" onClick={() => setDuplicateWarning(null)}>×</button>
            </div>
            <div className="modal-body" style={{ gap: "1rem" }}>
              {duplicateWarning.duplicateType === "campaign" ? (
                <div className="dupe-info-box">
                  <div className="dupe-icon">!</div>
                  <div>
                    <strong>This exact search was already completed</strong>
                    <p>It returned <strong>{duplicateWarning.leadCount} leads</strong> on {new Date(duplicateWarning.completedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}.</p>
                    <p>Running again would spend API credits on the same query with no new results.</p>
                  </div>
                </div>
              ) : (
                <div className="dupe-info-box">
                  <div className="dupe-icon">↺</div>
                  <div>
                    <strong>Some keywords were already searched in this location</strong>
                    <p>These keywords already have results saved. Running again may not find new leads:</p>
                    <ul className="dupe-keyword-list">
                      {duplicateWarning.keywordMatches.map(m => (
                        <li key={m.keyword}>
                          <span className="dupe-kw-tag">"{m.keyword}"</span>
                          - {m.resultsCount} leads found on {new Date(m.searchedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
              <div className="dupe-actions">
                {duplicateWarning.duplicateType === "campaign" && (
                  <button className="btn-accent" onClick={() => {
                    setLeadViewMode("campaign");
                    setSelectedCampaignId(duplicateWarning.existingCampaignId);
                    setDuplicateWarning(null);
                  }}>
                    View existing leads
                  </button>
                )}
                <button className="btn-clear" onClick={() => { void onRunCampaign(true); setDuplicateWarning(null); }}>
                  Run fresh anyway
                </button>
                <button className="btn-ghost" onClick={() => setDuplicateWarning(null)}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Ã¢â€â‚¬Ã¢â€â‚¬ Email Preview Modal Ã¢â€â‚¬Ã¢â€â‚¬ */}
      {modalEmail && (
        <div className="modal-backdrop" onClick={() => setModalEmail(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Emails for <span className="modal-name">{modalEmail.name}</span></h3>
              <button className="modal-close" onClick={() => setModalEmail(null)}>×</button>
            </div>
            <div className="modal-body">
              {([
                { label: "Opener", subject: modalEmail.opener_subject, body: modalEmail.opener_body, color: "#1877f2" },
                { label: "Follow-up 1", subject: modalEmail.followup1_subject, body: modalEmail.followup1_body, color: "#7b5ea7" },
                { label: "Follow-up 2", subject: modalEmail.followup2_subject, body: modalEmail.followup2_body, color: "#e67e22" }
              ] as const).map(({ label, subject, body, color }) => (
                <div className="modal-email" key={label}>
                  <div className="modal-email-tag" style={{ background: color }}>{label}</div>
                  <div className="modal-email-subject">{subject}</div>
                  <div className="modal-email-body">{body}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Ã¢â€â‚¬Ã¢â€â‚¬ Add to Outreach List Modal Ã¢â€â‚¬Ã¢â€â‚¬ */}
      {showListModal && (
        <div className="modal-backdrop" onClick={() => setShowListModal(false)}>
          <div className="modal modal-list" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add {selectedLeadIds.size} lead{selectedLeadIds.size !== 1 ? "s" : ""} to Outreach List</h3>
              <button className="modal-close" onClick={() => setShowListModal(false)}>×</button>
            </div>
            <div className="modal-body" style={{ gap: "1.25rem" }}>
              {/* Create new list */}
              <div className="list-modal-section">
                <div className="list-modal-label">Create new list</div>
                <div className="list-modal-create-row">
                  <input
                    value={newListName}
                    onChange={e => setNewListName(e.target.value)}
                    placeholder="e.g. Q2 London Outreach"
                    onKeyDown={e => e.key === "Enter" && void onCreateListWithLeads()}
                  />
                  <button className="btn-purple" disabled={!newListName.trim() || listModalLoading} onClick={() => void onCreateListWithLeads()}>
                    Create &amp; Add
                  </button>
                </div>
              </div>
              {/* Add to existing */}
              {outreachLists.length > 0 && (
                <div className="list-modal-section">
                  <div className="list-modal-label">Add to existing list</div>
                  <div className="list-modal-existing">
                    {outreachLists.map(list => (
                      <button key={list.id} className="list-existing-item" disabled={listModalLoading}
                        onClick={() => void onAddToExistingList(list.id)}>
                        <span className="list-existing-name">{list.name}</span>
                        <span className="list-existing-count">{list.lead_count} leads</span>
                        <span className="list-existing-add">+ Add</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {listModalError && <p className="error">{listModalError}</p>}
            </div>
          </div>
        </div>
      )}

      <main className="layout">
        {/* Ã¢â€â‚¬Ã¢â€â‚¬ Workflow Steps Ã¢â€â‚¬Ã¢â€â‚¬ */}
        <div className="workflow-steps">
          <div className="workflow-step"><div className="step-num">1</div><div className="step-label">Collect Leads</div></div>
          <div className="step-arrow" aria-hidden="true">&rarr;</div>
          <div className="workflow-step"><div className="step-num">2</div><div className="step-label">Build Offer Library</div></div>
          <div className="step-arrow" aria-hidden="true">&rarr;</div>
          <div className="workflow-step"><div className="step-num">3</div><div className="step-label">Generate Outreach</div></div>
        </div>

        <nav className="section-jump-nav" aria-label="Page sections">
          <span className="section-jump-label">Quick jump</span>
          <button type="button" className="section-jump-btn" onClick={() => jumpToSection("step-1-section")}>Step 1</button>
          <button type="button" className="section-jump-btn" onClick={() => jumpToSection("leads-section")}>Leads</button>
          <button type="button" className="section-jump-btn" onClick={() => jumpToSection("step-2-section")}>Step 2</button>
          <button type="button" className="section-jump-btn" onClick={() => jumpToSection("step-3-section")}>Step 3</button>
        </nav>

        {/* Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â STEP 1 Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â */}
        <div className="step-section-label" id="step-1-section">
          <span className="step-badge">Step 1</span> Campaign Setup
        </div>

        <section className="panel panel-glow">
          <header className="panel-header">
            <h1>Outreach Lead Intelligence</h1>
            <p>Manual campaign runs across Google, Yelp-like directories, and Apify actors.</p>
          </header>
          <form className="campaign-form" onSubmit={onCreateCampaign}>
            <label>Collection keywords<input value={form.nicheKeywords} onChange={e => setForm(p => ({ ...p, nicheKeywords: e.target.value }))} placeholder="e.g. dentist, whitening clinic" /></label>
            <label>Sub-niche (optional)<input value={form.subNiche} onChange={e => setForm(p => ({ ...p, subNiche: e.target.value }))} placeholder="Auto-fills from first keyword if left empty" /></label>
            <label>Location<input value={form.locationScope} onChange={e => setForm(p => ({ ...p, locationScope: e.target.value }))} /></label>
            <button className="btn-primary" disabled={loading} type="submit">+ Create Campaign</button>
          </form>
        </section>

        <section className="panel" id="leads-section">
          <div className="inline-row">
            <div>
              <h2>Run Control</h2>
              <p style={{ margin: 0, color: "var(--text-soft)", fontSize: "0.9rem" }}>
                {selectedCampaign ? `${selectedCampaign.sub_niche} - ${selectedCampaign.location_scope}` : "No campaign selected"}
              </p>
            </div>
            <div className="toolbar-actions">
              <button className="btn-clear btn-danger-lite" type="button" disabled={!selectedCampaignId || loading} onClick={() => void onArchiveCampaign()}>
                Archive Campaign
              </button>
              <button className="btn-accent" disabled={!selectedCampaignId || loading} onClick={() => void onRunCampaign(false)}>Run Collection</button>
            </div>
          </div>
          <div className="source-toggles">
            {(["google", "yelp", "apify"] as const).map(src => (
              <label className="toggle-item" key={src}>
                <input type="checkbox" checked={sources[src]} onChange={e => setSources(p => ({ ...p, [src]: e.target.checked }))} />
                {src === "google" ? "Google Maps API" : src === "yelp" ? "Yelp API" : "Apify Actors"}
              </label>
            ))}
            <label className="target-input">Target leads<input type="number" min={1} max={500} value={targetLeads} onChange={e => setTargetLeads(Number(e.target.value || 30))} /></label>
          </div>
          <div className="inline-row" style={{ marginTop: "0.75rem" }}>
            <label>Campaign
              <select value={selectedCampaignId} onChange={e => setSelectedCampaignId(e.target.value)}>
                <option value="">Select campaign</option>
                {campaigns.map(c => <option value={c.id} key={c.id}>{c.sub_niche} - {c.location_scope}</option>)}
              </select>
            </label>
            <div className="run-hint" style={{ maxWidth: "420px" }}>
              Archive hides incomplete campaigns from normal controls while keeping their leads and history available in All Leads.
            </div>
          </div>

          {run && (
            <div className="run-card">
              <div className="run-card-top">
                <strong>Run status:</strong>
                <span className={`run-status-badge run-status-${run.status}`}>{run.status}</span>
              </div>
              <div className="progress-wrap">
                <div className="progress-label">Progress: {progressPct}% ({processedCount}/{run.total_candidates || 0})</div>
                <div className="progress-bar"><div className="progress-fill" style={{ width: `${progressPct}%` }} /></div>
              </div>
              {latestRunEvent && <p className="run-live-status">Live: {latestRunEvent}</p>}
              <div className="metrics">
                {([["Total", run.total_candidates ?? 0], ["Inserted", run.inserted_count ?? 0], ["Updated", run.updated_count ?? 0], ["Deduped", run.deduped_count ?? 0], ["Rejected", run.rejected_no_email_count ?? 0]] as const).map(([label, val]) => (
                  <div className="metric-pill" key={label}><span className="metric-val">{val}</span><span className="metric-label">{label}</span></div>
                ))}
              </div>
              {runEvents.length > 0 && (
                <ul className="run-event-list">
                  {runEvents.map(item => (
                    <li className={item.error_message.startsWith("[info]") ? "run-event run-event-info" : "run-event run-event-error"} key={`${item.created_at}-${item.source_name}`}>
                      [{item.source_name}] {item.error_message.replace(/^\[info\]\s*/, "")}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {error && <p className="error">{error}</p>}
        </section>

        <section className="panel">
          <div className="leads-header">
            <div>
              <h2>{leadViewMode === "all" ? "All Leads" : "Campaign Leads"}</h2>
              <p className="run-hint">{leads.length} lead{leads.length !== 1 ? "s" : ""}{hasActiveFilters ? " (filtered)" : ""}</p>
            </div>
            <div className="toolbar-actions">
              {someLeadsSelected && (
                <button className="btn-purple" type="button" onClick={() => { setShowListModal(true); setListModalError(""); }}>
                  Add {selectedLeadIds.size} to Outreach List
                </button>
              )}
              <button className="btn-clear" type="button" onClick={onExportLeads} disabled={!leads.length}>Export CSV</button>
            </div>
          </div>
          <div className="lead-view-toggle">
            <button type="button" className={`lead-view-btn${leadViewMode === "all" ? " lead-view-btn-active" : ""}`} onClick={() => setLeadViewMode("all")}>
              All Leads
            </button>
            <button
              type="button"
              className={`lead-view-btn${leadViewMode === "campaign" ? " lead-view-btn-active" : ""}`}
              onClick={() => setLeadViewMode("campaign")}
              disabled={!selectedCampaignId}
            >
              Current Campaign
            </button>
          </div>
          <div className="lead-filter-grid">
            {leadViewMode === "all" ? (
              <label>Campaign filter
                <select value={filters.campaignId} onChange={e => setFilters(f => ({ ...f, campaignId: e.target.value }))}>
                  <option value="">All campaigns</option>
                  {campaignFilterOptions.map(c => <option value={c.id} key={c.id}>{c.sub_niche} - {c.location_scope}{c.status === "archived" ? " (archived)" : ""}</option>)}
                </select>
              </label>
            ) : (
              <label>Campaign scope
                <select value={selectedCampaignId} onChange={e => setSelectedCampaignId(e.target.value)}>
                  <option value="">Select campaign</option>
                  {campaigns.map(c => <option value={c.id} key={c.id}>{c.sub_niche} - {c.location_scope}</option>)}
                </select>
              </label>
            )}
            <label>Keyword filter
              <input list="lead-keyword-options" value={filters.keyword} placeholder="Exact Google search keyword" onChange={e => setFilters(f => ({ ...f, keyword: e.target.value }))} />
              <datalist id="lead-keyword-options">
                {keywordOptions.map(keyword => <option value={keyword} key={keyword} />)}
              </datalist>
            </label>
            <label>Business text search<input value={filters.q} placeholder="Name, email, summary, website" onChange={e => setFilters(f => ({ ...f, q: e.target.value }))} /></label>
            <label>Location filter<input value={filters.location} onChange={e => setFilters(f => ({ ...f, location: e.target.value }))} /></label>
            <label>Source filter
              <select value={filters.sourceName} onChange={e => setFilters(f => ({ ...f, sourceName: e.target.value }))}>
                <option value="">All sources</option>
                <option value="google">Google</option>
                <option value="yelp">Yelp</option>
                <option value="apify">Apify</option>
              </select>
            </label>
            <button className="btn-clear lead-filter-clear" type="button" onClick={() => setFilters({ campaignId: "", keyword: "", q: "", location: "", sourceName: "" })} disabled={!hasActiveFilters}>
              Clear Filters
            </button>
          </div>
          <div className="lead-mobile-list">
            {leads.map(lead => (
              <article className={`lead-mobile-card${selectedLeadIds.has(lead.id) ? " row-selected" : ""}`} key={lead.id}>
                <div className="lead-mobile-top">
                  <label className="lead-mobile-check">
                    <input type="checkbox" checked={selectedLeadIds.has(lead.id)} onChange={() => toggleLead(lead.id)} />
                    <span>Select</span>
                  </label>
                  <div className="lead-primary-cell">
                    <strong>{lead.name}</strong>
                    {lead.phone && <span className="lead-subline">{lead.phone}</span>}
                  </div>
                </div>
                <div className="mobile-field-grid">
                  <div><span className="mobile-field-label">Email</span><span>{lead.email && !lead.email.endsWith("@pending.local") ? lead.email : "-"}</span></div>
                  <div><span className="mobile-field-label">Location</span><span>{lead.location_text ?? "-"}</span></div>
                </div>
                <div className="signal-stack">
                  <div className="signal-block">
                    <span className="signal-label">Keywords</span>
                    <div className="tag-list">
                      {lead.matched_keywords.length
                        ? lead.matched_keywords.slice(0, 3).map(keyword => <span className="data-tag data-tag-blue" key={keyword}>{keyword}</span>)
                        : <span className="tag-empty">-</span>}
                    </div>
                    {lead.matched_keywords.length > 2 && <div className="signal-summary">{compactList(lead.matched_keywords, 2)}</div>}
                  </div>
                  <div className="signal-block">
                    <span className="signal-label">Campaigns</span>
                    <div className="tag-list">
                      {lead.campaigns.length
                        ? lead.campaigns.slice(0, 2).map(campaign => (
                          <span className={`data-tag ${campaign.status === "archived" ? "data-tag-muted" : "data-tag-purple"}`} key={campaign.id}>
                            {campaign.sub_niche} - {campaign.location_scope}
                          </span>
                        ))
                        : <span className="tag-empty">-</span>}
                    </div>
                    {lead.campaigns.length > 2 && <div className="signal-summary">{lead.campaigns.length} campaign matches</div>}
                  </div>
                </div>
                <div className="summary-cell">
                  <span className="signal-label">What they do</span>
                  {lead.what_they_do_summary ? (
                    <>
                      <p className={`summary-text${expandedSummaries[lead.id] ? " expanded" : ""}`}>{lead.what_they_do_summary}</p>
                      {lead.what_they_do_summary.length > 160 && (
                        <button className="summary-toggle" type="button" onClick={() => setExpandedSummaries(p => ({ ...p, [lead.id]: !p[lead.id] }))}>
                          {expandedSummaries[lead.id] ? "Collapse" : "Expand"}
                        </button>
                      )}
                    </>
                  ) : <span className="tag-empty">-</span>}
                </div>
                <div className="mobile-field-grid">
                  <div><span className="mobile-field-label">Website</span><span>{lead.website ? <a href={lead.website} target="_blank" rel="noreferrer">{lead.website.replace(/^https?:\/\//, "")}</a> : "-"}</span></div>
                  <div><span className="mobile-field-label">Phone</span><span>{lead.phone ?? "-"}</span></div>
                </div>
              </article>
            ))}
            {!leads.length && (
              <div className="empty-state compact-empty-state">
                <p>{hasActiveFilters ? "No leads match current filters." : "No leads yet. Run a campaign to start building the lead catalog."}</p>
              </div>
            )}
          </div>
          <div className="table-wrap lead-table-wrap">
            <table className="lead-table">
              <thead>
                <tr>
                  <th className="lead-check-col"><input type="checkbox" checked={allLeadsSelected} onChange={toggleAllLeads} title="Select all" /></th>
                  <th className="lead-name-col">Lead</th><th>Email</th><th>Keywords</th><th>Campaigns</th><th>What they do</th><th>Location</th>
                </tr>
              </thead>
              <tbody>
                {leads.map(lead => (
                  <tr key={lead.id} className={selectedLeadIds.has(lead.id) ? "row-selected" : ""}>
                    <td className="lead-check-col"><input type="checkbox" checked={selectedLeadIds.has(lead.id)} onChange={() => toggleLead(lead.id)} /></td>
                    <td className="lead-name-col">
                      <div className="lead-primary-cell">
                        <strong>{lead.name}</strong>
                        {lead.phone && <span className="lead-subline">{lead.phone}</span>}
                        {lead.website && <a className="lead-subline lead-inline-link" href={lead.website} target="_blank" rel="noreferrer">{lead.website.replace(/^https?:\/\//, "")}</a>}
                      </div>
                    </td>
                    <td className="td-mono">{lead.email && !lead.email.endsWith("@pending.local") ? lead.email : "-"}</td>
                    <td>
                      {lead.matched_keywords.length ? (
                        <div className="tag-list">
                          <span className="data-tag data-tag-blue">{lead.matched_keywords[0]}</span>
                          {lead.matched_keywords.length > 1 && <span className="tag-more">+{lead.matched_keywords.length - 1}</span>}
                        </div>
                      ) : <span className="tag-empty">-</span>}
                      {lead.matched_keywords.length > 1 && <div className="signal-summary">{compactList(lead.matched_keywords, 2)}</div>}
                    </td>
                    <td>
                      {lead.campaigns.length ? (
                        <>
                          <div className="tag-list">
                            <span className={`data-tag ${lead.campaigns[0].status === "archived" ? "data-tag-muted" : "data-tag-purple"}`}>
                              {lead.campaigns[0].sub_niche} - {lead.campaigns[0].location_scope}
                            </span>
                            {lead.campaigns.length > 1 && <span className="tag-more">+{lead.campaigns.length - 1}</span>}
                          </div>
                          {lead.campaigns.length > 1 && <div className="signal-summary">{lead.campaigns.length} campaign matches</div>}
                        </>
                      ) : <span className="tag-empty">-</span>}
                    </td>
                    <td>
                      {lead.what_they_do_summary ? (
                        <div className="summary-cell">
                          <p className={`summary-text${expandedSummaries[lead.id] ? " expanded" : ""}`}>{lead.what_they_do_summary}</p>
                          {lead.what_they_do_summary.length > 160 && (
                            <button className="summary-toggle" type="button" onClick={() => setExpandedSummaries(p => ({ ...p, [lead.id]: !p[lead.id] }))}>
                              {expandedSummaries[lead.id] ? "Collapse" : "Expand"}
                            </button>
                          )}
                        </div>
                      ) : "-"}
                    </td>
                    <td>{lead.location_text ?? "-"}</td>
                  </tr>
                ))}
                {!leads.length && (
                  <tr><td colSpan={7} style={{ textAlign: "center", color: "var(--text-muted)", padding: "2rem" }}>
                    {hasActiveFilters ? "No leads match current filters." : "No leads yet. Run a campaign to start building the lead catalog."}
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <div className="step-section-label" id="step-2-section" style={{ marginTop: "1.5rem" }}>
          <span className="step-badge step-badge-purple">Step 2</span> Offer Library
        </div>

        <section className="panel panel-purple">
          <div className="offer-library-header">
            <div>
              <h2>Offer Library</h2>
              <p className="run-hint">Save your offer once, then reuse it across any lead list.</p>
            </div>
            <button className="btn-purple" type="button" onClick={() => {
              if (showOfferForm && !editingOfferId) {
                onCancelOfferForm();
                return;
              }
              setShowOfferForm(true);
              setEditingOfferId(null);
              setOfferMode("manual");
              setOfferError("");
              setAiIdeaText("");
              setAiRefined(false);
              setRefinementNote("");
              setOfferForm({ offerName: "", offerSummary: "", targetProblem: "", keyOutcome: "", callToAction: "" });
            }}>
              {showOfferForm && !editingOfferId ? "Cancel" : "+ New Offer"}
            </button>
          </div>

          {showOfferForm && (
            <div className="offer-form">
              <div className="offer-mode-tabs">
                <button type="button" className={`offer-tab${offerMode === "manual" ? " offer-tab-active" : ""}`} onClick={() => setOfferMode("manual")}>
                  Manual
                </button>
                <button type="button" className={`offer-tab${offerMode === "ai" ? " offer-tab-active" : ""}`} onClick={() => setOfferMode("ai")}>
                  AI-Assisted
                </button>
              </div>

              {/* AI idea input shown in AI mode before draft, or always for re-prompting */}
              {offerMode === "ai" && !aiRefined && (
                <div className="ai-idea-section">
                  <label className="offer-form-full">
                    Describe your offer in plain language
                    <textarea
                      value={aiIdeaText}
                      onChange={e => setAiIdeaText(e.target.value)}
                      placeholder="e.g. I build AI systems for construction companies - automating their job scheduling, invoicing and client follow-ups so they stop losing hours to admin every week"
                      style={{ minHeight: "100px" }}
                    />
                  </label>
                  {offerError && <p className="error">{offerError}</p>}
                  <button className="btn-purple" type="button" disabled={aiIdeaText.trim().length < 10 || aiDrafting} onClick={() => void onAiDraft()}>
                    {aiDrafting ? <><span className="spinner" /> Drafting with AI...</> : "Draft with AI"}
                  </button>
                </div>
              )}

              {/* Editable fields shown after AI draft or always in manual mode */}
              {(offerMode === "manual" || aiRefined) && (
                <form onSubmit={onSaveOffer}>
                  {offerMode === "ai" && aiRefined && (
                    <div className="ai-drafted-banner">{editingOfferId ? "AI refine mode - update the saved offer" : "AI-drafted - review and edit before saving"}</div>
                  )}
                  <div className="offer-form-grid" style={{ marginTop: "0.75rem" }}>
                    <label className="offer-form-full">Offer name
                      <input value={offerForm.offerName} onChange={e => setOfferForm(p => ({ ...p, offerName: e.target.value }))} placeholder="e.g. AI Automations for Construction Companies" required />
                    </label>
                    <label className="offer-form-full">What you provide
                      <textarea value={offerForm.offerSummary} onChange={e => setOfferForm(p => ({ ...p, offerSummary: e.target.value }))} placeholder="What you build/deliver and who it's for" required />
                    </label>
                    <label>Problem you solve
                      <input value={offerForm.targetProblem} onChange={e => setOfferForm(p => ({ ...p, targetProblem: e.target.value }))} placeholder="e.g. manually managing job schedules" required />
                    </label>
                    <label>Key outcome / result
                      <input value={offerForm.keyOutcome} onChange={e => setOfferForm(p => ({ ...p, keyOutcome: e.target.value }))} placeholder="e.g. save 10+ hrs/week, 30% fewer missed jobs" required />
                    </label>
                    <label className="offer-form-full">Call to action
                      <input value={offerForm.callToAction} onChange={e => setOfferForm(p => ({ ...p, callToAction: e.target.value }))} placeholder="e.g. Would a 15-min call this week make sense?" required />
                    </label>
                  </div>

                  {/* Refine row only after AI draft */}
                  {offerMode === "ai" && aiRefined && (
                    <div className="refine-row">
                      <input
                        value={refinementNote}
                        onChange={e => setRefinementNote(e.target.value)}
                        placeholder="Tell AI what to change, e.g. 'make the CTA softer' or 'focus more on saving money'"
                        onKeyDown={e => e.key === "Enter" && void onAiRefine()}
                      />
                      <button type="button" className="btn-purple" disabled={!refinementNote.trim() || aiRefining} onClick={() => void onAiRefine()}>
                        {aiRefining ? <><span className="spinner" /> Refining...</> : "Refine"}
                      </button>
                    </div>
                  )}

                  {offerError && <p className="error">{offerError}</p>}
                  <div className="toolbar-actions" style={{ marginTop: "0.75rem" }}>
                    <button className="btn-purple" disabled={offerLoading} type="submit">
                      {offerLoading ? "Saving..." : editingOfferId ? "Update Offer" : "Save Offer"}
                    </button>
                    <button className="btn-clear" type="button" onClick={onCancelOfferForm}>
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
          {offers.length > 0 ? (
            <div className="offer-grid" style={{ marginTop: showOfferForm ? "1.25rem" : "0.5rem" }}>
              {offers.map(offer => {
                const sel = selectedOfferId === offer.id;
                return (
                  <div key={offer.id} className={`offer-card${sel ? " offer-card-selected" : ""}`}
                    onClick={() => setSelectedOfferId(offer.id)} role="button" tabIndex={0}
                    onKeyDown={e => e.key === "Enter" && setSelectedOfferId(offer.id)}>
                    <div className="offer-card-top">
                      <div className="offer-card-check">{sel ? "Selected" : ""}</div>
                      <div className="offer-card-actions">
                        <button className="btn-clear" type="button"
                          onClick={e => { e.stopPropagation(); onEditOffer(offer, "manual"); }}>Edit</button>
                        <button className="btn-purple" type="button"
                          onClick={e => { e.stopPropagation(); onEditOffer(offer, "ai"); }}>AI Refine</button>
                        <button className="offer-card-remove" type="button"
                          onClick={e => { e.stopPropagation(); void onDeleteOffer(offer.id); }}>x</button>
                      </div>
                    </div>
                    <div className="offer-card-name">{offer.offer_name}</div>
                    <div className="offer-card-summary">{offer.offer_summary}</div>
                    <div className="offer-card-pills">
                      <span className="offer-pill offer-pill-problem">Solves: {offer.target_problem}</span>
                      <span className="offer-pill offer-pill-outcome">Result: {offer.key_outcome}</span>
                    </div>
                    <div className="offer-card-cta">{offer.call_to_action}</div>
                  </div>
                );
              })}
            </div>
          ) : (
            !showOfferForm && (
              <div className="empty-state">
                <div className="empty-icon">+</div>
                <p>No offers saved yet. Click <strong>+ New Offer</strong> to create your first one.</p>
              </div>
            )
          )}
        </section>

        <div className="step-section-label" id="step-3-section" style={{ marginTop: "1.5rem" }}>
          <span className="step-badge step-badge-green">Step 3</span> Generate Outreach Emails
        </div>

        <section className="panel panel-green">
          <div className="leads-header">
            <div>
              <h2>Outreach Generator</h2>
              <p className="run-hint">Pick a lead source and an offer, then generate personalised emails for every lead.</p>
            </div>
            {outreachRows.length > 0 && (
              <button className="btn-green" type="button" onClick={onExportOutreach}>
                Export {outreachExportFormat === "xlsx" ? "Excel" : "CSV"} ({outreachRows.length} rows)
              </button>
            )}
          </div>

          <div className="source-mode-toggle">
            <button type="button"
              className={`source-mode-btn${outreachSourceMode === "campaign" ? " source-mode-active" : ""}`}
              onClick={() => setOutreachSourceMode("campaign")}>
              Campaign Leads
            </button>
            <button type="button"
              className={`source-mode-btn${outreachSourceMode === "list" ? " source-mode-active" : ""}`}
              onClick={() => setOutreachSourceMode("list")}>
              Outreach List {outreachLists.length > 0 && <span className="source-mode-badge">{outreachLists.length}</span>}
            </button>
          </div>

          <div className="outreach-config">
            <div className="outreach-config-item">
              <div className="outreach-config-label">{outreachSourceMode === "campaign" ? "Lead list (campaign)" : "Outreach List"}</div>
              {outreachSourceMode === "campaign" ? (
                <select className="outreach-select" value={outreachCampaignId} onChange={e => setOutreachCampaignId(e.target.value)}>
                  <option value="">Choose campaign</option>
                  {campaigns.map(c => <option value={c.id} key={c.id}>{c.sub_niche} - {c.location_scope}</option>)}
                </select>
              ) : (
                <select className="outreach-select" value={outreachListId} onChange={e => setOutreachListId(e.target.value)}>
                  <option value="">Choose list</option>
                  {outreachLists.map(l => <option value={l.id} key={l.id}>{l.name} ({l.lead_count} leads)</option>)}
                </select>
              )}
            </div>
            <div className="outreach-config-sep">+</div>
            <div className="outreach-config-item">
              <div className="outreach-config-label">Offer</div>
              <select className="outreach-select" value={selectedOfferId} onChange={e => setSelectedOfferId(e.target.value)}>
                <option value="">Choose offer</option>
                {offers.map(o => <option value={o.id} key={o.id}>{o.offer_name}</option>)}
              </select>
            </div>
            <div className="outreach-config-item">
              <div className="outreach-config-label">AI model</div>
              <select className="outreach-select" value={outreachModel} onChange={e => setOutreachModel(e.target.value as OutreachModelOption)}>
                <option value="default">Default (Medium)</option>
                <option value="large">Mistral Large</option>
                <option value="medium">Mistral Medium</option>
                <option value="small">Mistral Small</option>
              </select>
              <div className="outreach-config-hint">Medium keeps quality high with better speed. Large is slower on bigger lead sets.</div>
            </div>
            <button className="btn-generate" type="button" disabled={!canGenerate} onClick={() => void onGenerateOutreach()}>
              {generatingOutreach ? <><span className="spinner" /> Generating...</> : "Generate Emails"}
            </button>
          </div>

          <div className="outreach-history-panel">
            <div className="outreach-history-head">
              <div>
                <div className="outreach-config-label">Saved history</div>
                <p className="run-hint">Every generated outreach set is stored here so you can reopen it after refresh and export it again without spending API credits.</p>
              </div>
              {selectedOutreachHistory && (
                <span className="outreach-tag outreach-tag-green">
                  Loaded: {new Date(selectedOutreachHistory.created_at).toLocaleString("en-GB", {
                    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit"
                  })}
                </span>
              )}
            </div>
            <div className="outreach-history-controls">
              <select
                className="outreach-select"
                value={selectedOutreachHistoryId}
                onChange={(e) => {
                  const nextId = e.target.value;
                  setSelectedOutreachHistoryId(nextId);
                  if (nextId) void loadOutreachHistoryEntry(nextId);
                }}
              >
                <option value="">Choose saved outreach history</option>
                {orderedOutreachHistory.map((entry) => (
                  <option value={entry.id} key={entry.id}>{formatHistoryLabel(entry)}</option>
                ))}
              </select>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => void loadOutreachHistory()}
                disabled={loadingOutreachHistory}
              >
                {loadingOutreachHistory ? "Loading..." : "Refresh history"}
              </button>
            </div>
            {outreachHistory.length === 0 && (
              <div className="history-empty">No saved outreach history yet. Your first generation will appear here automatically.</div>
            )}
            {selectedOutreachHistoryId && (
              <div className="refine-panel">
                {!refineOpen ? (
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => { setRefineOpen(true); setRefineError(""); }}
                    disabled={refining}
                  >
                    Refine these emails
                  </button>
                ) : (
                  <div className="refine-form">
                    <textarea
                      className="refine-instructions"
                      rows={2}
                      placeholder="Leave blank to auto-fix (em dashes, possessives, formatting), or describe extra changes..."
                      value={refineInstructions}
                      onChange={(e) => setRefineInstructions(e.target.value)}
                      disabled={refining}
                    />
                    {refining && refineProgress && (
                      <div className="refine-progress">
                        <div className="refine-progress-bar">
                          <div
                            className="refine-progress-fill"
                            style={{ width: `${Math.round((refineProgress.completed / refineProgress.total) * 100)}%` }}
                          />
                        </div>
                        <span className="refine-progress-label">
                          {refineProgress.completed} / {refineProgress.total} refined
                        </span>
                      </div>
                    )}
                    <div className="refine-actions">
                      <button
                        type="button"
                        className="btn-generate"
                        onClick={() => void onRefineOutreach()}
                        disabled={refining}
                      >
                        {refining ? <><span className="spinner" /> Refining...</> : "Run Refine"}
                      </button>
                      <button
                        type="button"
                        className="btn-ghost"
                        onClick={() => { setRefineOpen(false); setRefineInstructions(""); setRefineError(""); }}
                        disabled={refining}
                      >
                        Cancel
                      </button>
                    </div>
                    {refineError && <div className="outreach-error">{refineError}</div>}
                  </div>
                )}
              </div>
            )}
          </div>

          {outreachSourceMode === "list" && outreachLists.length > 0 && (
            <div className="outreach-lists-row">
              {outreachLists.map(list => (
                <div key={list.id} className="outreach-list-chip">
                  <span>{list.name}</span>
                  <span className="outreach-list-chip-count">{list.lead_count}</span>
                  <button type="button" onClick={() => void onDeleteList(list.id)} title="Remove list">x</button>
                </div>
              ))}
            </div>
          )}
          {outreachSourceMode === "list" && outreachLists.length === 0 && !generatingOutreach && (
            <div className="empty-state" style={{ padding: "1.5rem" }}>
              <div className="empty-icon">+</div>
              <p>No outreach lists yet. Go to <strong>All Leads</strong> above, check some leads, and click <strong>Add to Outreach List</strong>.</p>
            </div>
          )}

          {(outreachCampaign || outreachList || selectedOffer) && (
            <div className="outreach-summary-row">
              {outreachSourceMode === "campaign" && outreachCampaign && (
                <span className="outreach-tag outreach-tag-blue">List: {outreachCampaign.sub_niche} - {outreachCampaign.location_scope}</span>
              )}
              {outreachSourceMode === "list" && outreachList && (
                <span className="outreach-tag outreach-tag-blue">List: {outreachList.name} ({outreachList.lead_count} leads)</span>
              )}
              {selectedOffer && <span className="outreach-tag outreach-tag-purple">Offer: {selectedOffer.offer_name}</span>}
              {selectedOutreachHistory && <span className="outreach-tag outreach-tag-green">History rows: {selectedOutreachHistory.generated_count}</span>}
            </div>
          )}

          {generatingOutreach && (
            <div className="generating-banner">
              <span className="spinner spinner-lg" />
              <div>
                <strong>Generating personalised emails...</strong>
                <p>Writing opener + 2 follow-ups for each lead using the selected model. This may take longer for Large and bigger lists.</p>
              </div>
            </div>
          )}

          {outreachError && <p className="error" style={{ marginTop: "0.75rem" }}>{outreachError}</p>}

          {outreachRows.length > 0 && (
            <>
              <div className="results-banner">
                <span className="results-count">{outreachRows.length}</span>
                leads with personalised emails ready.
                <span className="results-hint">Click any row to preview all 3 emails.</span>
              </div>
              <div className="outreach-delivery-panel">
                <div className="outreach-delivery-grid">
                  <label>
                    Export format
                    <select value={outreachExportFormat} onChange={e => setOutreachExportFormat(e.target.value as OutreachExportFormat)}>
                      <option value="csv">CSV (Google Sheets)</option>
                      <option value="xlsx">Excel (.xlsx)</option>
                    </select>
                  </label>
                  <label className="outreach-delivery-webhook">
                    Webhook URL
                    <input
                      value={outreachWebhookUrl}
                      onChange={e => setOutreachWebhookUrl(e.target.value)}
                      placeholder="https://your-automation.example/webhook"
                    />
                  </label>
                  <button className="btn-clear" type="button" onClick={onExportOutreach}>
                    Download {outreachExportFormat === "xlsx" ? "Excel" : "CSV"}
                  </button>
                  <button className="btn-purple" type="button" disabled={!outreachWebhookUrl.trim() || sendingOutreachWebhook} onClick={() => void onSendOutreachWebhook()}>
                    {sendingOutreachWebhook ? "Sending..." : `Send ${outreachExportFormat === "xlsx" ? "Excel" : "CSV"} to webhook`}
                  </button>
                </div>
                <p className="run-hint">CSV opens cleanly in Google Sheets. Excel keeps a native `.xlsx` file. Webhook delivery sends the generated file as multipart form-data.</p>
              </div>
              <div className="outreach-mobile-list">
                {outreachRows.map(row => (
                  <article key={row.lead_id} className="outreach-mobile-card" onClick={() => setModalEmail({ name: row.name, opener_subject: row.opener_subject, opener_body: row.opener_body, followup1_subject: row.followup1_subject, followup1_body: row.followup1_body, followup2_subject: row.followup2_subject, followup2_body: row.followup2_body })}>
                    <div className="lead-primary-cell">
                      <strong>{row.name}</strong>
                      {row.phone && <span className="lead-subline">{row.phone}</span>}
                    </div>
                    <div className="mobile-field-grid">
                      <div><span className="mobile-field-label">Email</span><span>{row.email && !row.email.endsWith("@pending.local") ? row.email : "-"}</span></div>
                      <div><span className="mobile-field-label">Website</span><span>{row.website ? row.website.replace(/^https?:\/\//, "") : "-"}</span></div>
                    </div>
                    <div className="signal-stack">
                      <div className="signal-block"><span className="signal-label">Opener</span><span className="subject-preview subject-preview-mobile">{row.opener_subject}</span></div>
                      <div className="signal-block"><span className="signal-label">Follow-up 1</span><span className="subject-preview subject-preview-mobile">{row.followup1_subject}</span></div>
                      <div className="signal-block"><span className="signal-label">Follow-up 2</span><span className="subject-preview subject-preview-mobile">{row.followup2_subject}</span></div>
                    </div>
                    <button className="btn-preview" type="button">View emails</button>
                  </article>
                ))}
              </div>
              <div className="table-wrap outreach-table-wrap">
                <table className="outreach-table">
                  <thead>
                    <tr>
                      <th className="lead-name-col">Lead</th><th>Email</th>
                      <th><span className="email-col-tag" style={{ background: "#1877f2" }}>Opener</span>Subject</th>
                      <th><span className="email-col-tag" style={{ background: "#7b5ea7" }}>Follow-up 1</span>Subject</th>
                      <th><span className="email-col-tag" style={{ background: "#e67e22" }}>Follow-up 2</span>Subject</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {outreachRows.map(row => (
                      <tr key={row.lead_id} className="outreach-row"
                        onClick={() => setModalEmail({ name: row.name, opener_subject: row.opener_subject, opener_body: row.opener_body, followup1_subject: row.followup1_subject, followup1_body: row.followup1_body, followup2_subject: row.followup2_subject, followup2_body: row.followup2_body })}>
                        <td className="lead-name-col">
                          <div className="lead-primary-cell">
                            <strong>{row.name}</strong>
                            {row.phone && <span className="lead-subline">{row.phone}</span>}
                            {row.website && <a className="lead-subline lead-inline-link" href={row.website} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}>{row.website.replace(/^https?:\/\//, "")}</a>}
                          </div>
                        </td>
                        <td className="td-mono">{row.email && !row.email.endsWith("@pending.local") ? row.email : "-"}</td>
                        <td><span className="subject-preview">{row.opener_subject}</span></td>
                        <td><span className="subject-preview">{row.followup1_subject}</span></td>
                        <td><span className="subject-preview">{row.followup2_subject}</span></td>
                        <td><button className="btn-preview" type="button">View emails</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {!outreachRows.length && !generatingOutreach && (
            <div className="empty-state">
              <div className="empty-icon">i</div>
              <p>Select a lead source and an offer above, then click <strong>Generate Emails</strong> or load a saved history entry.</p>
            </div>
          )}
        </section>
      </main>
    </>
  );
}
