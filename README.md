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
npm run typecheck   # tsc --noEmit
npm run check       # self-checks for the pure logic
npm run e2e         # the built web app driven in a real browser
```

`npm run check` compiles every module in `src/lib` and runs its `demo()`. Those modules are deliberately free of
React and AsyncStorage imports so they execute in plain node — no test framework needed. **Anything with a
branch, a formula or a parser belongs there**, and adding a module means adding it to the `MODULES` list in
`scripts/check-logic.mjs`.

`npm run e2e` builds the web bundle if it is stale, serves it, and drives it with `playwright-core` against the
system Chrome — no browser download. Two suites: `smoke` renders every route and fails on a blank screen, a
console error, or sideways overflow; `interact` walks the real flows. Point it at a deployed build with
`E2E_URL=https://… npm run e2e`.

A run ends in a single line, and every backlog item leaves its own regression check behind:

```
=== E2E GREEN — 141 checks ===
```

---

## Layout

```
src/
  lib/
    nutrition.ts   BMR, TDEE, training burn, macro split, fasting state and bands,
                   meal timing, protocols, breaking the fast                  ← pure, self-checked
    dates.ts       local-date helpers, ISO week keys, streak counting         ← pure, self-checked
    grocery.ts     ingredient parsing, merging, portion scaling, shop order   ← pure, self-checked
    agenda.ts      the day as ordered moments (timeline, prep loop, reminders)← pure, self-checked
    review.ts      the week read back, adaptation phase, correctable log      ← pure, self-checked
    markdown.ts    the small subset of markdown a chat model actually writes  ← pure, self-checked
    typography.ts  system font scale, clamped                                 ← pure, self-checked
    ai.ts          edge function calls, offline fallbacks, quota wording      ← pure, self-checked
    store.ts       every AsyncStorage read/write
    notify.ts      reminders          (notify.web.ts is a no-op — see below)
    purchases.ts   RevenueCat wrapper (purchases.web.ts is a no-op)
    backup-file.ts export/import      (backup-file.web.ts uses the browser)
  app/             expo-router screens
  components/      shared primitives (ui.tsx) and screen-sized pieces
e2e/               harness, smoke suite, interaction suite
supabase/
  functions/       Deno edge functions (chat, generate_meal_plan)
  migrations/      schema + row-level security
```

### Three rules worth keeping

**`nutrition.ts` is the only place numbers are calculated.** Before it existed, the dashboard, planner, profile
screen and edge function each had their own TDEE formula, so one user saw four different calorie targets. Screens
read from it; they never do arithmetic on profile fields themselves.

**Macros and timing are computed on the client; only recipe prose comes from the model.** The edge function
receives the already-decided targets and writes a recipe around them. A model outage therefore degrades the meal
*suggestion* (there's a deterministic offline recipe) and never the plan.

**Native-only modules get a `.web.ts` twin.** Metro resolves `.web.ts` first, so the web bundle never sees the
native package. This is not a preference: importing `react-native-purchases` unconditionally put ~900KB of dead
code into the web build and broke it at runtime. `npm run e2e` is followed by a bundle probe asserting zero
matches for `expo-notifications`, `expo-file-system`, `expo-sharing`, `expo-document-picker` and
`react-native-purchases`.

One more constraint that looks like a style choice and is not: **`gap`, `rowGap` and `columnGap` crash this
version of react-native-web.** Spacing is done with margins, including negative margins on containers to cancel a
trailing child gutter.

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
| `GEMINI_MODEL` | server, optional | defaults to `gemini-flash-latest`, an alias that tracks the current Flash model so a retirement cannot break the app |
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

Works today: onboarding with named fasting protocols, a fasting dial that says which band the fast is in, the day
as a timeline of moments, meal planning with AI recipes, batch cooking with portion scaling, a shopping list that
merges amounts and is ordered the way a shop is walked, weight tracking with trend, a correctable fast log, a
weekly review, an adaptation phase read from the log, hydration, an AI coach that renders its markdown, reminders,
local backup, an "About OMAD" reference page, and a free-tier quota.

Not built yet:

- **No accounts.** Everything lives in AsyncStorage on the device. Uninstalling loses the data, and nothing syncs
  between devices. The Supabase schema and RLS policies for this are already written in
  `supabase/migrations/001_initial_schema.sql` — the client side is what's missing.
- **Quota is device-local** as a result. The server-side check in `generate_meal_plan` is the authoritative one
  but only applies once callers are authenticated; today a determined user can clear storage to reset it.
- **In-app purchases need RevenueCat keys.** Without them the paywall says so rather than offering a purchase it
  cannot complete. Web has no billing at all.
- **No push notifications.** Reminders are local notifications scheduled on the device, so nothing arrives if the
  app is uninstalled and nothing is scheduled on the web at all. `device_tokens` exists in the schema for the
  server-sent version.
- **The Gemini free tier allows 20 requests a day.** Past that the coach and the recipe generator stop until the
  next day; the app now says which limit was hit rather than telling you to wait a minute.

## A note on the health content

The app describes what typically happens during a fast and what the approach does and does not do. It states no
figure it did not compute from the user's own data — no study percentages, success rates, user counts or
testimonials — and the wording rules are enforced by checks rather than left to judgement: every fasting-band and
adaptation note is asserted to contain no cure/prevent/detox/proven language, no disease terms, and no invented
statistic. The e2e suite repeats those assertions against the rendered screens, because the rule matters where
someone reads it.

Contraindications appear near the top of the "About OMAD" page, not at the end. That ordering is asserted too.

## Disclaimer

OMADCoach gives general nutrition and training guidance and is not medical advice. Extended fasting is not
appropriate for everyone — particularly during pregnancy, with diabetes or an eating-disorder history, or
alongside blood-pressure or blood-glucose medication.
