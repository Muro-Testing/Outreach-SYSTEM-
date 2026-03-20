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

// Extract a short, natural business name from the full Google Maps name
// e.g. "TEL Constructions - Construction Company in London" → "TEL Constructions"
function shortName(fullName: string): string {
  return fullName
    .split(/\s*[-–|]\s*/)[0]
    .trim()
    .replace(/\b(Ltd|LLC|Inc|Corp|Co|Limited|plc)\.?$/i, "")
    .trim();
}

// Clean up the what_they_do_summary to a short usable phrase
function shortBizDescription(summary: string | null, name: string): string {
  if (!summary) return "your business";
  const s = summary.replace(/\s+/g, " ").trim();
  return s.length > 120 ? s.slice(0, 120).replace(/\s+\S+$/, "") + "..." : s;
}

function fallbackEmails(lead: LeadForOutreach, offer: OfferForOutreach): GeneratedEmails {
  const biz = shortName(lead.name);
  const desc = shortBizDescription(lead.what_they_do_summary, lead.name);
  const domain = lead.website ? lead.website.replace(/^https?:\/\/(www\.)?/, "").split("/")[0] : null;
  const siteRef = domain ? ` (saw ${domain})` : "";

  return {
    opener_subject: `A quick idea for ${biz}`,

    opener_body: [
      `Hi ${biz} team,`,
      ``,
      `I was looking at your work${siteRef} and noticed something that caught my attention — ${desc}.`,
      ``,
      `We work with businesses like yours to help them ${offer.key_outcome}. Most of the teams we help were spending too much time on ${offer.target_problem} before they brought us in.`,
      ``,
      `We do this through ${offer.offer_summary}.`,
      ``,
      `${offer.call_to_action}`,
      ``,
      `Best,`
    ].join("\n"),

    followup1_subject: `Re: A quick idea for ${biz}`,

    followup1_body: [
      `Hi again,`,
      ``,
      `Just circling back on my last message in case it got buried.`,
      ``,
      `The short version: we help ${desc.slice(0, 60)}... businesses ${offer.key_outcome} — without adding headcount.`,
      ``,
      `${offer.call_to_action}`,
      ``,
      `Best,`
    ].join("\n"),

    followup2_subject: `Last one from me — ${biz}`,

    followup2_body: [
      `Hi,`,
      ``,
      `I'll keep this short — this is my last follow-up.`,
      ``,
      `If ${offer.target_problem} is ever something you want to solve properly, we'd love to show you what we've built for similar businesses.`,
      ``,
      `${offer.call_to_action}`,
      ``,
      `Either way, wishing you and the ${biz} team all the best.`
    ].join("\n")
  };
}

function parseEmailJson(content: string): GeneratedEmails | null {
  // Strip markdown code fences
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

    // Reject if core fields are missing or too short
    if (!opener_subject || opener_body.length < 40) return null;

    return { opener_subject, opener_body, followup1_subject, followup1_body, followup2_subject, followup2_body };
  } catch {
    return null;
  }
}

