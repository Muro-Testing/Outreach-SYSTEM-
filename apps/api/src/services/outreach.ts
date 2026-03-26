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

function shortName(fullName: string): string {
  return fullName
    .split(/\s*[-–|]\s*/)[0]
    .trim()
    .replace(/\b(Ltd|LLC|Inc|Corp|Co|Limited|plc)\.?$/i, "")
    .trim();
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

export async function generateEmailsForLead(
  lead: LeadForOutreach,
  offer: OfferForOutreach
): Promise<GeneratedEmails> {
  if (!env.mistralApiKey) {
    return fallbackEmails(lead, offer);
  }

  const biz = shortName(lead.name);
  const desc = shortBizDescription(lead.what_they_do_summary);
  const domain = lead.website ? lead.website.replace(/^https?:\/\/(www\.)?/, "").split("/")[0] : null;

  const systemPrompt = `You are a senior B2B cold email copywriter.

Write cold outreach that follows modern deliverability-first standards:
- Plain-text only. No HTML, no markdown, no bullets inside the email body.
- Short, human, and conversational. These should feel like one-to-one emails, not campaigns.
- Never invent or use a personal first name. We do not know the recipient's first name.
- If you greet them, use the company naturally, for example "Hi ${biz} team,". Never use the full long business name if it sounds clumsy.
- Never use placeholders like [First Name], [Company], or {{name}}.
- Never use generic openers like "I hope you are well", "My name is", or "I came across your business".
- The opening line must reference something specific about what the company does.
- Do not copy the offer description verbatim. Rewrite it naturally in simple language.
- One clear CTA only.
- No hype, no exaggerated claims, no ALL CAPS, no emojis, no heavy punctuation.
- Subjects should be short and natural, usually 2 to 6 words.
- Return only valid JSON with the required fields.`;

  const userPrompt = `Write 3 cold emails for this prospect.

Prospect:
- Company short name: ${biz}
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
- Use company-level language because we do not know a person's first name.
- Keep the opener around 60 to 110 words.
- Keep follow-up 1 around 35 to 60 words.
- Keep follow-up 2 around 25 to 45 words.
- No links unless they are already implied by the CTA text.
- No list formatting.

Email requirements:
1. Opener
- Subject: short, natural, non-salesy.
- Body: specific observation -> likely pain point -> simple value -> CTA.

2. Follow-up 1
- Subject: can be a light reply-thread style.
- Body: one new angle relevant to their business and a soft CTA.

3. Follow-up 2
- Subject: brief final nudge.
- Body: very short, respectful, warm close.

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
    const res = await fetch(`${env.mistralBaseUrl.replace(/\/$/, "")}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.mistralApiKey}`
      },
      body: JSON.stringify({
        model: env.mistralModel,
        temperature: 0.65,
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

export async function generateEmailsForLeads(
  leads: LeadForOutreach[],
  offer: OfferForOutreach,
  concurrency = 5
): Promise<Array<{ lead: LeadForOutreach; emails: GeneratedEmails }>> {
  const results: Array<{ lead: LeadForOutreach; emails: GeneratedEmails }> = [];

  for (let i = 0; i < leads.length; i += concurrency) {
    const batch = leads.slice(i, i + concurrency);
    const settled = await Promise.allSettled(batch.map((lead) => generateEmailsForLead(lead, offer)));
    for (let j = 0; j < batch.length; j += 1) {
      const result = settled[j];
      results.push({
        lead: batch[j],
        emails: result.status === "fulfilled" ? result.value : fallbackEmails(batch[j], offer)
      });
    }
  }

  return results;
}
