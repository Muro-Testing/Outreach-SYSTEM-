import { extractBusinessEmails, normalizeBusinessEmail } from "./email.js";

export type CrawlResult = {
  visited: string[];
  emails: string[];
  text: string;
};

function normalizeUrl(raw: string): string | null {
  try {
    const url = raw.startsWith("http") ? new URL(raw) : new URL(`https://${raw}`);
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function isCrawlablePath(pathname: string): boolean {
  return !/\.(png|jpg|jpeg|gif|webp|svg|pdf|zip|mp4|webm|avi|mov|ico)$/i.test(pathname);
}

function linkPriority(url: URL): number {
  const hay = `${url.pathname} ${url.search}`.toLowerCase();
  if (/contact|about|team|staff|company|imprint|legal|support|help|customer|locations/.test(hay)) return 0;
  if (/services|service|pricing|book|appointment|quote|get-in-touch|enquiry|enquiry|clinic/.test(hay)) return 1;
  return 2;
}

function extractLinks(html: string, currentUrl: string, rootHost: string): string[] {
  const links = new Set<string>();
  const regex = /href\s*=\s*["']([^"']+)["']/gi;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(html)) !== null) {
    const href = match[1].trim();
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) continue;

    try {
      const absolute = new URL(href, currentUrl);
      if (absolute.hostname !== rootHost) continue;
      if (!isCrawlablePath(absolute.pathname)) continue;
      absolute.hash = "";
      links.add(absolute.toString());
    } catch {
      continue;
    }
  }

  return [...links].sort((a, b) => linkPriority(new URL(a)) - linkPriority(new URL(b)));
}

function buildSeedUrls(start: string): string[] {
  const seeds = new Set<string>([start]);
  const root = new URL(start);

  const commonPaths = [
    "/contact",
    "/contact-us",
    "/about",
    "/about-us",
    "/team",
    "/our-team",
    "/company",
    "/support",
    "/help",
    "/locations",
    "/find-us",
    "/imprint",
    "/legal"
  ];

  for (const path of commonPaths) {
    const next = new URL(path, root.origin);
    seeds.add(next.toString());
  }

  return [...seeds];
}

export async function crawlWebsiteForContactData(
  website: string,
  options?: { maxPages?: number; maxDepth?: number; timeoutMs?: number }
): Promise<CrawlResult> {
  const maxPages = options?.maxPages ?? 10;
  const maxDepth = options?.maxDepth ?? 2;
  const timeoutMs = options?.timeoutMs ?? 15000;

  const start = normalizeUrl(website);
  if (!start) return { visited: [], emails: [], text: "" };

  const rootHost = new URL(start).hostname;
  const queue: Array<{ url: string; depth: number }> = buildSeedUrls(start).map((url) => ({ url, depth: 0 }));
  const visited = new Set<string>();
  const emails = new Set<string>();
  const textChunks: string[] = [];

  while (queue.length > 0 && visited.size < maxPages) {
    const { url, depth } = queue.shift()!;
    if (visited.has(url)) continue;
    visited.add(url);

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { "User-Agent": "OutreachSystemBot/1.0" }
      });
      clearTimeout(timer);
      if (!res.ok) continue;

      const contentType = res.headers.get("content-type") ?? "";
      if (!contentType.includes("text/html")) continue;

      const html = await res.text();
      const chunkText = htmlToText(html);
      if (chunkText) textChunks.push(chunkText.slice(0, 7000));

      const found = extractBusinessEmails(html);
      for (const email of found) {
        const normalized = normalizeBusinessEmail(email);
        if (normalized) emails.add(normalized);
      }

      if (depth < maxDepth) {
        const links = extractLinks(html, url, rootHost);
        for (const link of links) {
          if (!visited.has(link) && queue.every((item) => item.url !== link)) {
            queue.push({ url: link, depth: depth + 1 });
          }
        }
      }
    } catch {
      continue;
    }
  }

  return {
    visited: [...visited],
    emails: [...emails],
    text: textChunks.join("\n").slice(0, 70000)
  };
}
