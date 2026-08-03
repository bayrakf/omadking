import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') ?? '';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    const { message, history } = await req.json();

    const systemPrompt = 'You are OMADCoach, an expert in One Meal A Day fasting, training optimization, and sports nutrition. Give concise, actionable advice. Focus on: fasting window timing, electrolytes (sodium/potassium/magnesium), protein intake, pre/post workout nutrition, and OMAD sustainability. Keep responses under 150 words.';

    const contents = [];
    
    if (history && Array.isArray(history)) {
      for (const msg of history) {
        contents.push({
          role: msg.role === 'ai' ? 'model' : 'user',
          parts: [{ text: msg.content }]
        });
      }
    }

    contents.push({
      role: 'user',
      parts: [{ text: message }]
    });

    const body = {
      systemInstruction: {
        parts: [{ text: systemPrompt }]
      },
      contents: contents,
    };

    let aiResponseText = '';

    if (GEMINI_API_KEY) {
      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      );

      const geminiJson = await geminiRes.json();
      aiResponseText = geminiJson.candidates?.[0]?.content?.parts?.[0]?.text;
    }

    if (!aiResponseText) {
      throw new Error('No response from AI');
    }

    return new Response(JSON.stringify({ response: aiResponseText }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
});
