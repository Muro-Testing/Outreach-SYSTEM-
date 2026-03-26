import { Router } from "express";
import { z } from "zod";
import { createOfferRequestSchema, updateOfferRequestSchema } from "@outreach/contracts";
import { supabase } from "../db.js";
import { env } from "../env.js";

export const offersRouter = Router();

// ── AI Offer Builder helpers ───────────────────────────────────────────────────

type OfferFields = {
  offerName: string;
  offerSummary: string;
  targetProblem: string;
  keyOutcome: string;
  callToAction: string;
};

function parseOfferJson(content: string): OfferFields | null {
  const stripped = content
    .replace(/^```json\s*/im, "").replace(/^```\s*/im, "").replace(/```\s*$/m, "").trim();
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(stripped.slice(start, end + 1)) as Partial<OfferFields>;
    const offerName = String(parsed.offerName ?? "").trim();
    const offerSummary = String(parsed.offerSummary ?? "").trim();
    const targetProblem = String(parsed.targetProblem ?? "").trim();
    const keyOutcome = String(parsed.keyOutcome ?? "").trim();
    const callToAction = String(parsed.callToAction ?? "").trim();
    if (!offerName || !offerSummary) return null;
    return { offerName, offerSummary, targetProblem, keyOutcome, callToAction };
  } catch { return null; }
}

async function callMistral(systemPrompt: string, userPrompt: string): Promise<string | null> {
  if (!env.mistralApiKey) return null;
  try {
    const res = await fetch(`${env.mistralBaseUrl.replace(/\/$/, "")}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${env.mistralApiKey}` },
      body: JSON.stringify({
        model: env.mistralModel,
        temperature: 0.6,
        response_format: { type: "json_object" },
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }]
      })
    });
    if (!res.ok) return null;
    const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
    return data.choices?.[0]?.message?.content ?? null;
  } catch { return null; }
}

async function draftOfferWithAI(userIdea: string): Promise<OfferFields | null> {
  const system = `You are a senior B2B copywriter who turns rough business offer ideas into structured, conversion-optimised sales copy.
Rules:
- Write in professional, benefit-driven language — not jargon
- Keep each field concise and punchy
- The offer summary should be 1-2 sentences max
- Target problem: the specific pain the client faces BEFORE they hire you
- Key outcome: the concrete result they get AFTER (include a metric or timeframe if possible)
- Call to action: a natural, low-friction ask (e.g. "Would a 15-min call make sense?")
- Return ONLY valid JSON. No explanation.`;

  const user = `Turn this rough offer idea into 5 structured, conversion-ready fields:

"${userIdea}"

Return ONLY this JSON:
{
  "offerName": "Short, memorable name for this offer (5-8 words)",
  "offerSummary": "1-2 sentence description of what you do and who it's for",
  "targetProblem": "The specific problem or frustration the client has before you",
  "keyOutcome": "The concrete result they get — include a metric or timeframe if possible",
  "callToAction": "The natural ask to end emails with (1 sentence)"
}`;

  const content = await callMistral(system, user);
  if (!content) return null;
  return parseOfferJson(content);
}

async function refineOfferWithAI(currentFields: OfferFields, refinementNote: string): Promise<OfferFields | null> {
  const system = `You are a senior B2B copywriter refining structured offer copy based on client feedback.
Return ONLY valid JSON with the same 5 fields. Only change what the feedback asks for — leave other fields intact unless improving them is clearly needed.`;

  const user = `Here are the current offer fields:
${JSON.stringify(currentFields, null, 2)}

The user wants to refine it with this note:
"${refinementNote}"

Return the updated fields as ONLY this JSON:
{
  "offerName": "...",
  "offerSummary": "...",
  "targetProblem": "...",
  "keyOutcome": "...",
  "callToAction": "..."
}`;

  const content = await callMistral(system, user);
  if (!content) return null;
  return parseOfferJson(content);
}

// ── AI Offer Builder endpoints ─────────────────────────────────────────────────

// POST /ai-draft — body: { userIdea: string }
// Returns: { offerName, offerSummary, targetProblem, keyOutcome, callToAction }
offersRouter.post("/ai-draft", async (req, res) => {
  const schema = z.object({ userIdea: z.string().min(10) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const fields = await draftOfferWithAI(parsed.data.userIdea);
  if (!fields) return res.status(500).json({ error: "AI draft failed. Please try again or use manual mode." });
  return res.json(fields);
});

// POST /ai-refine — body: { currentFields: { offerName, offerSummary, targetProblem, keyOutcome, callToAction }, refinementNote: string }
offersRouter.post("/ai-refine", async (req, res) => {
  const schema = z.object({
    currentFields: z.object({
      offerName: z.string(),
      offerSummary: z.string(),
      targetProblem: z.string(),
      keyOutcome: z.string(),
      callToAction: z.string()
    }),
    refinementNote: z.string().min(3)
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const fields = await refineOfferWithAI(parsed.data.currentFields, parsed.data.refinementNote);
  if (!fields) return res.status(500).json({ error: "Refinement failed. Please try again." });
  return res.json(fields);
});

offersRouter.get("/", async (_, res) => {
  const result = await supabase
    .from("offers")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false });
  if (result.error) return res.status(500).json({ error: result.error.message });
  return res.json(result.data);
});

offersRouter.post("/", async (req, res) => {
  const parsed = createOfferRequestSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const result = await supabase
    .from("offers")
    .insert({
      offer_name: parsed.data.offerName,
      offer_summary: parsed.data.offerSummary,
      target_problem: parsed.data.targetProblem,
      key_outcome: parsed.data.keyOutcome,
      call_to_action: parsed.data.callToAction
    })
    .select("*")
    .single();

  if (result.error) return res.status(500).json({ error: result.error.message });
  return res.status(201).json(result.data);
});

offersRouter.patch("/:id", async (req, res) => {
  const { id } = req.params;
  const parsed = updateOfferRequestSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const result = await supabase
    .from("offers")
    .update({
      offer_name: parsed.data.offerName,
      offer_summary: parsed.data.offerSummary,
      target_problem: parsed.data.targetProblem,
      key_outcome: parsed.data.keyOutcome,
      call_to_action: parsed.data.callToAction,
      updated_at: new Date().toISOString()
    })
    .eq("id", id)
    .eq("is_active", true)
    .select("*")
    .single();

  if (result.error) return res.status(500).json({ error: result.error.message });
  return res.json(result.data);
});

offersRouter.delete("/:id", async (req, res) => {
  const { id } = req.params;
  const result = await supabase.from("offers").update({ is_active: false }).eq("id", id);
  if (result.error) return res.status(500).json({ error: result.error.message });
  return res.json({ ok: true });
});
