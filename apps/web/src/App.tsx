import { FormEvent, useEffect, useMemo, useState } from "react";
import { api } from "./lib/api";

type Campaign = {
  id: string;
  niche_keywords: string[];
  sub_niche: string;
  location_scope: string;
  offer_note: string;
  status: string;
  created_at: string;
};

type Run = {
  id: string;
  status: "queued" | "running" | "completed" | "failed";
  total_candidates: number;
  inserted_count: number;
  updated_count: number;
  deduped_count: number;
  rejected_no_email_count: number;
  errors?: Array<{ error_message: string; source_name: string; created_at: string }>;
};

type Lead = {
  id: string;
  name: string;
  email: string | null;
  what_they_do_summary: string | null;
  location_text: string | null;
  phone: string | null;
  website: string | null;
};

type Offer = {
  id: string;
  offer_name: string;
  offer_summary: string;
  target_problem: string;
  key_outcome: string;
  call_to_action: string;
  is_active: boolean;
  created_at: string;
};

type OutreachRow = {
  lead_id: string;
  offer_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  website: string | null;
  location_text: string | null;
  opener_subject: string;
  opener_body: string;
  followup1_subject: string;
  followup1_body: string;
  followup2_subject: string;
  followup2_body: string;
};

type ModalEmail = {
  name: string;
  opener_subject: string;
  opener_body: string;
  followup1_subject: string;
  followup1_body: string;
  followup2_subject: string;
  followup2_body: string;
};