export async function generateEmailsForLead(
  lead: LeadForOutreach,
  offer: OfferForOutreach
): Promise<GeneratedEmails> {
  if (!env.mistralApiKey) {
    return fallbackEmails(lead, offer);
  }

  const biz = shortName(lead.name);
  const desc = shortBizDescription(lead.what_they_do_summary, lead.name);
  const domain = lead.website ? lead.website.replace(/^https?:\/\/(www\.)?/, "").split("/")[0] : null;

  const systemPrompt = `You are a senior B2B cold email copywriter. Your job is to write highly personalised outreach emails that feel like they were written by a human who genuinely researched this specific business — not a template with fields filled in.

Critical rules:
- NEVER copy the offer description word for word. Use it only to understand what we sell, then rewrite naturally.
- NEVER use ALL CAPS in the email text.
- NEVER use generic openers like "I hope this finds you well", "My name is X", or "I came across your business".
- The first sentence must reference something SPECIFIC about what this business does.
- Connect our service to a real, concrete pain point this type of business likely faces — based on what they actually do.
- Write as if you know their world. Sound like a peer, not a salesperson.
- Keep it conversational, warm, and direct.
- Return ONLY valid JSON. No explanation, no preamble, no markdown.`;

  const userPrompt = `You are writing cold outreach emails on behalf of our company to this specific prospect.

--- ABOUT THE PROSPECT ---
Business name: ${biz}
Website: ${domain ?? "not listed"}
What they do: ${desc}
Location: ${lead.location_text ?? "unknown"}

--- WHAT WE SELL (use this as context only — do NOT copy this text into emails) ---
We offer: ${offer.offer_summary}
The problem we solve for businesses like theirs: ${offer.target_problem}
The result they get: ${offer.key_outcome}
How we want to end the email: ${offer.call_to_action}

--- YOUR TASK ---
Write 3 emails specifically for ${biz}, a business that does: "${desc}".

Think about: what specific daily frustrations or operational bottlenecks does a business like ${biz} likely face? How does our service solve exactly that for them? Write emails that make them feel like we understand their world.

Email 1 — Opener:
- Subject: 6-8 words, curiosity-driven, specific to their industry (no generic subjects)
- Body: 110-140 words
- Line 1: a specific observation about what ${biz} does — something that shows you know their business
- Line 2-3: connect that observation to a specific pain or inefficiency businesses like theirs typically face
- Line 4-5: introduce how we solve exactly that, in plain English (rewrite our offer in your own words, tailored to them)
- Close: natural CTA

Email 2 — Follow-up 1:
- Subject: feels like a reply thread (e.g. "Re: ..." or a new angle)
- Body: 65-80 words
- Add one new angle or specific example relevant to their type of business
- Soft CTA

Email 3 — Follow-up 2:
- Subject: brief, final-touch tone
- Body: 45-60 words
- Very brief. Acknowledge they're busy. One last hook specific to their business type. Warm close.

Return ONLY this JSON:
{
  "opener_subject": "...",
  "opener_body": "...",
  "followup1_subject": "...",
  "followup1_body": "...",
  "followup2_subject": "...",
  "followup2_body": "..."
}`;

  try {
    const res = await fetch(`${env.mistralBaseUrl.replace(/\/$/, "")}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.mistralApiKey}`
      },
      body: JSON.stringify({
        model: env.mistralModel,
        temperature: 0.75,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ]
      })
    });

    if (!res.ok) {
      console.warn(`[outreach] Mistral API error ${res.status} for lead ${lead.id}`);
      return fallbackEmails(lead, offer);
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const content = data.choices?.[0]?.message?.content ?? "";
    const parsed = parseEmailJson(content);

    if (parsed) return parsed;

    console.warn(`[outreach] JSON parse failed for lead ${lead.id}, using fallback. Raw: ${content.slice(0, 200)}`);
    return fallbackEmails(lead, offer);

  } catch (err) {
    console.warn(`[outreach] Generation error for lead ${lead.id}:`, err);
    return fallbackEmails(lead, offer);
  }
}

// Run generations with concurrency limit
export async function generateEmailsForLeads(
  leads: LeadForOutreach[],
  offer: OfferForOutreach,
  concurrency = 5
): Promise<Array<{ lead: LeadForOutreach; emails: GeneratedEmails }>> {
  const results: Array<{ lead: LeadForOutreach; emails: GeneratedEmails }> = [];

  for (let i = 0; i < leads.length; i += concurrency) {
    const batch = leads.slice(i, i + concurrency);
    const settled = await Promise.allSettled(
      batch.map((lead) => generateEmailsForLead(lead, offer))
    );
    for (let j = 0; j < batch.length; j++) {
      const result = settled[j];
      results.push({
        lead: batch[j],
        emails: result.status === "fulfilled" ? result.value : fallbackEmails(batch[j], offer)
      });
    }
  }

  return results;
}
