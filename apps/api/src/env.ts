import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
dotenv.config();

const required = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"] as const;

for (const key of required) {
  if (!process.env[key]) {
    console.warn(`[env] Missing ${key}. API calls requiring DB will fail until configured.`);
  }
}

const corsOriginsFromEnv = (process.env.CORS_ORIGIN ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

const corsOrigins = Array.from(new Set(["http://localhost:5173", "http://localhost:8790", ...corsOriginsFromEnv]));

export const env = {
  port: Number(process.env.PORT ?? 8787),
  corsOrigins,
  supabaseUrl: process.env.SUPABASE_URL ?? "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY ?? "",
  yelpApiKey: process.env.YELP_API_KEY ?? "",
  apifyToken: process.env.APIFY_TOKEN ?? "",
  apifyActorId: process.env.APIFY_ACTOR_ID ?? "",
  apifyGoogleMapsActorId: process.env.APIFY_GOOGLE_MAPS_ACTOR_ID ?? "",
  apifyYelpActorId: process.env.APIFY_YELP_ACTOR_ID ?? "",
  apifyLinkedinActorId: process.env.APIFY_LINKEDIN_ACTOR_ID ?? "",
  firecrawlApiKey: process.env.FIRECRAWL_API_KEY ?? "",
  tavilyApiKey: process.env.TAVILY_API_KEY ?? "",
  mistralApiKey: process.env.MISTRAL_API_KEY ?? "",
  mistralBaseUrl: process.env.MISTRAL_BASE_URL ?? "https://api.mistral.ai",
  mistralModel: process.env.MISTRAL_MODEL ?? "mistral-small-latest"
};
