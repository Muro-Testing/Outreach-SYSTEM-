import { env } from "../env.js";

/**
 * Uses Mistral to generate keyword variations for a niche in a location.
 * Returns an array of new keywords not already in the original list.
 */
export async function expandKeywordsWithAI(
  originalKeywords: string[],
  location: string,
  needed: number
): Promise<string[]> {
  if (!env.mistralApiKey || needed <= 0) return [];

  const system = `You are a B2B lead generation specialist. Your job is to generate search keyword variations for finding businesses on Google Maps.
Rules:
- Return ONLY a JSON array of strings. No explanation, no preamble.
- Each keyword should be a realistic search term someone would use on Google Maps.
- Keep each keyword short (2-5 words).
- Do NOT include location in the keywords — location is handled separately.
- Do NOT repeat the original keywords.
- Do NOT include generic terms like "business" or "company".`;

  const user = `I am searching for businesses in: ${location}
Original search keywords: ${originalKeywords.map(k => `"${k}"`).join(", ")}

Generate ${needed} additional keyword variations for the same niche that would find similar or related businesses I may have missed.
Think about: alternative names, specializations, related trades, synonyms, sub-categories.

Return ONLY a JSON array like: ["keyword 1", "keyword 2", ...]`;

  try {
    const res = await fetch(`${env.mistralBaseUrl.replace(/\/$/, "")}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.mistralApiKey}`
      },
      body: JSON.stringify({
        model: env.mistralModel,
        temperature: 0.4,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user }
        ]
      })
    });

    if (!res.ok) return [];

    const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content ?? "";

    // Parse the JSON — it may be wrapped in {"keywords": [...]} or just [...]
    const stripped = content.replace(/^```json\s*/im, "").replace(/^```\s*/im, "").replace(/```\s*$/m, "").trim();
    let parsed: unknown;
    try { parsed = JSON.parse(stripped); } catch { return []; }

    // Handle both array and {keywords: [...]} shapes
    const arr: unknown = Array.isArray(parsed)
      ? parsed
      : (typeof parsed === "object" && parsed !== null && "keywords" in parsed)
        ? (parsed as Record<string, unknown>)["keywords"]
        : null;

    if (!Array.isArray(arr)) return [];

    const lowerOriginals = new Set(originalKeywords.map(k => k.toLowerCase().trim()));
    return (arr as unknown[])
      .map(k => String(k).trim())
      .filter(k => k.length > 0 && !lowerOriginals.has(k.toLowerCase()))
      .slice(0, needed);
  } catch {
    return [];
  }
}