export function App() {
  // ── Collection state ────────────────────────────────────────────────────────
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState("");
  const [run, setRun] = useState<Run | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({ q: "", location: "" });
  const [sources, setSources] = useState({ google: true, yelp: false, apify: false });
  const [targetLeads, setTargetLeads] = useState(30);
  const [expandedSummaries, setExpandedSummaries] = useState<Record<string, boolean>>({});
  const [form, setForm] = useState({
    nicheKeywords: "dentist, dental clinic",
    subNiche: "cosmetic dentistry",
    locationScope: "London, UK",
    offerNote: "Performance-focused website and lead generation service."
  });

  // ── Offers state ────────────────────────────────────────────────────────────
  const [offers, setOffers] = useState<Offer[]>([]);
  const [selectedOfferId, setSelectedOfferId] = useState("");
  const [offerForm, setOfferForm] = useState({
    offerName: "",
    offerSummary: "",
    targetProblem: "",
    keyOutcome: "",
    callToAction: ""
  });
  const [offerLoading, setOfferLoading] = useState(false);
  const [offerError, setOfferError] = useState("");
  const [showOfferForm, setShowOfferForm] = useState(false);

  // ── Outreach state ──────────────────────────────────────────────────────────
  const [outreachRows, setOutreachRows] = useState<OutreachRow[]>([]);
  const [generatingOutreach, setGeneratingOutreach] = useState(false);
  const [outreachError, setOutreachError] = useState("");
  const [outreachCampaignId, setOutreachCampaignId] = useState("");
  const [modalEmail, setModalEmail] = useState<ModalEmail | null>(null);

  // ── Derived ─────────────────────────────────────────────────────────────────
  const selectedCampaign = useMemo(
    () => campaigns.find((c) => c.id === selectedCampaignId) ?? null,
    [campaigns, selectedCampaignId]
  );
  const selectedOffer = useMemo(
    () => offers.find((o) => o.id === selectedOfferId) ?? null,
    [offers, selectedOfferId]
  );
  const outreachCampaign = useMemo(
    () => campaigns.find((c) => c.id === outreachCampaignId) ?? null,
    [campaigns, outreachCampaignId]
  );

  const hasActiveFilters = Boolean(filters.q.trim() || filters.location.trim());
  const runEvents = [...(run?.errors ?? [])].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const latestRunEvent =
    [...runEvents].reverse().find((item) => item.error_message.startsWith("[info]"))?.error_message.replace(/^\[info\]\s*/, "") ?? "";
  const processedCount = (run?.inserted_count ?? 0) + (run?.updated_count ?? 0) + (run?.rejected_no_email_count ?? 0);
  const progressPct = run
    ? run.total_candidates > 0
      ? Math.min(100, Math.round((processedCount / run.total_candidates) * 100))
      : run.status === "completed" ? 100 : 0
    : 0;

  // ── Data loaders ────────────────────────────────────────────────────────────
  async function loadCampaigns() {
    const data = await api<Campaign[]>("/api/campaigns");
    setCampaigns(data);
    if (!selectedCampaignId && data[0]) setSelectedCampaignId(data[0].id);
  }

  async function loadLeads() {
    const params = new URLSearchParams();
    if (selectedCampaignId) params.set("campaignId", selectedCampaignId);
    if (filters.q) params.set("q", filters.q);
    if (filters.location) params.set("location", filters.location);
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

  // ── Effects ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    void loadCampaigns().catch((err: Error) => setError(err.message));
    void loadOffers().catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!selectedCampaignId) { setRun(null); return; }
    void loadLeads().catch((err: Error) => setError(err.message));
    void loadLatestRun(selectedCampaignId).catch((err: Error) => setError(err.message));
  }, [selectedCampaignId, filters.q, filters.location]);

  useEffect(() => {
    if (!run || (run.status !== "queued" && run.status !== "running")) return;
    const interval = setInterval(() => {
      void api<Run>(`/api/runs/${run.id}`).then(setRun).catch(() => undefined);
      void loadLeads().catch(() => undefined);
    }, 1500);
    return () => clearInterval(interval);
  }, [run]);

  // Close modal on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setModalEmail(null); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ── Handlers: Collection ────────────────────────────────────────────────────
  async function onCreateCampaign(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      await api("/api/campaigns", {
        method: "POST",
        body: JSON.stringify({
          nicheKeywords: form.nicheKeywords.split(",").map((v) => v.trim()).filter(Boolean),
          subNiche: form.subNiche,
          locationScope: form.locationScope,
          offerNote: form.offerNote
        })
      });
      await loadCampaigns();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Campaign creation failed");
    } finally {
      setLoading(false);
    }
  }

  async function onRunCampaign() {
    if (!selectedCampaignId) return;
    if (!sources.google && !sources.yelp && !sources.apify) {
      setError("Select at least one source before running collection.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const createdRun = await api<Run>(`/api/campaigns/${selectedCampaignId}/run`, {
        method: "POST",
        body: JSON.stringify({ sources, targetLeads: Math.max(1, Math.min(500, Number(targetLeads) || 30)) })
      });
      setRun(createdRun);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Run failed to start");
    } finally {
      setLoading(false);
    }
  }

  // ── Handlers: Offers ────────────────────────────────────────────────────────
  async function onSaveOffer(event: FormEvent) {
    event.preventDefault();
    setOfferLoading(true);
    setOfferError("");
    try {
      const created = await api<Offer>("/api/offers", {
        method: "POST",
        body: JSON.stringify(offerForm)
      });
      setOffers((prev) => [created, ...prev]);
      setSelectedOfferId(created.id);
      setOfferForm({ offerName: "", offerSummary: "", targetProblem: "", keyOutcome: "", callToAction: "" });
      setShowOfferForm(false);
    } catch (err) {
      setOfferError(err instanceof Error ? err.message : "Failed to save offer");
    } finally {
      setOfferLoading(false);
    }
  }

  async function onDeleteOffer(id: string) {
    try {
      await api(`/api/offers/${id}`, { method: "DELETE" });
      const remaining = offers.filter((o) => o.id !== id);
      setOffers(remaining);
      if (selectedOfferId === id) setSelectedOfferId(remaining[0]?.id ?? "");
    } catch (err) {
      setOfferError(err instanceof Error ? err.message : "Failed to remove offer");
    }
  }

  // ── Handlers: Outreach ──────────────────────────────────────────────────────
  async function onGenerateOutreach() {
    if (!outreachCampaignId || !selectedOfferId) return;
    setGeneratingOutreach(true);
    setOutreachError("");
    setOutreachRows([]);
    try {
      const result = await api<{ generated: number; rows: OutreachRow[] }>("/api/outreach/generate", {
        method: "POST",
        body: JSON.stringify({ campaignId: outreachCampaignId, offerId: selectedOfferId })
      });
      setOutreachRows(result.rows);
    } catch (err) {
      setOutreachError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGeneratingOutreach(false);
    }
  }

  // ── Export helpers ──────────────────────────────────────────────────────────
  function csvCell(value: string | null | undefined): string {
    return `"${String(value ?? "").replace(/"/g, '""')}"`;
  }

  function onExportLeads() {
    if (leads.length === 0) { setError("No leads to export."); return; }
    const headers = ["Name", "Email", "What they do", "Location", "Phone", "Website"];
    const rows = leads.map((l) => [
      l.name,
      l.email && !l.email.endsWith("@pending.local") ? l.email : "",
      l.what_they_do_summary ?? "",
      l.location_text ?? "",
      l.phone ?? "",
      l.website ?? ""
    ]);
    downloadCsv(
      [headers, ...rows],
      `${(selectedCampaign?.sub_niche ?? "leads").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${today()}.csv`
    );
  }

  function onExportOutreach() {
    if (outreachRows.length === 0) { setOutreachError("No outreach rows to export."); return; }
    const headers = ["Name", "Email", "Phone", "Website", "Location",
      "Opener Subject", "Opener Body", "Follow-up 1 Subject", "Follow-up 1 Body",
      "Follow-up 2 Subject", "Follow-up 2 Body"];
    const rows = outreachRows.map((r) => [
      r.name,
      r.email && !r.email.endsWith("@pending.local") ? r.email : "",
      r.phone ?? "", r.website ?? "", r.location_text ?? "",
      r.opener_subject, r.opener_body,
      r.followup1_subject, r.followup1_body,
      r.followup2_subject, r.followup2_body
    ]);
    const offerSlug = (selectedOffer?.offer_name ?? "outreach").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    downloadCsv([headers, ...rows], `outreach-${offerSlug}-${today()}.csv`);
  }

  function downloadCsv(rows: (string | null | undefined)[][], filename: string) {
    const csv = rows.map((row) => row.map((v) => csvCell(v)).join(",")).join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  }

  function today() { return new Date().toISOString().slice(0, 10); }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Email Preview Modal ── */}
      {modalEmail ? (
        <div className="modal-backdrop" onClick={() => setModalEmail(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Emails for <span className="modal-name">{modalEmail.name}</span></h3>
              <button className="modal-close" onClick={() => setModalEmail(null)}>✕</button>
            </div>
            <div className="modal-body">
              {[
                { label: "Opener", subject: modalEmail.opener_subject, body: modalEmail.opener_body, color: "#1877f2" },
                { label: "Follow-up 1", subject: modalEmail.followup1_subject, body: modalEmail.followup1_body, color: "#7b5ea7" },
                { label: "Follow-up 2", subject: modalEmail.followup2_subject, body: modalEmail.followup2_body, color: "#e67e22" }
              ].map(({ label, subject, body, color }) => (
                <div className="modal-email" key={label}>
                  <div className="modal-email-tag" style={{ background: color }}>{label}</div>
                  <div className="modal-email-subject">{subject}</div>
                  <div className="modal-email-body">{body}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <main className="layout">
        {/* ── Workflow Steps Header ── */}
        <div className="workflow-steps">
          <div className="workflow-step">
            <div className="step-num">1</div>
            <div className="step-label">Create Campaign &amp; Collect Leads</div>
          </div>
          <div className="step-arrow">→</div>
          <div className="workflow-step">
            <div className="step-num">2</div>
            <div className="step-label">Build Your Offer Library</div>
          </div>
          <div className="step-arrow">→</div>
          <div className="workflow-step">
            <div className="step-num">3</div>
            <div className="step-label">Generate &amp; Export Outreach</div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════════
            STEP 1 — Campaign Creation
        ════════════════════════════════════════════════════════════════════════ */}
        <div className="step-section-label">
          <span className="step-badge">Step 1</span> Campaign Setup
        </div>

        <section className="panel panel-glow">
          <header className="panel-header">
            <h1>Outreach Lead Intelligence</h1>
            <p>Manual campaign runs across Google, Yelp-like directories, and Apify actors.</p>
          </header>
          <form className="campaign-form" onSubmit={onCreateCampaign}>
            <label>
              Collection keywords
              <input value={form.nicheKeywords} onChange={(e) => setForm((p) => ({ ...p, nicheKeywords: e.target.value }))} placeholder="e.g. dentist, whitening clinic" />
            </label>
            <label>
              Sub-niche
              <input value={form.subNiche} onChange={(e) => setForm((p) => ({ ...p, subNiche: e.target.value }))} />
            </label>
            <label>
              Location
              <input value={form.locationScope} onChange={(e) => setForm((p) => ({ ...p, locationScope: e.target.value }))} />
            </label>
            <label>
              Offer context (for scraping context)
              <textarea value={form.offerNote} onChange={(e) => setForm((p) => ({ ...p, offerNote: e.target.value }))} />
            </label>
            <button className="btn-primary" disabled={loading} type="submit">+ Create Campaign</button>
          </form>
        </section>

        <section className="panel">
          <div className="inline-row">
            <div>
              <h2>Run Control</h2>
              <p style={{ margin: 0, color: "var(--text-soft)", fontSize: "0.9rem" }}>
                {selectedCampaign ? `${selectedCampaign.sub_niche} — ${selectedCampaign.location_scope}` : "No campaign selected"}
              </p>
            </div>
            <button className="btn-accent" disabled={!selectedCampaignId || loading} onClick={onRunCampaign}>
              Run Collection
            </button>
          </div>
          <div className="source-toggles">
            {(["google", "yelp", "apify"] as const).map((src) => (
              <label className="toggle-item" key={src}>
                <input type="checkbox" checked={sources[src]} onChange={(e) => setSources((p) => ({ ...p, [src]: e.target.checked }))} />
                {src === "google" ? "Google Maps API" : src === "yelp" ? "Yelp API" : "Apify Actors"}
              </label>
            ))}
            <label className="target-input">
              Target leads
              <input type="number" min={1} max={500} value={targetLeads} onChange={(e) => setTargetLeads(Number(e.target.value || 30))} />
            </label>
          </div>
          <div className="inline-row" style={{ marginTop: "0.75rem" }}>
            <label>
              Campaign
              <select value={selectedCampaignId} onChange={(e) => setSelectedCampaignId(e.target.value)}>
                <option value="">Select campaign</option>
                {campaigns.map((c) => (
                  <option value={c.id} key={c.id}>{c.sub_niche} — {c.location_scope}</option>
                ))}
              </select>
            </label>
            <label>
              Search filter
              <input value={filters.q} placeholder="Filter table only" onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))} />
            </label>
            <label>
              Location filter
              <input value={filters.location} onChange={(e) => setFilters((f) => ({ ...f, location: e.target.value }))} />
            </label>
            <button className="btn-clear" type="button" onClick={() => setFilters({ q: "", location: "" })} disabled={!hasActiveFilters}>
              Clear Filters
            </button>
          </div>

          {run ? (
            <div className="run-card">
              <div className="run-card-top">
                <strong>Run status:</strong>
                <span className={`run-status-badge run-status-${run.status}`}>{run.status}</span>
              </div>
              <div className="progress-wrap" aria-live="polite">
                <div className="progress-label">Progress: {progressPct}% ({processedCount}/{run.total_candidates || 0})</div>
                <div className="progress-bar"><div className="progress-fill" style={{ width: `${progressPct}%` }} /></div>
              </div>
              {latestRunEvent ? <p className="run-live-status">● {latestRunEvent}</p> : null}
              <div className="metrics">
                {[
                  ["Total", run.total_candidates ?? 0],
                  ["Inserted", run.inserted_count ?? 0],
                  ["Updated", run.updated_count ?? 0],
                  ["Deduped", run.deduped_count ?? 0],
                  ["Rejected", run.rejected_no_email_count ?? 0]
                ].map(([label, val]) => (
                  <div className="metric-pill" key={String(label)}>
                    <span className="metric-val">{val}</span>
                    <span className="metric-label">{label}</span>
                  </div>
                ))}
              </div>
              {runEvents.length > 0 ? (
                <ul className="run-event-list">
                  {runEvents.map((item) => {
                    const isInfo = item.error_message.startsWith("[info]");
                    return (
                      <li className={isInfo ? "run-event run-event-info" : "run-event run-event-error"} key={`${item.created_at}-${item.source_name}`}>
                        [{item.source_name}] {isInfo ? item.error_message.replace(/^\[info\]\s*/, "") : item.error_message}
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </div>
          ) : null}
          {error ? <p className="error">{error}</p> : null}
        </section>

        <section className="panel">
          <div className="leads-header">
            <div>
              <h2>Leads Table</h2>
              <p className="run-hint">
                {leads.length} lead{leads.length === 1 ? "" : "s"}{hasActiveFilters ? " (filtered)" : ""}
              </p>
            </div>
            <button className="btn-clear" type="button" onClick={onExportLeads} disabled={leads.length === 0}>
              Export CSV
            </button>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th><th>Email</th><th>What they do</th><th>Location</th><th>Phone</th><th>Website</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr key={lead.id}>
                    <td>{lead.name}</td>
                    <td>{lead.email && !lead.email.endsWith("@pending.local") ? lead.email : "—"}</td>
                    <td>
                      {lead.what_they_do_summary ? (
                        <div className="summary-cell">
                          <p className={`summary-text${expandedSummaries[lead.id] ? " expanded" : ""}`}>{lead.what_they_do_summary}</p>
                          {lead.what_they_do_summary.length > 160 ? (
                            <button className="summary-toggle" type="button" onClick={() => setExpandedSummaries((p) => ({ ...p, [lead.id]: !p[lead.id] }))}>
                              {expandedSummaries[lead.id] ? "Collapse" : "Expand"}
                            </button>
                          ) : null}
                        </div>
                      ) : "—"}
                    </td>
                    <td>{lead.location_text ?? "—"}</td>
                    <td>{lead.phone ?? "—"}</td>
                    <td>{lead.website ? <a href={lead.website} target="_blank" rel="noreferrer">{lead.website}</a> : "—"}</td>
                  </tr>
                ))}
                {leads.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: "center", color: "var(--text-muted)", padding: "2rem" }}>
                    {hasActiveFilters ? "No leads match current filters." : "No leads yet. Create a campaign and run collection."}
                  </td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════════════
            STEP 2 — Offer Library
        ════════════════════════════════════════════════════════════════════════ */}
        <div className="step-section-label" style={{ marginTop: "1.5rem" }}>
          <span className="step-badge step-badge-purple">Step 2</span> Offer Library
        </div>

        <section className="panel panel-purple">
          <div className="offer-library-header">
            <div>
              <h2>Offer Library</h2>
              <p className="run-hint">Save your offer once — reuse it across any lead list.</p>
            </div>
            <button className="btn-purple" type="button" onClick={() => setShowOfferForm((v) => !v)}>
              {showOfferForm ? "Cancel" : "+ New Offer"}
            </button>
          </div>

          {showOfferForm ? (
            <form className="offer-form" onSubmit={onSaveOffer}>
              <div className="offer-form-grid">
                <label className="offer-form-full">
                  Offer name
                  <input value={offerForm.offerName} onChange={(e) => setOfferForm((p) => ({ ...p, offerName: e.target.value }))} placeholder="e.g. AI Automations for Dental Clinics" required />
                </label>
                <label className="offer-form-full">
                  What you provide (offer summary)
                  <textarea value={offerForm.offerSummary} onChange={(e) => setOfferForm((p) => ({ ...p, offerSummary: e.target.value }))} placeholder="e.g. We build custom AI systems that automate patient booking, follow-ups, and review collection." required />
                </label>
                <label>
                  Problem you solve
                  <input value={offerForm.targetProblem} onChange={(e) => setOfferForm((p) => ({ ...p, targetProblem: e.target.value }))} placeholder="e.g. manually managing patient follow-ups" required />
                </label>
                <label>
                  Key outcome / result
                  <input value={offerForm.keyOutcome} onChange={(e) => setOfferForm((p) => ({ ...p, keyOutcome: e.target.value }))} placeholder="e.g. save 10+ hours/week and increase retention by 30%" required />
                </label>
                <label className="offer-form-full">
                  Call to action
                  <input value={offerForm.callToAction} onChange={(e) => setOfferForm((p) => ({ ...p, callToAction: e.target.value }))} placeholder="e.g. Would you be open to a 15-minute call this week?" required />
                </label>
              </div>
              {offerError ? <p className="error">{offerError}</p> : null}
              <button className="btn-purple" disabled={offerLoading} type="submit" style={{ marginTop: "0.75rem" }}>
                {offerLoading ? "Saving..." : "Save Offer"}
              </button>
            </form>
          ) : null}

          {offers.length > 0 ? (
            <div className="offer-grid" style={{ marginTop: showOfferForm ? "1.25rem" : "0.5rem" }}>
              {offers.map((offer) => {
                const selected = selectedOfferId === offer.id;
                return (
                  <div
                    key={offer.id}
                    className={`offer-card${selected ? " offer-card-selected" : ""}`}
                    onClick={() => setSelectedOfferId(offer.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === "Enter" && setSelectedOfferId(offer.id)}
                  >
                    <div className="offer-card-top">
                      <div className="offer-card-check">{selected ? "✓" : ""}</div>
                      <button
                        className="offer-card-remove"
                        type="button"
                        onClick={(e) => { e.stopPropagation(); void onDeleteOffer(offer.id); }}
                        title="Remove offer"
                      >✕</button>
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
            !showOfferForm ? (
              <div className="empty-state">
                <div className="empty-icon">📋</div>
                <p>No offers saved yet. Click <strong>+ New Offer</strong> to create your first one.</p>
              </div>
            ) : null
          )}

          {offerError && !showOfferForm ? <p className="error" style={{ marginTop: "0.5rem" }}>{offerError}</p> : null}
        </section>

        {/* ══════════════════════════════════════════════════════════════════════
            STEP 3 — Outreach Generator
        ════════════════════════════════════════════════════════════════════════ */}
        <div className="step-section-label" style={{ marginTop: "1.5rem" }}>
          <span className="step-badge step-badge-green">Step 3</span> Generate Outreach Emails
        </div>

        <section className="panel panel-green">
          <div className="leads-header">
            <div>
              <h2>Outreach Generator</h2>
              <p className="run-hint">Pick a lead list + offer, then generate personalised emails for every lead.</p>
            </div>
            {outreachRows.length > 0 ? (
              <button className="btn-green" type="button" onClick={onExportOutreach}>
                Export CSV ({outreachRows.length} rows)
              </button>
            ) : null}
          </div>

          {/* Selection bar */}
          <div className="outreach-config">
            <div className="outreach-config-item">
              <div className="outreach-config-label">Lead list</div>
              <select
                className="outreach-select"
                value={outreachCampaignId}
                onChange={(e) => setOutreachCampaignId(e.target.value)}
              >
                <option value="">— Choose campaign —</option>
                {campaigns.map((c) => (
                  <option value={c.id} key={c.id}>{c.sub_niche} — {c.location_scope}</option>
                ))}
              </select>
            </div>
            <div className="outreach-config-sep">+</div>
            <div className="outreach-config-item">
              <div className="outreach-config-label">Offer</div>
              <select
                className="outreach-select"
                value={selectedOfferId}
                onChange={(e) => setSelectedOfferId(e.target.value)}
              >
                <option value="">— Choose offer —</option>
                {offers.map((o) => (
                  <option value={o.id} key={o.id}>{o.offer_name}</option>
                ))}
              </select>
            </div>
            <button
              className="btn-generate"
              type="button"
              disabled={!outreachCampaignId || !selectedOfferId || generatingOutreach}
              onClick={onGenerateOutreach}
            >
              {generatingOutreach ? (
                <><span className="spinner" /> Generating...</>
              ) : (
                "Generate Emails"
              )}
            </button>
          </div>

          {/* Selection summary */}
          {(outreachCampaign || selectedOffer) ? (
            <div className="outreach-summary-row">
              {outreachCampaign ? (
                <span className="outreach-tag outreach-tag-blue">
                  List: {outreachCampaign.sub_niche} — {outreachCampaign.location_scope}
                </span>
              ) : null}
              {selectedOffer ? (
                <span className="outreach-tag outreach-tag-purple">
                  Offer: {selectedOffer.offer_name}
                </span>
              ) : null}
            </div>
          ) : null}

          {generatingOutreach ? (
            <div className="generating-banner">
              <span className="spinner spinner-lg" />
              <div>
                <strong>Generating personalised emails...</strong>
                <p>Writing opener + 2 follow-ups for each lead using your offer. This may take a moment for large lists.</p>
              </div>
            </div>
          ) : null}

          {outreachError ? <p className="error" style={{ marginTop: "0.75rem" }}>{outreachError}</p> : null}

          {/* Results table */}
          {outreachRows.length > 0 ? (
            <>
              <div className="results-banner">
                <span className="results-count">{outreachRows.length}</span>
                leads with personalised emails ready.
                <span className="results-hint">Click any row to preview all 3 emails.</span>
              </div>
              <div className="table-wrap">
                <table className="outreach-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Phone</th>
                      <th>Website</th>
                      <th>
                        <span className="email-col-tag" style={{ background: "#1877f2" }}>Opener</span>
                        Subject
                      </th>
                      <th>
                        <span className="email-col-tag" style={{ background: "#7b5ea7" }}>Follow-up 1</span>
                        Subject
                      </th>
                      <th>
                        <span className="email-col-tag" style={{ background: "#e67e22" }}>Follow-up 2</span>
                        Subject
                      </th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {outreachRows.map((row) => (
                      <tr
                        key={row.lead_id}
                        className="outreach-row"
                        onClick={() => setModalEmail({
                          name: row.name,
                          opener_subject: row.opener_subject,
                          opener_body: row.opener_body,
                          followup1_subject: row.followup1_subject,
                          followup1_body: row.followup1_body,
                          followup2_subject: row.followup2_subject,
                          followup2_body: row.followup2_body
                        })}
                      >
                        <td><strong>{row.name}</strong></td>
                        <td className="td-mono">{row.email && !row.email.endsWith("@pending.local") ? row.email : "—"}</td>
                        <td className="td-mono">{row.phone ?? "—"}</td>
                        <td>{row.website ? <a href={row.website} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>{row.website.replace(/^https?:\/\//, "")}</a> : "—"}</td>
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
          ) : (
            !generatingOutreach ? (
              <div className="empty-state">
                <div className="empty-icon">✉️</div>
                <p>Select a lead list and an offer above, then click <strong>Generate Emails</strong>.</p>
              </div>
            ) : null
          )}
        </section>
      </main>
    </>
  );
}
