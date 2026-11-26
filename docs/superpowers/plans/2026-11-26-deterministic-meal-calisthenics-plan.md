# Deterministic Meal Planner, Energy-Loop, Calisthenics & AI Removal Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace AI meal planning and coach chat with a deterministic, energy-aware recipe engine (Standard vs. Premium), full Calisthenics/Bodyweight + set/rep tracking linked across Today/Plan/Energy, and updated static/E2E checks.

**Architecture:** Three pure TypeScript core modules (`nutrition.ts`, `workouts.ts`, `recipes.ts`) form a closed feedback loop with `energy.ts` and `store.ts`: logged workouts (`workout_log`) drive date-exact `intakeLog` targets and macro/hydration goals; `energy.ts` (`measuredMaintenance`, `readPlateau`, `deficitSpell`, `weekBudget`, `proteinAdherence`, `cycleWeek`) steers planner calorie modes and recipe scoring; curated templates scale to exact grams without network or LLM dependencies. Chat (`chat.tsx`, `askCoach`, Gemini edge functions) is removed completely.

**Tech Stack:** Expo 57 / React 19 / React Native 0.86 / Expo Router static web, TypeScript, AsyncStorage (`store.ts`), pure TS self-check runner (`scripts/check-logic.mjs`), Playwright E2E (`e2e/`).

**Spec:** `docs/superpowers/specs/2026-11-26-deterministic-meal-calisthenics-design.md`

## Global Constraints
- Strictly NO `gap`, `rowGap`, `columnGap` in React Native StyleSheets (RN Web 0.21 crash).
- Strictly NO raw hex/rgba surface literals in `src/app/**/*.tsx` (`scripts/check-logic.mjs` enforces `c.*` theme tokens / `washOf()`).
- All text inputs on web/mobile must render at `16px` (`global.css` + StyleSheet) to prevent iOS Safari auto-zoom.
- `dailyTargets(p, t, measured)` behavior and signature stay backwards-compatible so existing `nutrition.ts` / `energy.ts` checks stay green.
- Mobile-first native iOS/Android layout, no ALL-CAPS AI-slop headers, Sentence Case labels, German & English i18n parity.

## Review Focus
- Extreme `avoid` input (e.g. `"no meat, no fish, no dairy, no eggs, no gluten, no nuts"`) must still return an allergen-safe recipe cleanly without crashing or serving an excluded allergen.
- Very tight (`1h`) vs wide (`4h`) eating window and tiny/high kcal budgets (`1200` vs `4000 kcal`) must clamp fat/oil grams realistically (never `0g` or extreme oil/salt amounts) while keeping `grocery.ts` ingredient parsing valid.
- Budget-balance calorie adjustments (`weekBudget` / `readPlateau`) must respect `bmr(profile)` floor and preserve `protein_g` so deficits cut carbs/fat, not protein.
- Set/rep logs persisted in `workout_log` must survive app reloads, export/import backups (`backup.ts`), cloud merge (`sync-merge.ts`), and full deletion (`eraseEverything()`), and use valid `SPORT_IDS` when applied to Planner.
- `scripts/check-logic.mjs` must verify all pure modules, `offer.ts` gate sites (`premium_recipes` in `planner.tsx`), README edge functions (`delete_account` only), and no surface color literals.

---

### Task 1: Expand `nutrition.ts` (METs + Single-Source Date Target Helper)
**Files:**
- Modify: `src/lib/nutrition.ts`
- Test: `src/lib/nutrition.ts` `demo()` via `npm run check`

- [ ] Add `'calisthenics': 6.0` and `'hiit': 8.5` to `MET` in `src/lib/nutrition.ts` (auto-exported in `SPORT_IDS`).
- [ ] Add `LoggedTrainingLike` (`{ date: string; sport: string; durationMin?: number; duration_min?: number; intensity: Intensity; start_time?: string }`) and pure helper `trainingForDate(date, workouts, plans, fallbackStartTime)` + `targetForDate(profile, date, { workouts, plans, measuredMaintenance })` in `src/lib/nutrition.ts` so `Today`, `week/corrections.tsx`, and `Planner` resolve date-accurate calories/macros consistently.
- [ ] Add `adaptiveTarget(profile, baseTargets, opts: { plateauTarget?: number | null; budgetPerDayLeft?: number | null; maintenanceKcal?: number; mode?: 'standard' | 'plateau' | 'diet_break' | 'budget' })` that adjusts `kcal` (respecting `bmr(profile)` floor), keeps `protein_g` protected, and scales `carbs_g` / `fat_g` cleanly.
- [ ] Add `assert()` cases inside `nutrition.ts` `demo()` covering `calisthenics` burn > `rest`, `trainingForDate` priority (workout log overrides older plan), and `adaptiveTarget` `bmr` floor + protein preservation.

