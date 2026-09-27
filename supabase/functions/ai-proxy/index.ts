// CalorVault AI proxy (Supabase Edge Function).
// Holds the Claude API key server-side so it's never shipped inside the app,
// and caps usage per phone and in total per day so a leaked app key can't run
// up a large bill. Deploy: Supabase Dashboard -> Edge Functions -> Deploy a new
// function -> Via Editor, name it "ai-proxy", paste this file, Deploy.
// Add the secret ANTHROPIC_API_KEY under Edge Functions -> Secrets.
import Anthropic from "npm:@anthropic-ai/sdk";
import { createClient } from "npm:@supabase/supabase-js@2";

const MODEL = "claude-sonnet-5";
// Requests allowed per phone per day, and for everyone combined per day.
const PER_PHONE_DAILY_LIMIT = 60;
const ALL_PHONES_DAILY_LIMIT = 500;

const anthropic = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY") });

function serverKey(): string {
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacy) return legacy;
  const keys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}");
  return Object.values(keys)[0] as string;
}
const db = createClient(Deno.env.get("SUPABASE_URL")!, serverKey());

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
};

function reply(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "content-type": "application/json" },
  });
}

// Only the app's own request shapes: text, or a base64 photo plus text.
function isValidContent(content: unknown): content is Anthropic.ContentBlockParam[] {
  if (!Array.isArray(content) || content.length === 0 || content.length > 4) return false;
  return content.every(
    (b) =>
      (b?.type === "text" && typeof b.text === "string" && b.text.length < 4000) ||
      (b?.type === "image" && b.source?.type === "base64" && typeof b.source.data === "string"),
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return reply({ error: "Method not allowed" }, 405);

  let body: { system?: unknown; content?: unknown; installId?: unknown };
  try {
    body = await req.json();
  } catch {
    return reply({ error: "Invalid JSON" }, 400);
  }
  const { system, content, installId } = body;
  if (
    typeof system !== "string" || system.length > 6000 ||
    typeof installId !== "string" || installId.length < 8 || installId.length > 64 ||
    !isValidContent(content)
  ) {
    return reply({ error: "Invalid request" }, 400);
  }

  const { data: allowed, error: usageError } = await db.rpc("bump_ai_usage", {
    p_install: installId,
    p_install_limit: PER_PHONE_DAILY_LIMIT,
    p_global_limit: ALL_PHONES_DAILY_LIMIT,
  });
  if (usageError) return reply({ error: "Usage check failed" }, 500);
  if (!allowed) return reply({ error: "Daily AI limit reached" }, 429);

  try {
    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 4000,
      output_config: { effort: "low" },
      system,
      messages: [{ role: "user", content }],
    });
    return reply(message);
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) return reply({ error: "AI is busy, try again" }, 429);
    if (err instanceof Anthropic.APIError) return reply({ error: err.message }, err.status ?? 502);
    return reply({ error: "AI request failed" }, 502);
  }
});
