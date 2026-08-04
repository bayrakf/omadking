import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') ?? '';

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

const BASE_PROMPT = `You are OMADCoach, an expert in One Meal A Day (OMAD) fasting, training optimisation and sports nutrition.

Give concise, actionable advice. Focus on: fasting window timing, electrolytes (sodium/potassium/magnesium), protein intake, pre- and post-workout nutrition, and making OMAD sustainable alongside hard training.

Rules:
- Keep answers under 150 words. Lead with the answer, then the reason.
- Use the athlete's own numbers when they are provided rather than generic ranges.
- You are not a doctor. If the question involves pregnancy, an eating disorder, diabetes, blood-pressure or heart medication, or unexplained symptoms such as fainting or chest pain, say plainly that this needs a clinician and do not improvise a protocol.
- If a question is outside fasting, nutrition and training, say so briefly instead of answering it.`;

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
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemText }] },
          contents,
          generationConfig: { maxOutputTokens: 400, temperature: 0.7 },
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