### Task 2: Create `src/lib/workouts.ts` & Extend `store.ts` / `sync-merge.ts` for Calisthenics & Rep Tracking
**Files:**
- Create: `src/lib/workouts.ts`
- Modify: `src/lib/store.ts`, `src/lib/sync-merge.ts`
- Test: `src/lib/workouts.ts` `demo()` + `sync-merge.ts` `demo()`

- [ ] Define `WorkoutCategory` (`'calisthenics' | 'strength' | 'hiit' | 'cardio' | 'mobility'`), `ExerciseSpec` (`id`, localized `name`, `targetSets`, `targetRepsMin`, `targetRepsMax`, `unit`, localized `notes`), `WorkoutProgram` (staged `exercisesByLevel?: Record<FitnessLevel, ExerciseSpec[]>`), `LoggedSet`, `LoggedExercise`, `WorkoutLogEntry` in `src/lib/workouts.ts`.
- [ ] Populate curated programs (`calisthenics-push`, `calisthenics-pull`, `calisthenics-full`, `calisthenics-hiit`, `gym-push`, `gym-pull`, `zone2-cardio`, `mobility-flow`) with clear `beginner` / `intermediate` / `advanced` calisthenics progressions (e.g. Incline Push-ups -> Dips -> Pike/Pseudo-Planche; Inverted Rows -> Pull-ups -> Archer/Explosive Pull-ups; Split Squats -> Bulgarian/Pistol-Prep -> Shrimp Squat/L-Sit).
- [ ] Implement pure helpers in `src/lib/workouts.ts`: `exercisesForLevel(program, level)`, `lastExerciseSets(exerciseId, log)`, `isProgressionReady(spec, latestSets)`, `formatSetsSummary(sets, unit)`.
- [ ] Implement `demo()` in `src/lib/workouts.ts` testing level progression differences, `lastExerciseSets`, `isProgressionReady` threshold, and `SPORT_IDS` validity of every program's `sport`.
- [ ] Update `src/lib/store.ts` (add `KEYS.workoutLog: 'workout_log'`, `loadWorkoutLog`, `saveWorkoutSession`, `todayWorkoutSession`, remove `chatLog` / `coachMemory` / `planQuota` / `FREE_PLANS_PER_WEEK` / `getQuota` / `consumeQuota`) and add `KEYS.workoutLog` union-by-`id` in `src/lib/sync-merge.ts` (removing `chatLog`).

### Task 3: Create `src/lib/recipes.ts` (Deterministic Tailored Recipe Engine) & Remove `ai.ts`
**Files:**
- Create: `src/lib/recipes.ts`
- Delete: `src/lib/ai.ts`, `src/lib/markdown.ts` (after verifying no remaining consumer outside `ui.tsx` `Md`)
- Modify: `src/components/ui.tsx` (remove unused `Md` if `markdown.ts` deleted)
- Test: `src/lib/recipes.ts` `demo()` via `npm run check`

- [ ] Export `Recipe`, `MealPlan`, `MealComplexity`, `RecipeTier`, `RecipeEnergyContext`, `DietaryTag`, `RecipeTemplate`, `STANDARD_TEMPLATES` (7 free recipes covering omnivore, fish, dairy-free/soy/plant, low-volume compact, high-volume cut), `PREMIUM_TEMPLATES` (20+ Chef, Post-Calisthenics Glycogen, Strict-1h-OMAD, Low-Carb Rest Day recipes) in `src/lib/recipes.ts`.
- [ ] Implement `parseAvoidTags(avoid: string)` + `templateMatchesAvoid(tpl, avoid)` covering DE/EN food groups & ingredient keywords.
- [ ] Implement `scaleTemplate(tpl, targets, lang)` solving protein grams -> carb grams -> fat grams (clamped for realistic cooking, rounded cleanly, `grocery.ts`-compatible formatted ingredient strings, DE/EN instructions + reheat guides).
- [ ] Implement `generateMealPlan(profile, training, lang, opts?)` supporting `measuredMaintenance`, `complexity`, `isPremium`, `historyTitles`, `excludeRecipeId`, and `energyContext` (`plateau`, `budgetMode`, `proteinAdherenceLow`, `dietBreak`), returning `MealPlan` (`recipe_source: 'standard' | 'premium'`, concise tailored `recipe_note` explaining why chosen/if allergen fallback expanded).
- [ ] Implement thorough `demo()` in `src/lib/recipes.ts` verifying: allergen exclusion (`no dairy, no fish, no chicken`), strict free vs. premium tier separation, rotation avoidance (`excludeRecipeId`), strict 1h window compact scoring, and `grocery.ts` compatibility on scaled output.

### Task 4: Remove AI Chat, Edge Functions & Align Offer / Privacy / Navigation
**Files:**
- Delete: `src/app/chat.tsx`, `supabase/functions/chat/index.ts`, `supabase/functions/generate_meal_plan/index.ts`
- Modify: `src/lib/offer.ts`, `src/app/paywall.tsx`, `src/lib/legal.ts`, `src/app/legal.tsx`, `src/app/you/data.tsx`, `src/app/_layout.tsx`, `src/lib/i18n.ts`, `README.md`
- Test: `npm run check` (`offer`, `legal`, `i18n`, deploy check)

