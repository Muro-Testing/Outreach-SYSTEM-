import { env } from "../env.js";

type SummaryResult = {
  summary: string;
  highlights: string;
};

function fallbackSummary(name: string, text: string): SummaryResult {
  const clean = text.replace(/\s+/g, " ").trim();
  const base = clean.length > 0 ? clean.slice(0, 260) : `${name} is a local business.`;
  return {
    summary: base,
    highlights: "- Services inferred from website content\n- Potential fit for personalized outreach"
  };
}

function parseModelJson(content: string): SummaryResult | null {
  const stripped = content
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  if (start < 0 || end <= start) return null;

  try {
    const parsed = JSON.parse(stripped.slice(start, end + 1)) as {
      summary?: string;
      highlights?: string | string[];
    };

    const summary = (parsed.summary ?? "").replace(/\s+/g, " ").trim();
    const highlights = Array.isArray(parsed.highlights)
      ? parsed.highlights.map((item) => `- ${String(item).trim()}`).join("\n")
      : String(parsed.highlights ?? "").trim();

    if (!summary && !highlights) return null;

    return {
      summary: summary || "Business summary unavailable.",
      highlights: highlights || "- No specific highlights extracted"
    };
  } catch {
    return null;
  }
}

export async function summarizeBusinessWithMistral(name: string, website: string, text: string): Promise<SummaryResult> {
  if (!env.mistralApiKey) {
    return fallbackSummary(name, text);
  }

  const prompt = [
    `Business name: ${name}`,
    `Website: ${website}`,
    "Task: Return JSON only with keys summary and highlights.",
    "summary: 1-2 sentence factual summary of what business does.",
    "highlights: array of 3 short bullets with concrete specifics useful for personalization.",
    "Use only provided content and avoid fabrication.",
    `Content: ${text.slice(0, 15000)}`
  ].join("\n");

  const res = await fetch(`${env.mistralBaseUrl.replace(/\/$/, "")}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.mistralApiKey}`
    },
    body: JSON.stringify({
      model: env.mistralModel,
      temperature: 0.2,
      messages: [
        { role: "system", content: "You extract concise business intelligence for sales personalization." },
        { role: "user", content: prompt }
      ]
    })
  });

  if (!res.ok) {
    return fallbackSummary(name, text);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const content = data.choices?.[0]?.message?.content ?? "";
  const parsed = parseModelJson(content);
  if (parsed) return parsed;

  return fallbackSummary(name, text);
}

