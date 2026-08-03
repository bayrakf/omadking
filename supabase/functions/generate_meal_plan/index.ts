import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

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
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get Auth User if auth token header present
    const authHeader = req.headers.get('Authorization');
    let userId: string | null = null;
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) userId = user.id;
    }

    // Check Free Tier Limit (3 plans per week) if user logged in
    if (userId) {
      const { data: sub } = await supabase
        .from('subscriptions')
        .select('plan')
        .eq('user_id', userId)
        .single();

      if (sub?.plan === 'free') {
        const startOfWeek = new Date();
        startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
        const { count } = await supabase
          .from('meal_plans')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .gte('created_at', startOfWeek.toISOString());

        if (count && count >= 3) {
          return new Response(
            JSON.stringify({ error: 'LIMIT_REACHED', message: 'Free tier limit (3 plans/week) reached. Upgrade to Premium for unlimited plans.' }),
            { status: 402, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
          );
        }
      }
    }

    const {
      weight_kg = 75,
      height_cm = 175,
      age = 30,
      sex = 'male',
      fitness_level = 'intermediate',
      goal = 'performance',
      omad_window_start = '18:00',
      omad_window_hours = 1,
      sport_type = 'Running',
      duration_min = 60,
      intensity = 'medium',
      planned_start_time = '19:00',
    } = await req.json();

    // Harris-Benedict BMR
    let bmr = 10 * weight_kg + 6.25 * height_cm - 5 * age;
    bmr += sex === 'female' ? -161 : 5;

    const mult = fitness_level === 'advanced' ? 1.725 : fitness_level === 'intermediate' ? 1.55 : 1.375;
    let tdee = Math.round(bmr * mult);

    if (goal === 'weight_loss') tdee -= 400;
    if (goal === 'muscle_gain') tdee += 300;

    const protein_g = Math.round(weight_kg * (goal === 'muscle_gain' ? 2.2 : 2.0));
    const fat_g = Math.round((tdee * 0.25) / 9);
    const carbs_g = Math.round((tdee - (protein_g * 4 + fat_g * 9)) / 4);

    const prompt = `You are a sports nutritionist. Output ONLY valid JSON, no markdown formatting.

Create an OMAD meal plan & recipe for:
- Body: ${weight_kg}kg, ${height_cm}cm, ${age}y, ${sex}
- Goal: ${goal}, Target TDEE: ${tdee} kcal (${protein_g}g Protein, ${carbs_g}g Carbs, ${fat_g}g Fat)
- Fasting window: ${omad_window_start} (${omad_window_hours}h)
- Workout: ${sport_type}, ${duration_min}min, ${intensity} intensity at ${planned_start_time}

Structure:
{
  "eating_window_start": "${omad_window_start}",
  "eating_window_end": "19:00",
  "total_kcal": ${tdee},
  "protein_g": ${protein_g},
  "carbs_g": ${carbs_g},
  "fat_g": ${fat_g},
  "pre_training_snack_time": null,
  "main_meal_time": "${omad_window_start}",
  "ai_reasoning": "High-protein meal structured post-workout to maximize muscle recovery.",
  "recipe": {
    "title": "High-Protein Recovery Bowl",
    "ingredients": ["300g Chicken/Tofu", "250g Rice/Sweet Potato", "150g Mixed Veggies", "1 tbsp Olive Oil"],
    "instructions": "Cook protein and carbs. Serve hot.",
    "reheat_instructions": "Reheat 3 mins at 800W.",
    "prep_time_min": 25,
    "is_meal_prep": true
  }
}`;

    let planData: any = null;

    if (GEMINI_API_KEY) {
      try {
        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { responseMimeType: 'application/json' },
            }),
          }
        );

        const geminiJson = await geminiRes.json();
        const rawText = geminiJson.candidates?.[0]?.content?.parts?.[0]?.text;
        if (rawText) {
          planData = JSON.parse(rawText.replace(/```json|```/g, '').trim());
        }
      } catch (e) {
        console.error('Gemini API call failed, using fallback', e);
      }
    }

    if (!planData) {
      planData = {
        eating_window_start: omad_window_start,
        eating_window_end: '19:00',
        total_kcal: tdee,
        protein_g,
        carbs_g,
        fat_g,
        pre_training_snack_time: null,
        main_meal_time: omad_window_start,
        ai_reasoning: `Optimized high-protein OMAD meal scheduled around your ${sport_type} session to maximize muscle protein synthesis and recovery.`,
        recipe: {
          title: `${sport_type} Performance Recovery Bowl`,
          ingredients: [
            `${Math.round(weight_kg * 3.5)}g Grilled Chicken Breast or Tofu`,
            '300g Roasted Sweet Potatoes',
            '150g Steamed Broccoli & Carrots',
            '1 tbsp Extra Virgin Olive Oil',
          ],
          instructions: 'Season protein and roast sweet potatoes at 200°C for 25 mins. Combine and serve with steamed veggies.',
          reheat_instructions: 'Microwave 2.5 mins at 800W or reheat in skillet with 1 tsp water.',
          prep_time_min: 25,
          is_meal_prep: true,
        },
      };
    }

    // Save to DB if authenticated
    if (userId && planData) {
      const { data: mealPlan } = await supabase
        .from('meal_plans')
        .insert({
          user_id: userId,
          date: new Date().toISOString().split('T')[0],
          eating_window_start: planData.eating_window_start,
          eating_window_end: planData.eating_window_end,
          total_kcal: planData.total_kcal,
          protein_g: planData.protein_g,
          carbs_g: planData.carbs_g,
          fat_g: planData.fat_g,
          pre_training_snack_time: planData.pre_training_snack_time,
          main_meal_time: planData.main_meal_time,
          ai_reasoning: planData.ai_reasoning,
        })
        .select()
        .single();

      if (mealPlan && planData.recipe) {
        await supabase.from('recipes').insert({
          meal_plan_id: mealPlan.id,
          title: planData.recipe.title,
          ingredients: planData.recipe.ingredients,
          instructions: planData.recipe.instructions,
          reheat_instructions: planData.recipe.reheat_instructions,
          prep_time_min: planData.recipe.prep_time_min,
          macros: {
            kcal: planData.total_kcal,
            protein: planData.protein_g,
            carbs: planData.carbs_g,
            fat: planData.fat_g,
          },
          is_meal_prep: planData.recipe.is_meal_prep ?? true,
        });
      }
    }

    return new Response(JSON.stringify(planData), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
});