- [ ] Remove `chat` route from `_layout.tsx` (add `workout` route if not implicitly matched cleanly) and delete `src/app/chat.tsx` + `supabase/functions/chat` + `supabase/functions/generate_meal_plan`.
- [ ] Update `src/lib/offer.ts` (`chat_context` & `plan_quota` replaced by `premium_recipes` in `src/app/(tabs)/planner.tsx`; update `PREMIUM_CLAIMS` & `FREE_CAPABILITIES`) and `src/app/paywall.tsx` (remove `FREE_PLANS_PER_WEEK` quota framing).
- [ ] Update `src/lib/legal.ts`, `src/app/legal.tsx`, `src/app/you/data.tsx`, and `README.md` (remove Gemini/Google transfer & chat history mentions; keep `delete_account` edge function).
- [ ] Update `src/lib/i18n.ts` maintaining 100% DE/EN key symmetry for new workout/calisthenics, rep-tracking, budget-mode, and standard/premium planner keys.

### Task 5: Wire Closed-Loop UI (`index.tsx`, `week/corrections.tsx`, `workout.tsx`, `planner.tsx`, `profile.tsx`, `RecipeCard.tsx`)
**Files:**
- Modify: `src/app/(tabs)/index.tsx`, `src/app/week/corrections.tsx`, `src/app/workout.tsx`, `src/app/(tabs)/planner.tsx`, `src/app/(tabs)/profile.tsx`, `src/components/RecipeCard.tsx`

- [ ] Update `src/app/(tabs)/index.tsx`: remove header Coach button (`router.push('/chat')`), add direct Workout/Calisthenics quick link to `/workout`, load `workoutLog` and use `targetForDate()` for `questionKcal` & `waterTarget`.
- [ ] Update `src/app/week/corrections.tsx`: load `workoutLog` & `planHistory` and use `targetForDate()` + `effectiveMaintenance` for per-day intake logging.
- [ ] Upgrade `src/app/workout.tsx`: mobile-first Calisthenics + Gym + HIIT + Cardio + Mobility screen with `profile.fitness_level` auto-staging (plus level switcher), per-exercise `"Last time: ..."` & set/rep `+`/`-` + `16px` logging, `"Save workout & reps"` (`saveWorkoutSession`), `"Progression ready"` pill, `deficitSpell` deload notice when `breakDue`, and `"Apply to Meal Plan"` with valid `SPORT_IDS`.
- [ ] Upgrade `src/app/(tabs)/planner.tsx` & `src/components/RecipeCard.tsx`:
  - Add **`Calisthenics`** sport chip + **"Workouts & Rep-Log"** quick link -> `/workout`; auto-load today's logged workout on focus.
  - Display live Energy context & clickable target mode switcher when `readPlateau`, `deficitSpell`, or `weekBudget` triggers (keeping default `dailyTargets` unless toggled or clearly labeled); indicate measured metabolism & protein adherence.
  - Replace AI quota banner + old `"Apply/Build"` AI call with instant local `generateMealPlan()` (Standard unlimited vs. Premium library lock on `chef` & Premium badge/swap prompt), add **"Other recipe"** (`Swap`) button, and upgrade `Week` tab to real `cycleWeek()` periodization + 1-tap weekly grocery prep!
- [ ] Update `src/app/(tabs)/profile.tsx` subscription card copy (remove `3 plans` cap copy).

### Task 6: Update Static Checks, E2E Suite & Run Full Verification
**Files:**
- Modify: `scripts/check-logic.mjs`, `e2e/smoke.mjs`, `e2e/interact.mjs`

- [ ] Update `scripts/check-logic.mjs`: swap `'ai'` (+ `'markdown'` if deleted) for `'recipes'` and `'workouts'`, replace `generate_meal_plan` edge prompt check with deterministic `recipes.ts` verification (`avoid`, `omad_window_hours`, tier isolation).
- [ ] Update `e2e/smoke.mjs` (`chat` -> `workout`) and `e2e/interact.mjs` (remove chat/Gemini/outage tests; add deterministic planner tests for rest vs. training kcal, `avoid` filtering, recipe swap, Standard vs. Premium gating, Energy budget/plateau mode, Privacy without Google, and Calisthenics + set/rep persistence across reloads).
- [ ] Run `npx tsc --noEmit && npm run check && EXPO_PUBLIC_SUPABASE_URL=https://mock.supabase.co EXPO_PUBLIC_SUPABASE_ANON_KEY=mock-key npm run e2e -- --build` -> verify 0 errors & 100% E2E pass.
- [ ] Verify mobile UI (`390×844` Dark & Light) on `Today`, `Plan`, and `/workout` via `agent-browser` + visual screenshot inspection, then commit & push to `origin main`.
