import crypto from "node:crypto";
import { buildWhatTheyDoSummary } from "./summary.js";
import { normalizeBusinessEmail } from "./email.js";
import type { NormalizedLead, RawLead } from "../types.js";

export function extractDomain(website?: string): string | null {
  if (!website) return null;
  try {
    const url = website.startsWith("http") ? new URL(website) : new URL(`https://${website}`);
    return url.hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return null;
  }
}

export function payloadHash(payload: unknown): string {
  return crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export function normalizeRawLead(raw: RawLead): NormalizedLead | null {
  const name = raw.name?.trim();
  if (!name) return null;

  const email = raw.email ? normalizeBusinessEmail(raw.email) : null;
  const website = raw.website?.trim() ?? null;
  const phone = raw.phone?.trim() ?? null;
  const locationText = raw.locationText?.trim() ?? null;

  if (!website && !phone && !locationText) {
    return null;
  }

  return {
    name,
    email,
    whatTheyDoSummary: buildWhatTheyDoSummary(raw.description, name),
    locationText,
    phone,
    website,
    websiteDomain: extractDomain(website ?? undefined)
  };
}
