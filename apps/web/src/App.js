import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import { api } from "./lib/api";
export function App() {
    // ── Collection state ─────────────────────────────────────────────────────────
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
        nicheKeywords: "dentist, dental clinic", subNiche: "cosmetic dentistry",
        locationScope: "London, UK", offerNote: "Performance-focused website and lead generation service."
    });
    const [duplicateWarning, setDuplicateWarning] = useState(null);
    // ── Lead selection state ──────────────────────────────────────────────────────
    const [selectedLeadIds, setSelectedLeadIds] = useState(new Set());
    const [showListModal, setShowListModal] = useState(false);
    const [newListName, setNewListName] = useState("");
    const [listModalLoading, setListModalLoading] = useState(false);
    const [listModalError, setListModalError] = useState("");
    // ── Offers state ─────────────────────────────────────────────────────────────
    const [offers, setOffers] = useState([]);
    const [selectedOfferId, setSelectedOfferId] = useState("");
    const [offerForm, setOfferForm] = useState({
        offerName: "", offerSummary: "", targetProblem: "", keyOutcome: "", callToAction: ""
    });
    const [offerLoading, setOfferLoading] = useState(false);
    const [offerError, setOfferError] = useState("");
    const [showOfferForm, setShowOfferForm] = useState(false);
    const [offerMode, setOfferMode] = useState("manual");
    const [aiIdeaText, setAiIdeaText] = useState("");
    const [aiDrafting, setAiDrafting] = useState(false);
    const [aiRefined, setAiRefined] = useState(false); // true after first AI draft — shows refine row
    const [refinementNote, setRefinementNote] = useState("");
    const [aiRefining, setAiRefining] = useState(false);
    // ── Outreach Lists state ──────────────────────────────────────────────────────
    const [outreachLists, setOutreachLists] = useState([]);
    // ── Outreach generation state ─────────────────────────────────────────────────
    const [outreachRows, setOutreachRows] = useState([]);
    const [generatingOutreach, setGeneratingOutreach] = useState(false);
    const [outreachError, setOutreachError] = useState("");
    const [outreachCampaignId, setOutreachCampaignId] = useState("");
    const [outreachListId, setOutreachListId] = useState("");
    const [outreachSourceMode, setOutreachSourceMode] = useState("campaign");
    const [modalEmail, setModalEmail] = useState(null);
    // ── Derived ──────────────────────────────────────────────────────────────────
    const selectedCampaign = useMemo(() => campaigns.find(c => c.id === selectedCampaignId) ?? null, [campaigns, selectedCampaignId]);
    const selectedOffer = useMemo(() => offers.find(o => o.id === selectedOfferId) ?? null, [offers, selectedOfferId]);
    const outreachCampaign = useMemo(() => campaigns.find(c => c.id === outreachCampaignId) ?? null, [campaigns, outreachCampaignId]);
    const outreachList = useMemo(() => outreachLists.find(l => l.id === outreachListId) ?? null, [outreachLists, outreachListId]);
    const hasActiveFilters = Boolean(filters.q.trim() || filters.location.trim());
    const allLeadsSelected = leads.length > 0 && leads.every(l => selectedLeadIds.has(l.id));
    const someLeadsSelected = selectedLeadIds.size > 0;
    const runEvents = [...(run?.errors ?? [])].sort((a, b) => a.created_at.localeCompare(b.created_at));
    const latestRunEvent = [...runEvents].reverse().find(e => e.error_message.startsWith("[info]"))?.error_message.replace(/^\[info\]\s*/, "") ?? "";
    const processedCount = (run?.inserted_count ?? 0) + (run?.updated_count ?? 0) + (run?.rejected_no_email_count ?? 0);
    const progressPct = run ? (run.total_candidates > 0 ? Math.min(100, Math.round((processedCount / run.total_candidates) * 100)) : run.status === "completed" ? 100 : 0) : 0;
    // ── Data loaders ──────────────────────────────────────────────────────────────
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
    async function loadOffers() {
        const data = await api("/api/offers");
        setOffers(data);
        if (data[0] && !selectedOfferId)
            setSelectedOfferId(data[0].id);
    }
    async function loadOutreachLists() {
        const data = await api("/api/outreach-lists");
        setOutreachLists(data);
    }
    // ── Effects ───────────────────────────────────────────────────────────────────
    useEffect(() => {
        void loadCampaigns().catch(err => setError(err.message));
        void loadOffers().catch(() => undefined);
        void loadOutreachLists().catch(() => undefined);
    }, []);
    useEffect(() => {
        if (!selectedCampaignId) {
            setRun(null);
            return;
        }
        void loadLeads().catch(err => setError(err.message));
        void loadLatestRun(selectedCampaignId).catch(err => setError(err.message));
        setSelectedLeadIds(new Set());
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
    useEffect(() => {
        function onKey(e) { if (e.key === "Escape") {
            setModalEmail(null);
            setShowListModal(false);
            setDuplicateWarning(null);
        } }
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);
    // ── Handlers: Collection ──────────────────────────────────────────────────────
    async function onCreateCampaign(e) {
        e.preventDefault();
        setLoading(true);
        setError("");
        try {
            await api("/api/campaigns", {
                method: "POST",
                body: JSON.stringify({
                    nicheKeywords: form.nicheKeywords.split(",").map(v => v.trim()).filter(Boolean),
                    subNiche: form.subNiche, locationScope: form.locationScope, offerNote: form.offerNote
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
    async function onRunCampaign(force = false) {
        if (!selectedCampaignId)
            return;
        if (!sources.google && !sources.yelp && !sources.apify) {
            setError("Select at least one source.");
            return;
        }
        setLoading(true);
        setError("");
        setDuplicateWarning(null);
        try {
            const createdRun = await api(`/api/campaigns/${selectedCampaignId}/run`, {
                method: "POST",
                body: JSON.stringify({ sources, targetLeads: Math.max(1, Math.min(500, Number(targetLeads) || 30)), force })
            });
            setRun(createdRun);
        }
        catch (err) {
            // 409 = duplicate search warning — body is attached to err.body by api()
            const apiErr = err;
            if (apiErr.status === 409 && apiErr.body?.duplicate) {
                setDuplicateWarning(apiErr.body);
                setLoading(false);
                return;
            }
            setError(err instanceof Error ? err.message : "Run failed");
        }
        finally {
            setLoading(false);
        }
    }
    // ── Handlers: Lead selection ──────────────────────────────────────────────────
    function toggleLead(id) {
        setSelectedLeadIds(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
    }
    function toggleAllLeads() {
        if (allLeadsSelected)
            setSelectedLeadIds(new Set());
        else
            setSelectedLeadIds(new Set(leads.map(l => l.id)));
    }
    async function onAddToExistingList(listId) {
        if (selectedLeadIds.size === 0)
            return;
        setListModalLoading(true);
        setListModalError("");
        try {
            await api(`/api/outreach-lists/${listId}/leads`, {
                method: "POST", body: JSON.stringify({ leadIds: [...selectedLeadIds] })
            });
            await loadOutreachLists();
            setShowListModal(false);
            setSelectedLeadIds(new Set());
        }
        catch (err) {
            setListModalError(err instanceof Error ? err.message : "Failed to add leads");
        }
        finally {
            setListModalLoading(false);
        }
    }
    async function onCreateListWithLeads() {
        if (!newListName.trim() || selectedLeadIds.size === 0)
            return;
        setListModalLoading(true);
        setListModalError("");
        try {
            await api("/api/outreach-lists", {
                method: "POST", body: JSON.stringify({ name: newListName.trim(), leadIds: [...selectedLeadIds] })
            });
            await loadOutreachLists();
            setShowListModal(false);
            setNewListName("");
            setSelectedLeadIds(new Set());
        }
        catch (err) {
            setListModalError(err instanceof Error ? err.message : "Failed to create list");
        }
        finally {
            setListModalLoading(false);
        }
    }
    async function onDeleteList(id) {
        try {
            await api(`/api/outreach-lists/${id}`, { method: "DELETE" });
            setOutreachLists(prev => prev.filter(l => l.id !== id));
            if (outreachListId === id)
                setOutreachListId("");
        }
        catch { /* ignore */ }
    }
    // ── Handlers: Offers ──────────────────────────────────────────────────────────
    async function onSaveOffer(e) {
        e.preventDefault();
        setOfferLoading(true);
        setOfferError("");
        try {
            const created = await api("/api/offers", { method: "POST", body: JSON.stringify(offerForm) });
            setOffers(prev => [created, ...prev]);
            setSelectedOfferId(created.id);
            setOfferForm({ offerName: "", offerSummary: "", targetProblem: "", keyOutcome: "", callToAction: "" });
            setAiIdeaText("");
            setAiRefined(false);
            setRefinementNote("");
            setShowOfferForm(false);
        }
        catch (err) {
            setOfferError(err instanceof Error ? err.message : "Failed to save offer");
        }
        finally {
            setOfferLoading(false);
        }
    }
    async function onDeleteOffer(id) {
        try {
            await api(`/api/offers/${id}`, { method: "DELETE" });
            const remaining = offers.filter(o => o.id !== id);
            setOffers(remaining);
            if (selectedOfferId === id)
                setSelectedOfferId(remaining[0]?.id ?? "");
        }
        catch (err) {
            setOfferError(err instanceof Error ? err.message : "Failed to remove offer");
        }
    }
    async function onAiDraft() {
        if (aiIdeaText.trim().length < 10)
            return;
        setAiDrafting(true);
        setOfferError("");
        try {
            const fields = await api("/api/offers/ai-draft", {
                method: "POST", body: JSON.stringify({ userIdea: aiIdeaText })
            });
            setOfferForm(fields);
            setAiRefined(true);
        }
        catch (err) {
            setOfferError(err instanceof Error ? err.message : "AI draft failed");
        }
        finally {
            setAiDrafting(false);
        }
    }
    async function onAiRefine() {
        if (!refinementNote.trim())
            return;
        setAiRefining(true);
        setOfferError("");
        try {
            const fields = await api("/api/offers/ai-refine", {
                method: "POST", body: JSON.stringify({ currentFields: offerForm, refinementNote })
            });
            setOfferForm(fields);
            setRefinementNote("");
        }
        catch (err) {
            setOfferError(err instanceof Error ? err.message : "Refinement failed");
        }
        finally {
            setAiRefining(false);
        }
    }
    // ── Handlers: Outreach ────────────────────────────────────────────────────────
    async function onGenerateOutreach() {
        const payload = outreachSourceMode === "campaign"
            ? { campaignId: outreachCampaignId, offerId: selectedOfferId }
            : { listId: outreachListId, offerId: selectedOfferId };
        setGeneratingOutreach(true);
        setOutreachError("");
        setOutreachRows([]);
        try {
            const result = await api("/api/outreach/generate", {
                method: "POST", body: JSON.stringify(payload)
            });
            setOutreachRows(result.rows);
        }
        catch (err) {
            setOutreachError(err instanceof Error ? err.message : "Generation failed");
        }
        finally {
            setGeneratingOutreach(false);
        }
    }
    // ── Export helpers ────────────────────────────────────────────────────────────
    function csvCell(v) { return `"${String(v ?? "").replace(/"/g, '""')}"`; }
    function today() { return new Date().toISOString().slice(0, 10); }
    function downloadCsv(rows, filename) {
        const csv = rows.map(r => r.map(v => csvCell(v)).join(",")).join("\n");
        const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
    function onExportLeads() {
        if (!leads.length) {
            setError("No leads to export.");
            return;
        }
        const headers = ["Name", "Email", "What they do", "Location", "Phone", "Website"];
        downloadCsv([headers, ...leads.map(l => [l.name, l.email?.endsWith("@pending.local") ? "" : l.email, l.what_they_do_summary ?? "", l.location_text ?? "", l.phone ?? "", l.website ?? ""])], `${(selectedCampaign?.sub_niche ?? "leads").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${today()}.csv`);
    }
    function onExportOutreach() {
        if (!outreachRows.length) {
            setOutreachError("No rows to export.");
            return;
        }
        const headers = ["Name", "Email", "Phone", "Website", "Location", "Opener Subject", "Opener Body", "Follow-up 1 Subject", "Follow-up 1 Body", "Follow-up 2 Subject", "Follow-up 2 Body"];
        const slug = (selectedOffer?.offer_name ?? "outreach").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
        downloadCsv([headers, ...outreachRows.map(r => [r.name, r.email?.endsWith("@pending.local") ? "" : r.email, r.phone ?? "", r.website ?? "", r.location_text ?? "", r.opener_subject, r.opener_body, r.followup1_subject, r.followup1_body, r.followup2_subject, r.followup2_body])], `outreach-${slug}-${today()}.csv`);
    }
    const canGenerate = selectedOfferId && (outreachSourceMode === "campaign" ? !!outreachCampaignId : !!outreachListId) && !generatingOutreach;
    // ── Render ────────────────────────────────────────────────────────────────────
    return (_jsxs(_Fragment, { children: [duplicateWarning && (_jsx("div", { className: "modal-backdrop", onClick: () => setDuplicateWarning(null), children: _jsxs("div", { className: "modal modal-warning", onClick: e => e.stopPropagation(), children: [_jsxs("div", { className: "modal-header", children: [_jsx("h3", { children: "Keywords already searched" }), _jsx("button", { className: "modal-close", onClick: () => setDuplicateWarning(null), children: "\u2715" })] }), _jsxs("div", { className: "modal-body", style: { gap: "1rem" }, children: [duplicateWarning.duplicateType === "campaign" ? (_jsxs("div", { className: "dupe-info-box", children: [_jsx("div", { className: "dupe-icon", children: "\u26A1" }), _jsxs("div", { children: [_jsx("strong", { children: "This exact search was already completed" }), _jsxs("p", { children: ["It returned ", _jsxs("strong", { children: [duplicateWarning.leadCount, " leads"] }), " on ", new Date(duplicateWarning.completedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }), "."] }), _jsx("p", { children: "Running again would spend API credits on the same query with no new results." })] })] })) : (_jsxs("div", { className: "dupe-info-box", children: [_jsx("div", { className: "dupe-icon", children: "\uD83D\uDD0D" }), _jsxs("div", { children: [_jsx("strong", { children: "Some keywords were already searched in this location" }), _jsx("p", { children: "These keywords already have results saved \u2014 running again may not find new leads:" }), _jsx("ul", { className: "dupe-keyword-list", children: duplicateWarning.keywordMatches.map(m => (_jsxs("li", { children: [_jsxs("span", { className: "dupe-kw-tag", children: ["\"", m.keyword, "\""] }), "\u2014 ", m.resultsCount, " leads found on ", new Date(m.searchedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })] }, m.keyword))) })] })] })), _jsxs("div", { className: "dupe-actions", children: [duplicateWarning.duplicateType === "campaign" && (_jsx("button", { className: "btn-accent", onClick: () => {
                                                setSelectedCampaignId(duplicateWarning.existingCampaignId);
                                                setDuplicateWarning(null);
                                            }, children: "View existing leads" })), _jsx("button", { className: "btn-clear", onClick: () => { void onRunCampaign(true); setDuplicateWarning(null); }, children: "Run fresh anyway" }), _jsx("button", { className: "btn-ghost", onClick: () => setDuplicateWarning(null), children: "Cancel" })] })] })] }) })), modalEmail && (_jsx("div", { className: "modal-backdrop", onClick: () => setModalEmail(null), children: _jsxs("div", { className: "modal", onClick: e => e.stopPropagation(), children: [_jsxs("div", { className: "modal-header", children: [_jsxs("h3", { children: ["Emails for ", _jsx("span", { className: "modal-name", children: modalEmail.name })] }), _jsx("button", { className: "modal-close", onClick: () => setModalEmail(null), children: "\u2715" })] }), _jsx("div", { className: "modal-body", children: [
                                { label: "Opener", subject: modalEmail.opener_subject, body: modalEmail.opener_body, color: "#1877f2" },
                                { label: "Follow-up 1", subject: modalEmail.followup1_subject, body: modalEmail.followup1_body, color: "#7b5ea7" },
                                { label: "Follow-up 2", subject: modalEmail.followup2_subject, body: modalEmail.followup2_body, color: "#e67e22" }
                            ].map(({ label, subject, body, color }) => (_jsxs("div", { className: "modal-email", children: [_jsx("div", { className: "modal-email-tag", style: { background: color }, children: label }), _jsx("div", { className: "modal-email-subject", children: subject }), _jsx("div", { className: "modal-email-body", children: body })] }, label))) })] }) })), showListModal && (_jsx("div", { className: "modal-backdrop", onClick: () => setShowListModal(false), children: _jsxs("div", { className: "modal modal-list", onClick: e => e.stopPropagation(), children: [_jsxs("div", { className: "modal-header", children: [_jsxs("h3", { children: ["Add ", selectedLeadIds.size, " lead", selectedLeadIds.size !== 1 ? "s" : "", " to Outreach List"] }), _jsx("button", { className: "modal-close", onClick: () => setShowListModal(false), children: "\u2715" })] }), _jsxs("div", { className: "modal-body", style: { gap: "1.25rem" }, children: [_jsxs("div", { className: "list-modal-section", children: [_jsx("div", { className: "list-modal-label", children: "Create new list" }), _jsxs("div", { className: "list-modal-create-row", children: [_jsx("input", { value: newListName, onChange: e => setNewListName(e.target.value), placeholder: "e.g. Q2 London Outreach", onKeyDown: e => e.key === "Enter" && void onCreateListWithLeads() }), _jsx("button", { className: "btn-purple", disabled: !newListName.trim() || listModalLoading, onClick: () => void onCreateListWithLeads(), children: "Create & Add" })] })] }), outreachLists.length > 0 && (_jsxs("div", { className: "list-modal-section", children: [_jsx("div", { className: "list-modal-label", children: "Add to existing list" }), _jsx("div", { className: "list-modal-existing", children: outreachLists.map(list => (_jsxs("button", { className: "list-existing-item", disabled: listModalLoading, onClick: () => void onAddToExistingList(list.id), children: [_jsx("span", { className: "list-existing-name", children: list.name }), _jsxs("span", { className: "list-existing-count", children: [list.lead_count, " leads"] }), _jsx("span", { className: "list-existing-add", children: "+ Add" })] }, list.id))) })] })), listModalError && _jsx("p", { className: "error", children: listModalError })] })] }) })), _jsxs("main", { className: "layout", children: [_jsxs("div", { className: "workflow-steps", children: [_jsxs("div", { className: "workflow-step", children: [_jsx("div", { className: "step-num", children: "1" }), _jsx("div", { className: "step-label", children: "Collect Leads" })] }), _jsx("div", { className: "step-arrow", children: "\u2192" }), _jsxs("div", { className: "workflow-step", children: [_jsx("div", { className: "step-num", children: "2" }), _jsx("div", { className: "step-label", children: "Build Offer Library" })] }), _jsx("div", { className: "step-arrow", children: "\u2192" }), _jsxs("div", { className: "workflow-step", children: [_jsx("div", { className: "step-num", children: "3" }), _jsx("div", { className: "step-label", children: "Generate Outreach" })] })] }), _jsxs("div", { className: "step-section-label", children: [_jsx("span", { className: "step-badge", children: "Step 1" }), " Campaign Setup"] }), _jsxs("section", { className: "panel panel-glow", children: [_jsxs("header", { className: "panel-header", children: [_jsx("h1", { children: "Outreach Lead Intelligence" }), _jsx("p", { children: "Manual campaign runs across Google, Yelp-like directories, and Apify actors." })] }), _jsxs("form", { className: "campaign-form", onSubmit: onCreateCampaign, children: [_jsxs("label", { children: ["Collection keywords", _jsx("input", { value: form.nicheKeywords, onChange: e => setForm(p => ({ ...p, nicheKeywords: e.target.value })), placeholder: "e.g. dentist, whitening clinic" })] }), _jsxs("label", { children: ["Sub-niche", _jsx("input", { value: form.subNiche, onChange: e => setForm(p => ({ ...p, subNiche: e.target.value })) })] }), _jsxs("label", { children: ["Location", _jsx("input", { value: form.locationScope, onChange: e => setForm(p => ({ ...p, locationScope: e.target.value })) })] }), _jsxs("label", { children: ["Offer context", _jsx("textarea", { value: form.offerNote, onChange: e => setForm(p => ({ ...p, offerNote: e.target.value })) })] }), _jsx("button", { className: "btn-primary", disabled: loading, type: "submit", children: "+ Create Campaign" })] })] }), _jsxs("section", { className: "panel", children: [_jsxs("div", { className: "inline-row", children: [_jsxs("div", { children: [_jsx("h2", { children: "Run Control" }), _jsx("p", { style: { margin: 0, color: "var(--text-soft)", fontSize: "0.9rem" }, children: selectedCampaign ? `${selectedCampaign.sub_niche} — ${selectedCampaign.location_scope}` : "No campaign selected" })] }), _jsx("button", { className: "btn-accent", disabled: !selectedCampaignId || loading, onClick: () => void onRunCampaign(false), children: "Run Collection" })] }), _jsxs("div", { className: "source-toggles", children: [["google", "yelp", "apify"].map(src => (_jsxs("label", { className: "toggle-item", children: [_jsx("input", { type: "checkbox", checked: sources[src], onChange: e => setSources(p => ({ ...p, [src]: e.target.checked })) }), src === "google" ? "Google Maps API" : src === "yelp" ? "Yelp API" : "Apify Actors"] }, src))), _jsxs("label", { className: "target-input", children: ["Target leads", _jsx("input", { type: "number", min: 1, max: 500, value: targetLeads, onChange: e => setTargetLeads(Number(e.target.value || 30)) })] })] }), _jsxs("div", { className: "inline-row", style: { marginTop: "0.75rem" }, children: [_jsxs("label", { children: ["Campaign", _jsxs("select", { value: selectedCampaignId, onChange: e => setSelectedCampaignId(e.target.value), children: [_jsx("option", { value: "", children: "Select campaign" }), campaigns.map(c => _jsxs("option", { value: c.id, children: [c.sub_niche, " \u2014 ", c.location_scope] }, c.id))] })] }), _jsxs("label", { children: ["Search filter", _jsx("input", { value: filters.q, placeholder: "Filter table", onChange: e => setFilters(f => ({ ...f, q: e.target.value })) })] }), _jsxs("label", { children: ["Location filter", _jsx("input", { value: filters.location, onChange: e => setFilters(f => ({ ...f, location: e.target.value })) })] }), _jsx("button", { className: "btn-clear", type: "button", onClick: () => setFilters({ q: "", location: "" }), disabled: !hasActiveFilters, children: "Clear Filters" })] }), run && (_jsxs("div", { className: "run-card", children: [_jsxs("div", { className: "run-card-top", children: [_jsx("strong", { children: "Run status:" }), _jsx("span", { className: `run-status-badge run-status-${run.status}`, children: run.status })] }), _jsxs("div", { className: "progress-wrap", children: [_jsxs("div", { className: "progress-label", children: ["Progress: ", progressPct, "% (", processedCount, "/", run.total_candidates || 0, ")"] }), _jsx("div", { className: "progress-bar", children: _jsx("div", { className: "progress-fill", style: { width: `${progressPct}%` } }) })] }), latestRunEvent && _jsxs("p", { className: "run-live-status", children: ["\u25CF ", latestRunEvent] }), _jsx("div", { className: "metrics", children: [["Total", run.total_candidates ?? 0], ["Inserted", run.inserted_count ?? 0], ["Updated", run.updated_count ?? 0], ["Deduped", run.deduped_count ?? 0], ["Rejected", run.rejected_no_email_count ?? 0]].map(([label, val]) => (_jsxs("div", { className: "metric-pill", children: [_jsx("span", { className: "metric-val", children: val }), _jsx("span", { className: "metric-label", children: label })] }, label))) }), runEvents.length > 0 && (_jsx("ul", { className: "run-event-list", children: runEvents.map(item => (_jsxs("li", { className: item.error_message.startsWith("[info]") ? "run-event run-event-info" : "run-event run-event-error", children: ["[", item.source_name, "] ", item.error_message.replace(/^\[info\]\s*/, "")] }, `${item.created_at}-${item.source_name}`))) }))] })), error && _jsx("p", { className: "error", children: error })] }), _jsxs("section", { className: "panel", children: [_jsxs("div", { className: "leads-header", children: [_jsxs("div", { children: [_jsx("h2", { children: "Leads Table" }), _jsxs("p", { className: "run-hint", children: [leads.length, " lead", leads.length !== 1 ? "s" : "", hasActiveFilters ? " (filtered)" : ""] })] }), _jsxs("div", { style: { display: "flex", gap: "0.5rem", flexWrap: "wrap" }, children: [someLeadsSelected && (_jsxs("button", { className: "btn-purple", type: "button", onClick: () => { setShowListModal(true); setListModalError(""); }, children: ["Add ", selectedLeadIds.size, " to Outreach List"] })), _jsx("button", { className: "btn-clear", type: "button", onClick: onExportLeads, disabled: !leads.length, children: "Export CSV" })] })] }), _jsx("div", { className: "table-wrap", children: _jsxs("table", { children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { style: { width: "3%" }, children: _jsx("input", { type: "checkbox", checked: allLeadsSelected, onChange: toggleAllLeads, title: "Select all" }) }), _jsx("th", { children: "Name" }), _jsx("th", { children: "Email" }), _jsx("th", { children: "What they do" }), _jsx("th", { children: "Location" }), _jsx("th", { children: "Phone" }), _jsx("th", { children: "Website" })] }) }), _jsxs("tbody", { children: [leads.map(lead => (_jsxs("tr", { className: selectedLeadIds.has(lead.id) ? "row-selected" : "", children: [_jsx("td", { children: _jsx("input", { type: "checkbox", checked: selectedLeadIds.has(lead.id), onChange: () => toggleLead(lead.id) }) }), _jsx("td", { children: lead.name }), _jsx("td", { children: lead.email && !lead.email.endsWith("@pending.local") ? lead.email : "—" }), _jsx("td", { children: lead.what_they_do_summary ? (_jsxs("div", { className: "summary-cell", children: [_jsx("p", { className: `summary-text${expandedSummaries[lead.id] ? " expanded" : ""}`, children: lead.what_they_do_summary }), lead.what_they_do_summary.length > 160 && (_jsx("button", { className: "summary-toggle", type: "button", onClick: () => setExpandedSummaries(p => ({ ...p, [lead.id]: !p[lead.id] })), children: expandedSummaries[lead.id] ? "Collapse" : "Expand" }))] })) : "—" }), _jsx("td", { children: lead.location_text ?? "—" }), _jsx("td", { children: lead.phone ?? "—" }), _jsx("td", { children: lead.website ? _jsx("a", { href: lead.website, target: "_blank", rel: "noreferrer", children: lead.website }) : "—" })] }, lead.id))), !leads.length && (_jsx("tr", { children: _jsx("td", { colSpan: 7, style: { textAlign: "center", color: "var(--text-muted)", padding: "2rem" }, children: hasActiveFilters ? "No leads match current filters." : "No leads yet. Create a campaign and run collection." }) }))] })] }) })] }), _jsxs("div", { className: "step-section-label", style: { marginTop: "1.5rem" }, children: [_jsx("span", { className: "step-badge step-badge-purple", children: "Step 2" }), " Offer Library"] }), _jsxs("section", { className: "panel panel-purple", children: [_jsxs("div", { className: "offer-library-header", children: [_jsxs("div", { children: [_jsx("h2", { children: "Offer Library" }), _jsx("p", { className: "run-hint", children: "Save your offer once \u2014 reuse it across any lead list." })] }), _jsx("button", { className: "btn-purple", type: "button", onClick: () => { setShowOfferForm(v => !v); setOfferMode("manual"); setAiRefined(false); }, children: showOfferForm ? "Cancel" : "+ New Offer" })] }), showOfferForm && (_jsxs("div", { className: "offer-form", children: [_jsxs("div", { className: "offer-mode-tabs", children: [_jsx("button", { type: "button", className: `offer-tab${offerMode === "manual" ? " offer-tab-active" : ""}`, onClick: () => setOfferMode("manual"), children: "\u270F\uFE0F Manual" }), _jsx("button", { type: "button", className: `offer-tab${offerMode === "ai" ? " offer-tab-active" : ""}`, onClick: () => setOfferMode("ai"), children: "\u2728 AI-Assisted" })] }), offerMode === "ai" && !aiRefined && (_jsxs("div", { className: "ai-idea-section", children: [_jsxs("label", { className: "offer-form-full", children: ["Describe your offer in plain language", _jsx("textarea", { value: aiIdeaText, onChange: e => setAiIdeaText(e.target.value), placeholder: "e.g. I build AI systems for construction companies \u2014 automating their job scheduling, invoicing and client follow-ups so they stop losing hours to admin every week", style: { minHeight: "100px" } })] }), offerError && _jsx("p", { className: "error", children: offerError }), _jsx("button", { className: "btn-purple", type: "button", disabled: aiIdeaText.trim().length < 10 || aiDrafting, onClick: () => void onAiDraft(), children: aiDrafting ? _jsxs(_Fragment, { children: [_jsx("span", { className: "spinner" }), " Drafting with AI..."] }) : "✨ Draft with AI" })] })), (offerMode === "manual" || aiRefined) && (_jsxs("form", { onSubmit: onSaveOffer, children: [offerMode === "ai" && aiRefined && (_jsx("div", { className: "ai-drafted-banner", children: "\u2728 AI-drafted \u2014 review and edit before saving" })), _jsxs("div", { className: "offer-form-grid", style: { marginTop: "0.75rem" }, children: [_jsxs("label", { className: "offer-form-full", children: ["Offer name", _jsx("input", { value: offerForm.offerName, onChange: e => setOfferForm(p => ({ ...p, offerName: e.target.value })), placeholder: "e.g. AI Automations for Construction Companies", required: true })] }), _jsxs("label", { className: "offer-form-full", children: ["What you provide", _jsx("textarea", { value: offerForm.offerSummary, onChange: e => setOfferForm(p => ({ ...p, offerSummary: e.target.value })), placeholder: "What you build/deliver and who it's for", required: true })] }), _jsxs("label", { children: ["Problem you solve", _jsx("input", { value: offerForm.targetProblem, onChange: e => setOfferForm(p => ({ ...p, targetProblem: e.target.value })), placeholder: "e.g. manually managing job schedules", required: true })] }), _jsxs("label", { children: ["Key outcome / result", _jsx("input", { value: offerForm.keyOutcome, onChange: e => setOfferForm(p => ({ ...p, keyOutcome: e.target.value })), placeholder: "e.g. save 10+ hrs/week, 30% fewer missed jobs", required: true })] }), _jsxs("label", { className: "offer-form-full", children: ["Call to action", _jsx("input", { value: offerForm.callToAction, onChange: e => setOfferForm(p => ({ ...p, callToAction: e.target.value })), placeholder: "e.g. Would a 15-min call this week make sense?", required: true })] })] }), offerMode === "ai" && aiRefined && (_jsxs("div", { className: "refine-row", children: [_jsx("input", { value: refinementNote, onChange: e => setRefinementNote(e.target.value), placeholder: "Tell AI what to change, e.g. 'make the CTA softer' or 'focus more on saving money'", onKeyDown: e => e.key === "Enter" && void onAiRefine() }), _jsx("button", { type: "button", className: "btn-purple", disabled: !refinementNote.trim() || aiRefining, onClick: () => void onAiRefine(), children: aiRefining ? _jsxs(_Fragment, { children: [_jsx("span", { className: "spinner" }), " Refining..."] }) : "↺ Refine" })] })), offerError && _jsx("p", { className: "error", children: offerError }), _jsx("button", { className: "btn-purple", disabled: offerLoading, type: "submit", style: { marginTop: "0.75rem" }, children: offerLoading ? "Saving..." : "Save Offer" })] }))] })), offers.length > 0 ? (_jsx("div", { className: "offer-grid", style: { marginTop: showOfferForm ? "1.25rem" : "0.5rem" }, children: offers.map(offer => {
                                    const sel = selectedOfferId === offer.id;
                                    return (_jsxs("div", { className: `offer-card${sel ? " offer-card-selected" : ""}`, onClick: () => setSelectedOfferId(offer.id), role: "button", tabIndex: 0, onKeyDown: e => e.key === "Enter" && setSelectedOfferId(offer.id), children: [_jsxs("div", { className: "offer-card-top", children: [_jsx("div", { className: "offer-card-check", children: sel ? "✓" : "" }), _jsx("button", { className: "offer-card-remove", type: "button", onClick: e => { e.stopPropagation(); void onDeleteOffer(offer.id); }, children: "\u2715" })] }), _jsx("div", { className: "offer-card-name", children: offer.offer_name }), _jsx("div", { className: "offer-card-summary", children: offer.offer_summary }), _jsxs("div", { className: "offer-card-pills", children: [_jsxs("span", { className: "offer-pill offer-pill-problem", children: ["Solves: ", offer.target_problem] }), _jsxs("span", { className: "offer-pill offer-pill-outcome", children: ["Result: ", offer.key_outcome] })] }), _jsx("div", { className: "offer-card-cta", children: offer.call_to_action })] }, offer.id));
                                }) })) : (!showOfferForm && (_jsxs("div", { className: "empty-state", children: [_jsx("div", { className: "empty-icon", children: "\uD83D\uDCCB" }), _jsxs("p", { children: ["No offers saved yet. Click ", _jsx("strong", { children: "+ New Offer" }), " to create your first one."] })] })))] }), _jsxs("div", { className: "step-section-label", style: { marginTop: "1.5rem" }, children: [_jsx("span", { className: "step-badge step-badge-green", children: "Step 3" }), " Generate Outreach Emails"] }), _jsxs("section", { className: "panel panel-green", children: [_jsxs("div", { className: "leads-header", children: [_jsxs("div", { children: [_jsx("h2", { children: "Outreach Generator" }), _jsx("p", { className: "run-hint", children: "Pick a lead source + offer \u2192 generate personalised emails for every lead." })] }), outreachRows.length > 0 && (_jsxs("button", { className: "btn-green", type: "button", onClick: onExportOutreach, children: ["Export CSV (", outreachRows.length, " rows)"] }))] }), _jsxs("div", { className: "source-mode-toggle", children: [_jsx("button", { type: "button", className: `source-mode-btn${outreachSourceMode === "campaign" ? " source-mode-active" : ""}`, onClick: () => setOutreachSourceMode("campaign"), children: "Campaign Leads" }), _jsxs("button", { type: "button", className: `source-mode-btn${outreachSourceMode === "list" ? " source-mode-active" : ""}`, onClick: () => setOutreachSourceMode("list"), children: ["Outreach List ", outreachLists.length > 0 && _jsx("span", { className: "source-mode-badge", children: outreachLists.length })] })] }), _jsxs("div", { className: "outreach-config", children: [_jsxs("div", { className: "outreach-config-item", children: [_jsx("div", { className: "outreach-config-label", children: outreachSourceMode === "campaign" ? "Lead list (campaign)" : "Outreach List" }), outreachSourceMode === "campaign" ? (_jsxs("select", { className: "outreach-select", value: outreachCampaignId, onChange: e => setOutreachCampaignId(e.target.value), children: [_jsx("option", { value: "", children: "\u2014 Choose campaign \u2014" }), campaigns.map(c => _jsxs("option", { value: c.id, children: [c.sub_niche, " \u2014 ", c.location_scope] }, c.id))] })) : (_jsxs("select", { className: "outreach-select", value: outreachListId, onChange: e => setOutreachListId(e.target.value), children: [_jsx("option", { value: "", children: "\u2014 Choose list \u2014" }), outreachLists.map(l => _jsxs("option", { value: l.id, children: [l.name, " (", l.lead_count, " leads)"] }, l.id))] }))] }), _jsx("div", { className: "outreach-config-sep", children: "+" }), _jsxs("div", { className: "outreach-config-item", children: [_jsx("div", { className: "outreach-config-label", children: "Offer" }), _jsxs("select", { className: "outreach-select", value: selectedOfferId, onChange: e => setSelectedOfferId(e.target.value), children: [_jsx("option", { value: "", children: "\u2014 Choose offer \u2014" }), offers.map(o => _jsx("option", { value: o.id, children: o.offer_name }, o.id))] })] }), _jsx("button", { className: "btn-generate", type: "button", disabled: !canGenerate, onClick: () => void onGenerateOutreach(), children: generatingOutreach ? _jsxs(_Fragment, { children: [_jsx("span", { className: "spinner" }), " Generating..."] }) : "Generate Emails" })] }), outreachSourceMode === "list" && outreachLists.length > 0 && (_jsx("div", { className: "outreach-lists-row", children: outreachLists.map(list => (_jsxs("div", { className: "outreach-list-chip", children: [_jsx("span", { children: list.name }), _jsx("span", { className: "outreach-list-chip-count", children: list.lead_count }), _jsx("button", { type: "button", onClick: () => void onDeleteList(list.id), title: "Remove list", children: "\u2715" })] }, list.id))) })), outreachSourceMode === "list" && outreachLists.length === 0 && !generatingOutreach && (_jsxs("div", { className: "empty-state", style: { padding: "1.5rem" }, children: [_jsx("div", { className: "empty-icon", children: "\uD83D\uDCCC" }), _jsxs("p", { children: ["No outreach lists yet. Go to the ", _jsx("strong", { children: "Leads Table" }), " above, check some leads, and click ", _jsx("strong", { children: "Add to Outreach List" }), "."] })] })), (outreachCampaign || outreachList || selectedOffer) && (_jsxs("div", { className: "outreach-summary-row", children: [outreachSourceMode === "campaign" && outreachCampaign && (_jsxs("span", { className: "outreach-tag outreach-tag-blue", children: ["List: ", outreachCampaign.sub_niche, " \u2014 ", outreachCampaign.location_scope] })), outreachSourceMode === "list" && outreachList && (_jsxs("span", { className: "outreach-tag outreach-tag-blue", children: ["List: ", outreachList.name, " (", outreachList.lead_count, " leads)"] })), selectedOffer && _jsxs("span", { className: "outreach-tag outreach-tag-purple", children: ["Offer: ", selectedOffer.offer_name] })] })), generatingOutreach && (_jsxs("div", { className: "generating-banner", children: [_jsx("span", { className: "spinner spinner-lg" }), _jsxs("div", { children: [_jsx("strong", { children: "Generating personalised emails..." }), _jsx("p", { children: "Writing opener + 2 follow-ups for each lead. This may take a moment for large lists." })] })] })), outreachError && _jsx("p", { className: "error", style: { marginTop: "0.75rem" }, children: outreachError }), outreachRows.length > 0 && (_jsxs(_Fragment, { children: [_jsxs("div", { className: "results-banner", children: [_jsx("span", { className: "results-count", children: outreachRows.length }), "leads with personalised emails ready.", _jsx("span", { className: "results-hint", children: "Click any row to preview all 3 emails." })] }), _jsx("div", { className: "table-wrap", children: _jsxs("table", { className: "outreach-table", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "Name" }), _jsx("th", { children: "Email" }), _jsx("th", { children: "Phone" }), _jsx("th", { children: "Website" }), _jsxs("th", { children: [_jsx("span", { className: "email-col-tag", style: { background: "#1877f2" }, children: "Opener" }), "Subject"] }), _jsxs("th", { children: [_jsx("span", { className: "email-col-tag", style: { background: "#7b5ea7" }, children: "Follow-up 1" }), "Subject"] }), _jsxs("th", { children: [_jsx("span", { className: "email-col-tag", style: { background: "#e67e22" }, children: "Follow-up 2" }), "Subject"] }), _jsx("th", {})] }) }), _jsx("tbody", { children: outreachRows.map(row => (_jsxs("tr", { className: "outreach-row", onClick: () => setModalEmail({ name: row.name, opener_subject: row.opener_subject, opener_body: row.opener_body, followup1_subject: row.followup1_subject, followup1_body: row.followup1_body, followup2_subject: row.followup2_subject, followup2_body: row.followup2_body }), children: [_jsx("td", { children: _jsx("strong", { children: row.name }) }), _jsx("td", { className: "td-mono", children: row.email && !row.email.endsWith("@pending.local") ? row.email : "—" }), _jsx("td", { className: "td-mono", children: row.phone ?? "—" }), _jsx("td", { children: row.website ? _jsx("a", { href: row.website, target: "_blank", rel: "noreferrer", onClick: e => e.stopPropagation(), children: row.website.replace(/^https?:\/\//, "") }) : "—" }), _jsx("td", { children: _jsx("span", { className: "subject-preview", children: row.opener_subject }) }), _jsx("td", { children: _jsx("span", { className: "subject-preview", children: row.followup1_subject }) }), _jsx("td", { children: _jsx("span", { className: "subject-preview", children: row.followup2_subject }) }), _jsx("td", { children: _jsx("button", { className: "btn-preview", type: "button", children: "View emails" }) })] }, row.lead_id))) })] }) })] })), !outreachRows.length && !generatingOutreach && (_jsxs("div", { className: "empty-state", children: [_jsx("div", { className: "empty-icon", children: "\u2709\uFE0F" }), _jsxs("p", { children: ["Select a lead source and an offer above, then click ", _jsx("strong", { children: "Generate Emails" }), "."] })] }))] })] })] }));
}
