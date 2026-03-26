import { z } from "zod";

export const campaignInputSchema = z.object({
  nicheKeywords: z.array(z.string().min(1)).min(1),
  subNiche: z.string().min(1),
  locationScope: z.string().min(2)
});

export const runStatusSchema = z.enum(["queued", "running", "completed", "failed"]);

export const runMetricsSchema = z.object({
  totalCandidates: z.number().int().nonnegative(),
  insertedCount: z.number().int().nonnegative(),
  updatedCount: z.number().int().nonnegative(),
  dedupedCount: z.number().int().nonnegative(),
  rejectedNoEmailCount: z.number().int().nonnegative()
});

export const canonicalLeadSchema = z.object({
  id: z.string().uuid(),
  campaignId: z.string().uuid(),
  runId: z.string().uuid().nullable(),
  name: z.string().min(1),
  email: z.string().email().nullable(),
  whatTheyDoSummary: z.string().nullable(),
  businessHighlights: z.string().nullable(),
  locationText: z.string().nullable(),
  phone: z.string().nullable(),
  website: z.string().nullable(),
  websiteDomain: z.string().nullable(),
  createdAt: z.string()
});

export const leadSourceRecordSchema = z.object({
  id: z.string().uuid(),
  leadId: z.string().uuid(),
  campaignId: z.string().uuid(),
  runId: z.string().uuid(),
  sourceName: z.enum(["google", "yelp", "apify"]),
  matchedKeyword: z.string().nullable().optional(),
  externalId: z.string().nullable(),
  externalUrl: z.string().nullable(),
  rawPayloadHash: z.string(),
  createdAt: z.string()
});

export const campaignsListQuerySchema = z.object({
  includeArchived: z
    .union([z.boolean(), z.enum(["true", "false"])])
    .optional()
    .transform((value) => value === true || value === "true")
});

export const createCampaignRequestSchema = campaignInputSchema;

export const runSourcesSchema = z.object({
  google: z.boolean().default(true),
  yelp: z.boolean().default(false),
  apify: z.boolean().default(false)
});

export const runCampaignRequestSchema = z.object({
  sources: runSourcesSchema.optional(),
  targetLeads: z.number().int().min(1).max(500).optional(),
  force: z.boolean().optional()
});

export const listLeadsQuerySchema = z.object({
  campaignId: z.string().uuid().optional(),
  runId: z.string().uuid().optional(),
  keyword: z.string().optional(),
  q: z.string().optional(),
  location: z.string().optional(),
  sourceName: z.enum(["google", "yelp", "apify"]).optional(),
  includeArchivedCampaigns: z
    .union([z.boolean(), z.enum(["true", "false"])])
    .optional()
    .transform((value) => value === undefined ? undefined : value === true || value === "true")
});

export type CampaignInput = z.infer<typeof campaignInputSchema>;
export type CollectionRunStatus = z.infer<typeof runStatusSchema>;
export type RunMetrics = z.infer<typeof runMetricsSchema>;
export type CanonicalLead = z.infer<typeof canonicalLeadSchema>;
export type LeadSourceRecord = z.infer<typeof leadSourceRecordSchema>;
export type RunSources = z.infer<typeof runSourcesSchema>;

// ── Offers ────────────────────────────────────────────────────────────────────

export const createOfferRequestSchema = z.object({
  offerName: z.string().min(1),
  offerSummary: z.string().min(1),
  targetProblem: z.string().min(1),
  keyOutcome: z.string().min(1),
  callToAction: z.string().min(1)
});

export const offerSchema = z.object({
  id: z.string().uuid(),
  offer_name: z.string(),
  offer_summary: z.string(),
  target_problem: z.string(),
  key_outcome: z.string(),
  call_to_action: z.string(),
  is_active: z.boolean(),
  created_at: z.string()
});

export type CreateOfferRequest = z.infer<typeof createOfferRequestSchema>;
export type Offer = z.infer<typeof offerSchema>;

// ── Outreach ──────────────────────────────────────────────────────────────────

export const generateOutreachRequestSchema = z
  .object({
    campaignId: z.string().uuid().optional(),
    listId: z.string().uuid().optional(),
    offerId: z.string().uuid()
  })
  .refine((d) => d.campaignId || d.listId, { message: "campaignId or listId required" });

export const outreachRowSchema = z.object({
  lead_id: z.string().uuid(),
  offer_id: z.string().uuid(),
  name: z.string(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  website: z.string().nullable(),
  location_text: z.string().nullable(),
  opener_subject: z.string(),
  opener_body: z.string(),
  followup1_subject: z.string(),
  followup1_body: z.string(),
  followup2_subject: z.string(),
  followup2_body: z.string()
});

export const outreachHistorySummarySchema = z.object({
  id: z.string().uuid(),
  source_type: z.enum(["campaign", "list"]),
  campaign_id: z.string().uuid().nullable(),
  list_id: z.string().uuid().nullable(),
  offer_id: z.string().uuid(),
  generated_count: z.number().int().nonnegative(),
  model_version: z.string(),
  created_at: z.string(),
  offer_name: z.string(),
  campaign_name: z.string().nullable(),
  list_name: z.string().nullable()
});

export const outreachHistoryDetailSchema = outreachHistorySummarySchema.extend({
  rows: z.array(outreachRowSchema)
});

export type GenerateOutreachRequest = z.infer<typeof generateOutreachRequestSchema>;
export type OutreachRow = z.infer<typeof outreachRowSchema>;
export type OutreachHistorySummary = z.infer<typeof outreachHistorySummarySchema>;
export type OutreachHistoryDetail = z.infer<typeof outreachHistoryDetailSchema>;

// ── Outreach Lists ─────────────────────────────────────────────────────────────

export const outreachListSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  lead_count: z.number(),
  created_at: z.string()
});
export type OutreachList = z.infer<typeof outreachListSchema>;

export const createOutreachListSchema = z.object({
  name: z.string().min(1),
  leadIds: z.array(z.string().uuid()).optional()
});
export type CreateOutreachListRequest = z.infer<typeof createOutreachListSchema>;

// ── AI Offer Builder ───────────────────────────────────────────────────────────

export const aiDraftOfferRequestSchema = z.object({
  userIdea: z.string().min(10)
});
export const aiRefineOfferRequestSchema = z.object({
  currentFields: z.object({
    offerName: z.string(),
    offerSummary: z.string(),
    targetProblem: z.string(),
    keyOutcome: z.string(),
    callToAction: z.string()
  }),
  refinementNote: z.string().min(3)
});
export type AiDraftOfferRequest = z.infer<typeof aiDraftOfferRequestSchema>;
export type AiRefineOfferRequest = z.infer<typeof aiRefineOfferRequestSchema>;
