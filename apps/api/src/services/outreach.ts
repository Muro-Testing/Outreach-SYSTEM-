import { env } from "../env.js";

export type LeadForOutreach = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  website: string | null;
  location_text: string | null;
  what_they_do_summary: string | null;
};

export type OfferForOutreach = {
  id: string;
  offer_name: string;
  offer_summary: string;
  target_problem: string;
  key_outcome: string;
  call_to_action: string;
};

export type GeneratedEmails = {
  opener_subject: string;
  opener_body: string;
  followup1_subject: string;
  followup1_body: string;
  followup2_subject: string;
  followup2_body: string;
};

export type OutreachModelChoice = "default" | "large" | "medium" | "small";

type GenerateLeadOptions = {
  modelChoice?: OutreachModelChoice;
};

type GenerateLeadBatchOptions = GenerateLeadOptions & {
  concurrency?: number;
  onLeadComplete?: (input: { lead: LeadForOutreach; emails: GeneratedEmails; completed: number; total: number }) => Promise<void> | void;
};

function resolveOutreachModel(modelChoice?: OutreachModelChoice): string {
  switch (modelChoice) {
    case "large":
      return "mistral-large-latest";
    case "medium":
      return "mistral-medium-latest";
    case "small":
      return "mistral-small-latest";
    default:
      return env.outreachMistralModel;
  }
}

export function getOutreachModelLabel(modelChoice?: OutreachModelChoice): string {
  return resolveOutreachModel(modelChoice);
}

function resolveOutreachConcurrency(modelChoice?: OutreachModelChoice): number {
  switch (modelChoice) {
    case "large":
      return 3;
    case "small":
      return 6;
    case "medium":
    case "default":
    default:
      return 4;
  }
}

function shortName(fullName: string): string {
  const stripped = fullName
    .split(/\s*[-–|]\s*/)[0]
    .trim()
    .replace(/\b(Ltd|LLC|Inc|Corp|Co|Limited|plc|Group|Holdings|International|Solutions|Services|Technologies|Consultancy|Contractors|Associates)\.?$/i, "")
    .trim();

  // Strip leading "The " — "The Window Company" → "Window Company"
  const withoutThe = stripped.replace(/^The\s+/i, "").trim();

  const words = withoutThe.split(/\s+/);
  // If more than 3 words, use the first 2 — the brand identifier a person would say
  // e.g. "1st Class Window Systems" → "1st Class"
  if (words.length > 3) {
    return words.slice(0, 2).join(" ");
  }
  return withoutThe;
}

function shortBizDescription(summary: string | null): string {
  if (!summary) return "your business";
  const clean = summary.replace(/\s+/g, " ").trim();
  return clean.length > 120 ? `${clean.slice(0, 120).replace(/\s+\S+$/, "")}...` : clean;
}

function fallbackEmails(lead: LeadForOutreach, offer: OfferForOutreach): GeneratedEmails {
  const biz = shortName(lead.name);
  const desc = shortBizDescription(lead.what_they_do_summary);
  const domain = lead.website ? lead.website.replace(/^https?:\/\/(www\.)?/, "").split("/")[0] : null;
  const siteRef = domain ? ` on ${domain}` : "";

  return {
    opener_subject: `Quick idea for ${biz}`,
    opener_body: [
      `Hi ${biz} team,`,
      ``,
      `I had a look at ${biz}${siteRef} and noticed you focus on ${desc}. Teams in that position usually end up losing time to ${offer.target_problem} when things get busy.`,
      ``,
      `We help businesses like yours ${offer.key_outcome} through ${offer.offer_summary}.`,
      ``,
      `${offer.call_to_action}`,
      ``,
      `Best,`
    ].join("\n"),
    followup1_subject: `Re: Quick idea for ${biz}`,
    followup1_body: [
      `Hi ${biz} team,`,
      ``,
      `Following up in case this is relevant. We usually see teams like yours hit friction around ${offer.target_problem} before they fix the process properly.`,
      ``,
      `${offer.call_to_action}`,
      ``,
      `Best,`
    ].join("\n"),
    followup2_subject: `Last note for ${biz}`,
    followup2_body: [
      `Hi ${biz} team,`,
      ``,
      `Last note from me. If improving ${offer.target_problem} is on the list this quarter, happy to show you a simple way to ${offer.key_outcome}.`,
      ``,
      `${offer.call_to_action}`
    ].join("\n")
  };
}

