import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import { api } from "./lib/api";
export function App() {
    const [campaigns, setCampaigns] = useState([]);
    const [selectedCampaignId, setSelectedCampaignId] = useState("");
    const [run, setRun] = useState(null);
    const [leads, setLeads] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [filters, setFilters] = useState({ q: "", location: "" });
    const [sources, setSources] = useState({ google: true, yelp: false, apify: false });
    const [targetLeads, setTargetLeads] = useState(30);
    const [expandedSummaries, setExpandedSummaries] = useState({});
    const [form, setForm] = useState({
        nicheKeywords: "dentist, dental clinic",
        subNiche: "cosmetic dentistry",
        locationScope: "London, UK",
        offerNote: "Performance-focused website and lead generation service."
    });
    const selectedCampaign = useMemo(() => campaigns.find((c) => c.id === selectedCampaignId) ?? null, [campaigns, selectedCampaignId]);
    const hasActiveFilters = Boolean(filters.q.trim() || filters.location.trim());
    const runEvents = [...(run?.errors ?? [])].sort((a, b) => a.created_at.localeCompare(b.created_at));
    const latestRunEvent = [...runEvents].reverse().find((item) => item.error_message.startsWith("[info]"))?.error_message.replace(/^\[info\]\s*/, "") ?? "";
    const processedCount = (run?.inserted_count ?? 0) + (run?.updated_count ?? 0) + (run?.rejected_no_email_count ?? 0);
    const progressPct = run
        ? run.total_candidates > 0
            ? Math.min(100, Math.round((processedCount / run.total_candidates) * 100))
            : run.status === "completed"
                ? 100
                : 0
        : 0;
    async function loadCampaigns() {
        const data = await api("/api/campaigns");
        setCampaigns(data);
        if (!selectedCampaignId && data[0])
            setSelectedCampaignId(data[0].id);
    }
    async function loadLeads() {
        const params = new URLSearchParams();
        if (selectedCampaignId)
            params.set("campaignId", selectedCampaignId);
        if (filters.q)
            params.set("q", filters.q);
        if (filters.location)
            params.set("location", filters.location);
        const data = await api(`/api/leads?${params.toString()}`);
        setLeads(data);
    }
    async function loadLatestRun(campaignId) {
        const data = await api(`/api/campaigns/${campaignId}/latest-run`);
        setRun(data);
    }
    useEffect(() => {
        void loadCampaigns().catch((err) => setError(err.message));
    }, []);
    useEffect(() => {
        if (!selectedCampaignId) {
            setRun(null);
            return;
        }
        void loadLeads().catch((err) => setError(err.message));
        void loadLatestRun(selectedCampaignId).catch((err) => setError(err.message));
    }, [selectedCampaignId, filters.q, filters.location]);
    useEffect(() => {
        if (!run || (run.status !== "queued" && run.status !== "running"))
            return;
        const interval = setInterval(() => {
            void api(`/api/runs/${run.id}`).then(setRun).catch(() => undefined);
            void loadLeads().catch(() => undefined);
        }, 1500);
        return () => clearInterval(interval);
    }, [run]);
    async function onCreateCampaign(event) {
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
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "Campaign creation failed");
        }
        finally {
            setLoading(false);
        }
    }
    async function onRunCampaign() {
        if (!selectedCampaignId)
            return;
        if (!sources.google && !sources.yelp && !sources.apify) {
            setError("Select at least one source before running collection.");
            return;
        }
        setLoading(true);
        setError("");
        try {
            const createdRun = await api(`/api/campaigns/${selectedCampaignId}/run`, {
                method: "POST",
                body: JSON.stringify({
                    sources,
                    targetLeads: Math.max(1, Math.min(500, Number(targetLeads) || 30))
                })
            });
            setRun(createdRun);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "Run failed to start");
        }
        finally {
            setLoading(false);
        }
    }
    function csvCell(value) {
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
    function toggleSummary(leadId) {
        setExpandedSummaries((prev) => ({
            ...prev,
            [leadId]: !prev[leadId]
        }));
    }
    return (_jsxs("main", { className: "layout", children: [_jsxs("section", { className: "panel panel-glow", children: [_jsxs("header", { className: "panel-header", children: [_jsx("h1", { children: "Outreach Lead Intelligence" }), _jsx("p", { children: "Manual campaign runs across Google, Yelp-like directories, and Apify actors." })] }), _jsxs("form", { className: "campaign-form", onSubmit: onCreateCampaign, children: [_jsxs("label", { children: ["Collection keywords (used for scraping)", _jsx("input", { value: form.nicheKeywords, onChange: (e) => setForm((p) => ({ ...p, nicheKeywords: e.target.value })), placeholder: "e.g. dentist, whitening clinic" })] }), _jsxs("label", { children: ["Sub-niche (used for scraping)", _jsx("input", { value: form.subNiche, onChange: (e) => setForm((p) => ({ ...p, subNiche: e.target.value })) })] }), _jsxs("label", { children: ["Location (used for scraping)", _jsx("input", { value: form.locationScope, onChange: (e) => setForm((p) => ({ ...p, locationScope: e.target.value })) })] }), _jsxs("label", { children: ["Offer context", _jsx("textarea", { value: form.offerNote, onChange: (e) => setForm((p) => ({ ...p, offerNote: e.target.value })) })] }), _jsx("button", { className: "btn-primary", disabled: loading, type: "submit", children: "Create Campaign" })] })] }), _jsxs("section", { className: "panel", children: [_jsxs("div", { className: "inline-row", children: [_jsxs("div", { children: [_jsx("h2", { children: "Run Control" }), _jsxs("p", { children: ["Selected campaign: ", selectedCampaign ? selectedCampaign.sub_niche : "None"] })] }), _jsx("button", { className: "btn-accent", disabled: !selectedCampaignId || loading, onClick: onRunCampaign, children: "Run Collection" })] }), _jsx("p", { className: "run-hint", children: "Collection uses campaign keywords, sub-niche, and location fields above. Table search filter does not affect collection." }), _jsxs("div", { className: "source-toggles", children: [_jsxs("label", { className: "toggle-item", children: [_jsx("input", { type: "checkbox", checked: sources.google, onChange: (e) => setSources((prev) => ({ ...prev, google: e.target.checked })) }), "Google Maps API"] }), _jsxs("label", { className: "toggle-item", children: [_jsx("input", { type: "checkbox", checked: sources.yelp, onChange: (e) => setSources((prev) => ({ ...prev, yelp: e.target.checked })) }), "Yelp API"] }), _jsxs("label", { className: "toggle-item", children: [_jsx("input", { type: "checkbox", checked: sources.apify, onChange: (e) => setSources((prev) => ({ ...prev, apify: e.target.checked })) }), "Apify Actors"] }), _jsxs("label", { className: "target-input", children: ["Target leads", _jsx("input", { type: "number", min: 1, max: 500, value: targetLeads, onChange: (e) => setTargetLeads(Number(e.target.value || 30)) })] })] }), _jsxs("div", { className: "inline-row", children: [_jsxs("label", { children: ["Campaign", _jsxs("select", { value: selectedCampaignId, onChange: (e) => setSelectedCampaignId(e.target.value), children: [_jsx("option", { value: "", children: "Select campaign" }), campaigns.map((campaign) => (_jsxs("option", { value: campaign.id, children: [campaign.sub_niche, " - ", campaign.location_scope] }, campaign.id)))] })] }), _jsxs("label", { children: ["Table search filter", _jsx("input", { value: filters.q, placeholder: "Filter current table only", onChange: (e) => setFilters((f) => ({ ...f, q: e.target.value })) })] }), _jsxs("label", { children: ["Location filter (table)", _jsx("input", { value: filters.location, onChange: (e) => setFilters((f) => ({ ...f, location: e.target.value })) })] }), _jsx("button", { className: "btn-clear", type: "button", onClick: () => setFilters({ q: "", location: "" }), disabled: !hasActiveFilters, children: "Clear Filters" })] }), run ? (_jsxs("div", { className: "run-card", children: [_jsxs("strong", { children: ["Run status: ", run.status] }), _jsxs("div", { className: "progress-wrap", "aria-live": "polite", children: [_jsxs("div", { className: "progress-label", children: ["Progress: ", progressPct, "% (", processedCount, "/", run.total_candidates || 0, ")"] }), _jsx("div", { className: "progress-bar", children: _jsx("div", { className: "progress-fill", style: { width: `${progressPct}%` } }) })] }), run.status === "queued" || run.status === "running" ? (_jsxs(_Fragment, { children: [_jsx("p", { className: "run-hint", children: "Pipeline is active. Source fetch, save, and enrichment steps run in parallel where safe." }), latestRunEvent ? _jsxs("p", { className: "run-live-status", children: ["Live status: ", latestRunEvent] }) : null] })) : null, _jsxs("div", { className: "metrics", children: [_jsxs("span", { children: ["Total: ", run.total_candidates ?? 0] }), _jsxs("span", { children: ["Inserted: ", run.inserted_count ?? 0] }), _jsxs("span", { children: ["Updated: ", run.updated_count ?? 0] }), _jsxs("span", { children: ["Deduped: ", run.deduped_count ?? 0] }), _jsxs("span", { children: ["Rejected (invalid row): ", run.rejected_no_email_count ?? 0] })] }), run.status === "completed" && (run.total_candidates ?? 0) === 0 ? (_jsx("p", { className: "run-hint", children: "No candidates came back from the selected source(s). Check source toggle selection, API key validity, and Google Maps API restrictions/billing." })) : null, runEvents.length > 0 ? (_jsx("ul", { className: "run-event-list", children: runEvents.map((item) => {
                                    const isInfo = item.error_message.startsWith("[info]");
                                    const message = isInfo ? item.error_message.replace(/^\[info\]\s*/, "") : item.error_message;
                                    return (_jsxs("li", { className: isInfo ? "run-event run-event-info" : "run-event run-event-error", children: ["[", item.source_name, "] ", message] }, `${item.created_at}-${item.source_name}`));
                                }) })) : null] })) : null, error ? _jsx("p", { className: "error", children: error }) : null] }), _jsxs("section", { className: "panel", children: [_jsxs("div", { className: "leads-header", children: [_jsx("h2", { children: "Leads Table" }), _jsx("button", { className: "btn-clear", type: "button", onClick: onExportLeads, disabled: leads.length === 0, children: "Export to Excel" })] }), _jsxs("p", { className: "run-hint", children: ["Showing ", leads.length, " lead", leads.length === 1 ? "" : "s", hasActiveFilters ? " (filtered)" : "", "."] }), hasActiveFilters ? _jsx("p", { className: "run-hint", children: "Filters are active; leads not matching them are hidden." }) : null, _jsx("div", { className: "table-wrap", children: _jsxs("table", { children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "Name" }), _jsx("th", { children: "Email" }), _jsx("th", { children: "What they do" }), _jsx("th", { children: "Location" }), _jsx("th", { children: "Phone" }), _jsx("th", { children: "Website" })] }) }), _jsxs("tbody", { children: [leads.map((lead) => (_jsxs("tr", { children: [_jsx("td", { children: lead.name }), _jsx("td", { children: lead.email && !lead.email.endsWith("@pending.local") ? lead.email : "-" }), _jsx("td", { children: lead.what_they_do_summary ? (_jsxs("div", { className: "summary-cell", children: [_jsx("p", { className: `summary-text${expandedSummaries[lead.id] ? " expanded" : ""}`, children: lead.what_they_do_summary }), lead.what_they_do_summary.length > 160 ? (_jsx("button", { className: "summary-toggle", type: "button", onClick: () => toggleSummary(lead.id), children: expandedSummaries[lead.id] ? "Collapse" : "Expand" })) : null] })) : ("-") }), _jsx("td", { children: lead.location_text ?? "-" }), _jsx("td", { children: lead.phone ?? "-" }), _jsx("td", { children: lead.website ? _jsx("a", { href: lead.website, children: lead.website }) : "-" })] }, lead.id))), leads.length === 0 ? (_jsx("tr", { children: _jsx("td", { colSpan: 6, children: hasActiveFilters
                                                    ? "No leads match current filters. Clear filters to view all leads for this campaign."
                                                    : "No leads yet. Create a campaign and run collection." }) })) : null] })] }) })] })] }));
}
