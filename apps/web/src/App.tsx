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

export function App() {
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

  const selectedCampaign = useMemo(
    () => campaigns.find((c) => c.id === selectedCampaignId) ?? null,
    [campaigns, selectedCampaignId]
  );

  const hasActiveFilters = Boolean(filters.q.trim() || filters.location.trim());
  const runEvents = [...(run?.errors ?? [])].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const latestRunEvent =
    [...runEvents].reverse().find((item) => item.error_message.startsWith("[info]"))?.error_message.replace(/^\[info\]\s*/, "") ?? "";
  const processedCount = (run?.inserted_count ?? 0) + (run?.updated_count ?? 0) + (run?.rejected_no_email_count ?? 0);
  const progressPct = run
    ? run.total_candidates > 0
      ? Math.min(100, Math.round((processedCount / run.total_candidates) * 100))
      : run.status === "completed"
        ? 100
        : 0
    : 0;

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

  useEffect(() => {
    void loadCampaigns().catch((err: Error) => setError(err.message));
  }, []);

  useEffect(() => {
    if (!selectedCampaignId) {
      setRun(null);
      return;
    }

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

  async function onCreateCampaign(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      await api("/api/campaigns", {
        method: "POST",
        body: JSON.stringify({
          nicheKeywords: form.nicheKeywords.split(",").map((value) => value.trim()).filter(Boolean),
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
        body: JSON.stringify({
          sources,
          targetLeads: Math.max(1, Math.min(500, Number(targetLeads) || 30))
        })
      });
      setRun(createdRun);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Run failed to start");
    } finally {
      setLoading(false);
    }
  }

  function csvCell(value: string | null | undefined): string {
    const safe = String(value ?? "").replace(/"/g, '""');
    return `"${safe}"`;
  }

  function onExportLeads() {
    if (leads.length === 0) {
      setError("No leads to export.");
      return;
    }

    const headers = ["Name", "Email", "What they do", "Location", "Phone", "Website"];
    const rows = leads.map((lead) => [
      lead.name,
      lead.email && !lead.email.endsWith("@pending.local") ? lead.email : "",
      lead.what_they_do_summary ?? "",
      lead.location_text ?? "",
      lead.phone ?? "",
      lead.website ?? ""
    ]);

    const csv = [
      headers.map((h) => csvCell(h)).join(","),
      ...rows.map((row) => row.map((v) => csvCell(v)).join(","))
    ].join("\n");

    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const campaignName = (selectedCampaign?.sub_niche ?? "leads").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    const datePart = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `${campaignName}-${datePart}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function toggleSummary(leadId: string) {
    setExpandedSummaries((prev) => ({
      ...prev,
      [leadId]: !prev[leadId]
    }));
  }

  return (
    <main className="layout">
      <section className="panel panel-glow">
        <header className="panel-header">
          <h1>Outreach Lead Intelligence</h1>
          <p>Manual campaign runs across Google, Yelp-like directories, and Apify actors.</p>
        </header>

        <form className="campaign-form" onSubmit={onCreateCampaign}>
          <label>
            Collection keywords (used for scraping)
            <input
              value={form.nicheKeywords}
              onChange={(e) => setForm((p) => ({ ...p, nicheKeywords: e.target.value }))}
              placeholder="e.g. dentist, whitening clinic"
            />
          </label>
          <label>
            Sub-niche (used for scraping)
            <input value={form.subNiche} onChange={(e) => setForm((p) => ({ ...p, subNiche: e.target.value }))} />
          </label>
          <label>
            Location (used for scraping)
            <input
              value={form.locationScope}
              onChange={(e) => setForm((p) => ({ ...p, locationScope: e.target.value }))}
            />
          </label>
          <label>
            Offer context
            <textarea value={form.offerNote} onChange={(e) => setForm((p) => ({ ...p, offerNote: e.target.value }))} />
          </label>
          <button className="btn-primary" disabled={loading} type="submit">
            Create Campaign
          </button>
        </form>
      </section>

      <section className="panel">
        <div className="inline-row">
          <div>
            <h2>Run Control</h2>
            <p>Selected campaign: {selectedCampaign ? selectedCampaign.sub_niche : "None"}</p>
          </div>
          <button className="btn-accent" disabled={!selectedCampaignId || loading} onClick={onRunCampaign}>
            Run Collection
          </button>
        </div>
        <p className="run-hint">Collection uses campaign keywords, sub-niche, and location fields above. Table search filter does not affect collection.</p>
        <div className="source-toggles">
          <label className="toggle-item">
            <input
              type="checkbox"
              checked={sources.google}
              onChange={(e) => setSources((prev) => ({ ...prev, google: e.target.checked }))}
            />
            Google Maps API
          </label>
          <label className="toggle-item">
            <input
              type="checkbox"
              checked={sources.yelp}
              onChange={(e) => setSources((prev) => ({ ...prev, yelp: e.target.checked }))}
            />
            Yelp API
          </label>
          <label className="toggle-item">
            <input
              type="checkbox"
              checked={sources.apify}
              onChange={(e) => setSources((prev) => ({ ...prev, apify: e.target.checked }))}
            />
            Apify Actors
          </label>
          <label className="target-input">
            Target leads
            <input
              type="number"
              min={1}
              max={500}
              value={targetLeads}
              onChange={(e) => setTargetLeads(Number(e.target.value || 30))}
            />
          </label>
        </div>
        <div className="inline-row">
          <label>
            Campaign
            <select value={selectedCampaignId} onChange={(e) => setSelectedCampaignId(e.target.value)}>
              <option value="">Select campaign</option>
              {campaigns.map((campaign) => (
                <option value={campaign.id} key={campaign.id}>
                  {campaign.sub_niche} - {campaign.location_scope}
                </option>
              ))}
            </select>
          </label>
          <label>
            Table search filter
            <input value={filters.q} placeholder="Filter current table only" onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))} />
          </label>
          <label>
            Location filter (table)
            <input
              value={filters.location}
              onChange={(e) => setFilters((f) => ({ ...f, location: e.target.value }))}
            />
          </label>
          <button
            className="btn-clear"
            type="button"
            onClick={() => setFilters({ q: "", location: "" })}
            disabled={!hasActiveFilters}
          >
            Clear Filters
          </button>
        </div>
        {run ? (
          <div className="run-card">
            <strong>Run status: {run.status}</strong>
            <div className="progress-wrap" aria-live="polite">
              <div className="progress-label">Progress: {progressPct}% ({processedCount}/{run.total_candidates || 0})</div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${progressPct}%` }} />
              </div>
            </div>
            {run.status === "queued" || run.status === "running" ? (
              <>
                <p className="run-hint">Pipeline is active. Source fetch, save, and enrichment steps run in parallel where safe.</p>
                {latestRunEvent ? <p className="run-live-status">Live status: {latestRunEvent}</p> : null}
              </>
            ) : null}
            <div className="metrics">
              <span>Total: {run.total_candidates ?? 0}</span>
              <span>Inserted: {run.inserted_count ?? 0}</span>
              <span>Updated: {run.updated_count ?? 0}</span>
              <span>Deduped: {run.deduped_count ?? 0}</span>
              <span>Rejected (invalid row): {run.rejected_no_email_count ?? 0}</span>
            </div>
            {run.status === "completed" && (run.total_candidates ?? 0) === 0 ? (
              <p className="run-hint">
                No candidates came back from the selected source(s). Check source toggle selection, API key validity,
                and Google Maps API restrictions/billing.
              </p>
            ) : null}
            {runEvents.length > 0 ? (
              <ul className="run-event-list">
                {runEvents.map((item) => {
                  const isInfo = item.error_message.startsWith("[info]");
                  const message = isInfo ? item.error_message.replace(/^\[info\]\s*/, "") : item.error_message;

                  return (
                    <li
                      className={isInfo ? "run-event run-event-info" : "run-event run-event-error"}
                      key={`${item.created_at}-${item.source_name}`}
                    >
                      [{item.source_name}] {message}
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
          <h2>Leads Table</h2>
          <button className="btn-clear" type="button" onClick={onExportLeads} disabled={leads.length === 0}>
            Export to Excel
          </button>
        </div>
        <p className="run-hint">
          Showing {leads.length} lead{leads.length === 1 ? "" : "s"}
          {hasActiveFilters ? " (filtered)" : ""}.
        </p>
        {hasActiveFilters ? <p className="run-hint">Filters are active; leads not matching them are hidden.</p> : null}
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>What they do</th>
                <th>Location</th>
                <th>Phone</th>
                <th>Website</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id}>
                  <td>{lead.name}</td>
                  <td>{lead.email && !lead.email.endsWith("@pending.local") ? lead.email : "-"}</td>
                  <td>
                    {lead.what_they_do_summary ? (
                      <div className="summary-cell">
                        <p className={`summary-text${expandedSummaries[lead.id] ? " expanded" : ""}`}>
                          {lead.what_they_do_summary}
                        </p>
                        {lead.what_they_do_summary.length > 160 ? (
                          <button className="summary-toggle" type="button" onClick={() => toggleSummary(lead.id)}>
                            {expandedSummaries[lead.id] ? "Collapse" : "Expand"}
                          </button>
                        ) : null}
                      </div>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td>{lead.location_text ?? "-"}</td>
                  <td>{lead.phone ?? "-"}</td>
                  <td>{lead.website ? <a href={lead.website}>{lead.website}</a> : "-"}</td>
                </tr>
              ))}
              {leads.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    {hasActiveFilters
                      ? "No leads match current filters. Clear filters to view all leads for this campaign."
                      : "No leads yet. Create a campaign and run collection."}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
