const EMAIL_REGEX = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const MAILTO_REGEX = /mailto:([^"'\s>?#]+)/gi;
const CF_EMAIL_REGEX = /data-cfemail=["']([0-9a-fA-F]{12,})["']/gi;
const OBFUSCATED_REGEX = /([a-z0-9._%+-]{1,64})\s*(?:\[at\]|\(at\)|\{at\}|\sat\s|@)\s*([a-z0-9.-]{1,253})\s*(?:\[dot\]|\(dot\)|\{dot\}|\sdot\s|\.)\s*([a-z]{2,24}(?:\s*(?:\[dot\]|\(dot\)|\{dot\}|\sdot\s|\.)\s*[a-z]{2,24})*)/gi;

const BLOCKED_DOMAINS = new Set([
  "example.com",
  "example.org",
  "example.net",
  "email.com",
  "email.co",
  "email.uk",
  "test.com",
  "domain.com"
]);

const BLOCKED_DOMAIN_PARTIALS = ["sentry.io", "mailinator", "example", "no-reply", "noreply"];

const BLOCKED_LOCALS = new Set(["example", "test", "demo", "sample", "mail", "email", "noreply", "no-reply"]);

const BLOCKED_TLDS = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg", "avif", "ico", "bmp"]);

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&#64;|&commat;/gi, "@")
    .replace(/&#46;|&period;/gi, ".")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&");
}

function cleanEmail(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^mailto:/, "")
    .replace(/[),.;:]+$/g, "");
}

function decodeCloudflareEmail(hex: string): string | null {
  if (!hex || hex.length < 4 || hex.length % 2 !== 0) return null;

  try {
    const key = Number.parseInt(hex.slice(0, 2), 16);
    if (Number.isNaN(key)) return null;

    let decoded = "";
    for (let i = 2; i < hex.length; i += 2) {
      const part = Number.parseInt(hex.slice(i, i + 2), 16);
      if (Number.isNaN(part)) return null;
      decoded += String.fromCharCode(part ^ key);
    }

    return decoded;
  } catch {
    return null;
  }
}

function normalizeObfuscatedTail(value: string): string {
  return value
    .replace(/\[dot\]|\(dot\)|\{dot\}|\sdot\s/gi, ".")
    .replace(/\s+/g, "")
    .replace(/\.+/g, ".")
    .replace(/^\.|\.$/g, "");
}

export function isLikelyBusinessEmail(email: string): boolean {
  const cleaned = cleanEmail(email);
  if (!cleaned.includes("@")) return false;

  const basic = cleaned.match(/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i);
  if (!basic) return false;

  const [local, domain] = cleaned.split("@");
  if (!local || !domain) return false;

  if (BLOCKED_LOCALS.has(local)) return false;
  if (local.startsWith("example")) return false;

  if (BLOCKED_DOMAINS.has(domain)) return false;
  if (domain.startsWith("example.")) return false;

  for (const partial of BLOCKED_DOMAIN_PARTIALS) {
    if (domain.includes(partial)) return false;
  }

  const tld = domain.split(".").pop() ?? "";
  if (BLOCKED_TLDS.has(tld)) return false;

  if (/^\d+x\./.test(domain) && BLOCKED_TLDS.has(tld)) return false;

  if (/^[a-f0-9]{24,}$/i.test(local)) return false;

  return true;
}

export function normalizeBusinessEmail(email: string): string | null {
  const cleaned = cleanEmail(decodeHtmlEntities(email));
  return isLikelyBusinessEmail(cleaned) ? cleaned : null;
}

export function extractBusinessEmails(text: string): string[] {
  const source = decodeHtmlEntities(text);
  const candidates: string[] = [];

  const directMatches = source.match(EMAIL_REGEX) ?? [];
  candidates.push(...directMatches);

  for (const match of source.matchAll(MAILTO_REGEX)) {
    const raw = decodeURIComponent(match[1] ?? "");
    candidates.push(raw);
  }

  for (const match of source.matchAll(CF_EMAIL_REGEX)) {
    const decoded = decodeCloudflareEmail(match[1] ?? "");
    if (decoded) candidates.push(decoded);
  }

  for (const match of source.matchAll(OBFUSCATED_REGEX)) {
    const local = (match[1] ?? "").replace(/\s+/g, "");
    const domain = (match[2] ?? "").replace(/\s+/g, "");
    const tail = normalizeObfuscatedTail(match[3] ?? "");
    if (local && domain && tail) {
      candidates.push(`${local}@${domain}.${tail}`.replace(/\.\./g, "."));
    }
  }

  const seen = new Set<string>();
  const valid: string[] = [];

  for (const match of candidates) {
    const normalized = normalizeBusinessEmail(match);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    valid.push(normalized);
  }

  return valid;
}
