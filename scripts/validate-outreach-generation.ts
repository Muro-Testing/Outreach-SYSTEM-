/**
 * validate-outreach-generation.ts
 * ---
 * Execution-first validation script for the outreach email generation feature.
 * Single responsibility: given a campaignId + offerId, call the generate endpoint
 * and verify the response shape. Saves results to /runs/outreach-generation/<timestamp>.json
 *
 * Usage:
 *   npx ts-node --esm scripts/validate-outreach-generation.ts <campaignId> <offerId>
 *   (or run from project root after setting API_BASE env var)
 *
 * Prerequisites:
 *   - API server running (npm run dev inside apps/api)
 *   - Valid campaignId with at least 1 lead in Supabase
 *   - Valid offerId in Supabase (create one via POST /api/offers first)
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const runsDir = path.resolve(__dirname, "../runs/outreach-generation");

const API_BASE = process.env.API_BASE ?? "http://localhost:8787";

const [, , campaignId, offerId] = process.argv;

if (!campaignId || !offerId) {
  console.error("Usage: ts-node scripts/validate-outreach-generation.ts <campaignId> <offerId>");
  process.exit(1);
}

async function run() {
  const startedAt = new Date().toISOString();
  console.log(`[validate] Generating outreach for campaignId=${campaignId} offerId=${offerId}`);

  let rawOutput: unknown = null;
  let success = false;
  let errorMessage = "";

  try {
    const res = await fetch(`${API_BASE}/api/outreach/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaignId, offerId })
    });

    rawOutput = await res.json();

    if (!res.ok) {
      errorMessage = `HTTP ${res.status}: ${JSON.stringify(rawOutput)}`;
    } else {
      const data = rawOutput as { generated: number; rows: unknown[] };
      if (typeof data.generated !== "number") throw new Error("Missing 'generated' field");
      if (!Array.isArray(data.rows)) throw new Error("Missing 'rows' array");

      // Validate first row shape
      if (data.rows.length > 0) {
        const row = data.rows[0] as Record<string, unknown>;
        const requiredFields = [
          "lead_id", "offer_id", "name",
          "opener_subject", "opener_body",
          "followup1_subject", "followup1_body",
          "followup2_subject", "followup2_body"
        ];
        for (const field of requiredFields) {
          if (!(field in row)) throw new Error(`Row missing field: ${field}`);
        }
      }

      success = true;
      console.log(`[validate] SUCCESS — ${data.generated} rows generated`);
      if ((data.rows as Record<string, unknown>[]).length > 0) {
        const sample = data.rows[0] as Record<string, string>;
        console.log(`[validate] Sample opener subject: ${sample.opener_subject}`);
      }
    }
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : String(err);
    console.error(`[validate] FAILED — ${errorMessage}`);
  }

  // Save run output
  fs.mkdirSync(runsDir, { recursive: true });
  const timestamp = startedAt.replace(/[:.]/g, "-");
  const outputPath = path.join(runsDir, `${timestamp}.json`);

  const runRecord = {
    metadata: {
      script: "validate-outreach-generation.ts",
      timestamp: startedAt,
      inputs: { campaignId, offerId },
      apiBase: API_BASE
    },
    rawOutput,
    success,
    error: errorMessage || null
  };

  fs.writeFileSync(outputPath, JSON.stringify(runRecord, null, 2), "utf-8");
  console.log(`[validate] Run saved to ${outputPath}`);
  process.exit(success ? 0 : 1);
}

void run();
