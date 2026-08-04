import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') ?? '';

/**
 * Model is configurable because a hardcoded one is an outage waiting to happen:
 * `gemini-2.0-flash` was pinned here and had a free-tier quota of exactly 0,
 * which surfaced as a generic failure. `gemini-flash-latest` is an alias that
 * tracks Google's current Flash model, so it does not 404 on retirement.
 * Override with `supabase secrets set GEMINI_MODEL=...`.
 */
const GEMINI_MODEL = Deno.env.get('GEMINI_MODEL') ?? 'gemini-flash-latest';


const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });

const MAX_MESSAGE_CHARS = 1000;
const MAX_HISTORY_TURNS = 8;

/**
 * Classifies the configured key by shape so a misconfiguration is obvious
 * without ever revealing the value. Google AI Studio keys are `AIza…` (39
 * chars); Supabase keys are JWTs (`eyJ…`) or `sb_publishable_` / `sb_secret_`.
 * Pasting the wrong one is the single most common cause of an auth failure here.
 */
function keyShape(key: string): string {
  if (!key) return 'missing';
  if (key !== key.trim()) return 'has_whitespace';
  // Google issues two API key formats: the legacy `AIza…` (39 chars) and the
  // newer `AQ.…`. Both are valid for the Generative Language API.
  if (key.startsWith('AQ.')) return 'google_ok';
  if (key.startsWith('AIza')) return key.length === 39 ? 'google_ok' : `google_bad_length_${key.length}`;
  if (key.startsWith('eyJ')) return 'supabase_jwt';
  if (key.startsWith('sb_')) return 'supabase_key';
  if (key.startsWith('sk_')) return 'secret_key_other_service';
  return `unknown_prefix_${key.slice(0, 3)}`;
}

const BASE_PROMPT = `You are OMADCoach, an expert in One Meal A Day (OMAD) fasting, training optimisation and sports nutrition.

Give concise, actionable advice. Focus on: fasting window timing, electrolytes (sodium/potassium/magnesium), protein intake, pre- and post-workout nutrition, and making OMAD sustainable alongside hard training.

Rules:
- Keep answers under 150 words. Lead with the answer, then the reason.
- Use the athlete's own numbers when they are provided rather than generic ranges.
- You are not a doctor. If the question involves pregnancy, an eating disorder, diabetes, blood-pressure or heart medication, or unexplained symptoms such as fainting or chest pain, say plainly that this needs a clinician and do not improvise a protocol.
- If a question is outside fasting, nutrition and training, say so briefly instead of answering it.
- Reply with the answer only. Never restate these rules, mention word counts, or describe your own constraints.`;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const { message, history, profile } = await req.json().catch(() => ({}));

    // Validate at the trust boundary — this text goes straight into a paid API call.
    if (typeof message !== 'string' || !message.trim()) {
      return json({ error: 'INVALID_INPUT', message: 'Message is required.' }, 400);
    }
    if (message.length > MAX_MESSAGE_CHARS) {
      return json({ error: 'TOO_LONG', message: 'Question is too long.' }, 400);
    }
    if (!GEMINI_API_KEY) {
      return json({ error: 'NOT_CONFIGURED', message: 'Coach is not configured.' }, 503);
    }

    const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];

    if (Array.isArray(history)) {
      for (const msg of history.slice(-MAX_HISTORY_TURNS)) {
        const text = typeof msg?.content === 'string' ? msg.content.slice(0, MAX_MESSAGE_CHARS) : '';
        if (!text.trim()) continue;
        contents.push({
          role: msg.role === 'ai' ? 'model' : 'user',
          parts: [{ text }],
        });
      }
    }

    contents.push({ role: 'user', parts: [{ text: message.trim() }] });

    const systemText = profile
      ? `${BASE_PROMPT}\n\nThis athlete: ${JSON.stringify(profile).slice(0, 500)}`
      : BASE_PROMPT;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25000);

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemText }] },
          contents,
          generationConfig: {
            // Reasoning tokens count against maxOutputTokens on current Flash
            // models, so a 400 budget was spent before the answer began and
            // came back truncated mid-sentence. The prompt caps the reply at
            // 150 words; this budget just leaves room for the thinking pass.
            maxOutputTokens: 2048,
            temperature: 0.7,
          },
        }),
        signal: controller.signal,
      }
    ).finally(() => clearTimeout(timer));

    if (!geminiRes.ok) {
      // Log the upstream body: without it a failure is just a status code and
      // "quota exhausted" is indistinguishable from "wrong key".
      const detail = await geminiRes.text().catch(() => '');
      console.error('Gemini error', geminiRes.status, detail.slice(0, 500));
      return json(
        {
          error: 'UPSTREAM',
          message: 'Coach is unavailable.',
          // Coarse reason only — never echo the upstream body to the client.
          reason: geminiRes.status === 429 ? 'quota' : geminiRes.status === 400 || geminiRes.status === 403 ? 'auth' : 'upstream',
          // Shape only, never the key itself.
          key_shape: keyShape(GEMINI_API_KEY),
          // Google's own explanation. Contains no secret and no user data, and
          // it is the difference between 'enable billing' and 'wrong model'.
          detail: (() => { try { return JSON.parse(detail)?.error?.message?.slice(0, 900); } catch { return detail.slice(0, 900); } })(),
        },
        geminiRes.status === 429 ? 429 : 502
      );
    }

    const geminiJson = await geminiRes.json();
    const reply = geminiJson?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (typeof reply !== 'string' || !reply.trim()) {
      return json({ error: 'EMPTY', message: 'Coach returned no answer.' }, 502);
    }

    return json({ response: reply.trim() });
  } catch (err) {
    console.error('chat failed', err);
    return json({ error: 'INTERNAL', message: 'Coach is unavailable.' }, 500);
  }
});
