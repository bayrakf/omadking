# OMADCoach

Meal timing and macro planning for people doing One Meal A Day while training hard — usually in the evening,
which is the part generic fasting apps get wrong.

Given your body stats, eating window and today's session, it works out:

- whether you eat **before**, **after**, or **split around** the workout, with actual clock times
- calorie and macro targets that scale with session **duration and intensity** (not a flat multiplier)
- a recipe that fits those macros, with reheat instructions for meal prep

Expo (iOS / Android / web) + Supabase edge functions + Gemini.

---

## Running it

```bash
npm install
cp .env.example .env.local   # fill in your Supabase project values
npx expo start
```

`npm run web` / `npm run ios` / `npm run android` for a specific platform.

## Checks

```bash
npm run check       # self-checks for the pure logic (macros, timing, streaks, grocery parsing)
npm run typecheck   # tsc --noEmit
```

`npm run check` compiles `src/lib/{nutrition,dates,grocery}.ts` and runs each module's `demo()`. Those modules
are deliberately free of React and AsyncStorage imports so they execute in plain node — no test framework
needed. Anything with a branch, a formula or a parser belongs there.

---

## Layout

```
src/
  lib/
    nutrition.ts   BMR, TDEE, training burn, macro split, fasting state, meal timing   ← pure, self-checked
    dates.ts       local-date helpers, ISO week keys, streak counting                  ← pure, self-checked
    grocery.ts     ingredient parsing, categorisation, recipe step splitting           ← pure, self-checked
    store.ts       every AsyncStorage read/write
    ai.ts          edge function calls + offline fallbacks
    purchases.ts   RevenueCat wrapper
  app/             expo-router screens
supabase/
  functions/       Deno edge functions (chat, generate_meal_plan)
  migrations/      schema + row-level security
```

### Two rules worth keeping

**`nutrition.ts` is the only place numbers are calculated.** Before it existed, the dashboard, planner, profile
screen and edge function each had their own TDEE formula, so one user saw four different calorie targets. Screens
read from it; they never do arithmetic on profile fields themselves.

**Macros and timing are computed on the client; only recipe prose comes from the model.** The edge function
receives the already-decided targets and writes a recipe around them. A model outage therefore degrades the meal
*suggestion* (there's a deterministic offline recipe) and never the plan.

---

## Configuration

Only `EXPO_PUBLIC_*` variables reach the client bundle. **Never put a secret behind that prefix** — it ships to
every user and is readable in devtools.

| Variable | Where | Purpose |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | client | edge function base URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | client | anon key (public by design; guarded by RLS) |
| `EXPO_PUBLIC_REVENUECAT_IOS_KEY` / `_ANDROID_KEY` | client | RevenueCat SDK keys (public) |
| `GEMINI_API_KEY` | **server** | `supabase secrets set GEMINI_API_KEY=…` |
| `SERVICE_ROLE_KEY` | **server** | `supabase secrets set SERVICE_ROLE_KEY=…` |

```bash
supabase functions deploy chat generate_meal_plan
supabase secrets set GEMINI_API_KEY=...
```

## Deploying

- **Web:** `npx expo export --platform web` → `dist/`. `vercel.json` already rewrites all paths to `index.html`
  (the app is a single-page build; without that rewrite every deep link 404s).
- **Native:** `npx eas build --platform all --profile preview`.

---

## Current state

Works today: onboarding, fasting timer, meal planning with AI recipes, grocery list, weight tracking with trend,
streaks, hydration, AI coach chat, free-tier quota.

Not built yet:

- **No accounts.** Everything lives in AsyncStorage on the device. Uninstalling loses the data, and nothing syncs
  between devices. The Supabase schema and RLS policies for this are already written in
  `supabase/migrations/001_initial_schema.sql` — the client side is what's missing.
- **Quota is device-local** as a result. The server-side check in `generate_meal_plan` is the authoritative one
  but only applies once callers are authenticated; today a determined user can clear storage to reset it.
- **In-app purchases need RevenueCat keys.** Without them the paywall says so rather than offering a purchase it
  cannot complete. Web has no billing at all.
- **No push notifications**, though `device_tokens` exists in the schema.

## Disclaimer

OMADCoach gives general nutrition and training guidance and is not medical advice. Extended fasting is not
appropriate for everyone — particularly during pregnancy, with diabetes or an eating-disorder history, or
alongside blood-pressure or blood-glucose medication.