function parseEmailJson(content: string): GeneratedEmails | null {
  const stripped = content
    .replace(/^```json\s*/im, "")
    .replace(/^```\s*/im, "")
    .replace(/```\s*$/m, "")
    .trim();

  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  if (start < 0 || end <= start) return null;

  try {
    const parsed = JSON.parse(stripped.slice(start, end + 1)) as Partial<GeneratedEmails>;

    const opener_subject = String(parsed.opener_subject ?? "").trim();
    const opener_body = String(parsed.opener_body ?? "").trim();
    const followup1_subject = String(parsed.followup1_subject ?? "").trim();
    const followup1_body = String(parsed.followup1_body ?? "").trim();
    const followup2_subject = String(parsed.followup2_subject ?? "").trim();
    const followup2_body = String(parsed.followup2_body ?? "").trim();

    if (!opener_subject || opener_body.length < 40) return null;

    return {
      opener_subject,
      opener_body,
      followup1_subject,
      followup1_body,
      followup2_subject,
      followup2_body
    };
  } catch {
    return null;
  }
}

export async function refineEmailsForLead(
  lead: LeadForOutreach,
  existing: GeneratedEmails,
  offer: OfferForOutreach,
  options: GenerateLeadOptions & { instructions?: string } = {}
): Promise<GeneratedEmails> {
  if (!env.mistralApiKey) {
    return existing;
  }

  const model = resolveOutreachModel(options.modelChoice);
  const biz = shortName(lead.name);

  const systemPrompt = `You are a B2B cold email editor.

You will be given existing cold emails. Your job is to fix specific issues and polish the writing.
Do NOT rewrite from scratch. Keep the core message, structure, and intent. Only change what needs fixing.

Rules to always apply:
- Replace every em dash (—) and en dash (–) with a comma or a full stop. Never use dashes.
- Remove any possessive 's or s' attached to the company name. Rephrase the sentence naturally instead.
- The greeting must be "Hi ${biz} team," on its own line. Use this exact short name.
- Plain text only. No HTML, no markdown, no bullet points.
- No placeholders like [First Name] or [Company].
- Paragraphs separated by a single blank line only.

Return only valid JSON with the same six fields as the input.`;

  const instructionsBlock = options.instructions?.trim()
    ? `\n\nAdditional instructions from the sender:\n${options.instructions.trim()}`
    : "";

  const userPrompt = `Polish these cold emails for the following prospect.

Company short name: ${biz}

Existing emails:
Opener subject: ${existing.opener_subject}
Opener body:
${existing.opener_body}

Follow-up 1 subject: ${existing.followup1_subject}
Follow-up 1 body:
${existing.followup1_body}

Follow-up 2 subject: ${existing.followup2_subject}
Follow-up 2 body:
${existing.followup2_body}
${instructionsBlock}

Return only this JSON:
{
  "opener_subject": "...",
  "opener_body": "...",
  "followup1_subject": "...",
  "followup1_body": "...",
  "followup2_subject": "...",
  "followup2_body": "..."
}`;

  try {
    const controller = new AbortController();
    const timeoutMs = Number.isFinite(env.outreachMistralTimeoutMs) && env.outreachMistralTimeoutMs > 0
      ? env.outreachMistralTimeoutMs
      : 45000;
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(`${env.mistralBaseUrl.replace(/\/$/, "")}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.mistralApiKey}`
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        temperature: 0.3,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ]
      })
    }).finally(() => clearTimeout(timeout));

    if (!res.ok) {
      console.warn(`[refine] Mistral API error ${res.status} for lead ${lead.id}, keeping original`);
      return existing;
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const content = data.choices?.[0]?.message?.content ?? "";
    const parsed = parseEmailJson(content);
    if (parsed) return parsed;

    console.warn(`[refine] JSON parse failed for lead ${lead.id}, keeping original. Raw: ${content.slice(0, 200)}`);
    return existing;
  } catch (err) {
    console.warn(`[refine] Error for lead ${lead.id}, keeping original:`, err);
    return existing;
  }
}

export async function refineEmailsForLeads(
  leads: Array<LeadForOutreach & { existingEmails: GeneratedEmails }>,
  offer: OfferForOutreach,
  options: GenerateLeadBatchOptions & { instructions?: string; onProgress?: (completed: number, total: number) => void } = {}
): Promise<Array<{ lead: LeadForOutreach; emails: GeneratedEmails }>> {
  const results: Array<{ lead: LeadForOutreach; emails: GeneratedEmails }> = [];
  // Refine is editing, not generating — use higher concurrency than generation
  const concurrency = options.concurrency ?? 8;
  let completed = 0;

  for (let i = 0; i < leads.length; i += concurrency) {
    const batch = leads.slice(i, i + concurrency);
    const settled = await Promise.allSettled(
      batch.map((lead) => refineEmailsForLead(lead, lead.existingEmails, offer, options))
    );
    for (let j = 0; j < batch.length; j += 1) {
      const result = settled[j];
      results.push({
        lead: batch[j],
        emails: result.status === "fulfilled" ? result.value : batch[j].existingEmails
      });
    }
    completed += batch.length;
    options.onProgress?.(completed, leads.length);
  }

  return results;
}

export async function generateEmailsForLead(
  lead: LeadForOutreach,
  offer: OfferForOutreach,
  options: GenerateLeadOptions = {}
): Promise<GeneratedEmails> {
  if (!env.mistralApiKey) {
    return fallbackEmails(lead, offer);
  }

  const model = resolveOutreachModel(options.modelChoice);
  const biz = shortName(lead.name);
  const desc = shortBizDescription(lead.what_they_do_summary);
  const domain = lead.website ? lead.website.replace(/^https?:\/\/(www\.)?/, "").split("/")[0] : null;

  const systemPrompt = `You are a senior B2B cold email copywriter.

Write cold outreach that follows modern deliverability-first standards:
- Plain-text only. No HTML, no markdown, no bullets inside the email body.
- Short, human, and conversational. These should feel like one-to-one emails, not campaigns.
- Never invent or use a personal first name. We do not know the recipient's first name.
- Greet them using the short company name followed by "team," — for example "Hi Window Systems team,". All three emails must open with this greeting on its own line.
- The short company name is already provided. Use it exactly as given. Do not use the full original business name.
- Never add 's or s' after the company name. Do not use the company name in a possessive form under any circumstances.
- Never use placeholders like [First Name], [Company], or {{name}}.
- Never use generic openers like "I hope you are well", "My name is", or "I came across your business".
- The first line after the greeting must reference something specific about what the company does.
- Do not copy the offer description verbatim. Rewrite it naturally in simple language.
- One clear CTA only. Place it as the final line of the body before signing off.
- No hype, no exaggerated claims, no ALL CAPS, no emojis, no heavy punctuation.
- No em dashes (—) or en dashes (–). Use a comma or a full stop instead.
- Subjects should be short and natural, usually 2 to 6 words.
- Separate paragraphs with a single blank line. No extra blank lines.
- Return only valid JSON with the required fields.`;

  const userPrompt = `Write 3 cold emails for this prospect.

Prospect:
- Company short name (use this exactly, do not change it): ${biz}
- Website: ${domain ?? "not listed"}
- What they do: ${desc}
- Location: ${lead.location_text ?? "unknown"}

Offer context:
- What we offer: ${offer.offer_summary}
- Problem we solve: ${offer.target_problem}
- Outcome we help create: ${offer.key_outcome}
- CTA to use as the base close: ${offer.call_to_action}

Required style:
- Plain text only.
- Personal and specific to this business type.
- All three emails must open with: Hi ${biz} team,
- Never write ${biz}'s or ${biz}s' — do not use the company name in possessive form.
- Use company-level language because we do not know a person's first name.
- Keep the opener around 60 to 110 words (body only, not counting greeting).
- Keep follow-up 1 around 35 to 60 words (body only, not counting greeting).
- Keep follow-up 2 around 25 to 45 words (body only, not counting greeting).
- No links unless they are already implied by the CTA text.
- No list formatting. Paragraphs only.

Email requirements:
1. Opener
- Subject: short, natural, non-salesy.
- Body structure: greeting line → blank line → specific observation about their work → blank line → likely pain point tied to simple value → blank line → CTA.

2. Follow-up 1
- Subject: reply-thread style starting with "Re:".
- Body structure: greeting line → blank line → one new angle or specific example relevant to their business → blank line → soft CTA.

3. Follow-up 2
- Subject: brief, final-note style.
- Body structure: greeting line → blank line → very short warm close leaving door open → blank line → CTA or sign-off.

Return only this JSON:
{
  "opener_subject": "...",
  "opener_body": "...",
  "followup1_subject": "...",
  "followup1_body": "...",
  "followup2_subject": "...",
  "followup2_body": "..."
}`;

  try {
    const controller = new AbortController();
    const timeoutMs = Number.isFinite(env.outreachMistralTimeoutMs) && env.outreachMistralTimeoutMs > 0
      ? env.outreachMistralTimeoutMs
      : 45000;
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(`${env.mistralBaseUrl.replace(/\/$/, "")}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.mistralApiKey}`
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        temperature: 0.65,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ]
      })
    }).finally(() => clearTimeout(timeout));

    if (!res.ok) {
      console.warn(`[outreach] Mistral API error ${res.status} for lead ${lead.id} using ${model}`);
      return fallbackEmails(lead, offer);
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const content = data.choices?.[0]?.message?.content ?? "";
    const parsed = parseEmailJson(content);
    if (parsed) return parsed;

    console.warn(`[outreach] JSON parse failed for lead ${lead.id} using ${model}, using fallback. Raw: ${content.slice(0, 200)}`);
    return fallbackEmails(lead, offer);
  } catch (err) {
    console.warn(`[outreach] Generation error for lead ${lead.id}:`, err);
    return fallbackEmails(lead, offer);
  }
}

export async function generateEmailsForLeads(
  leads: LeadForOutreach[],
  offer: OfferForOutreach,
  options: GenerateLeadBatchOptions = {}
): Promise<Array<{ lead: LeadForOutreach; emails: GeneratedEmails }>> {
  const results: Array<{ lead: LeadForOutreach; emails: GeneratedEmails }> = [];
  const concurrency = options.concurrency ?? resolveOutreachConcurrency(options.modelChoice);
  let cursor = 0;
  let completed = 0;

  async function worker() {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= leads.length) return;

      const lead = leads[index];
      let emails: GeneratedEmails;
      try {
        emails = await generateEmailsForLead(lead, offer, options);
      } catch {
        emails = fallbackEmails(lead, offer);
      }

      results.push({ lead, emails });
      completed += 1;
      await options.onLeadComplete?.({
        lead,
        emails,
        completed,
        total: leads.length
      });
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, leads.length) }, () => worker());
  await Promise.all(workers);

  return results;
}
