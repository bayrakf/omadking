# Graph Report - NeueIdee  (2026-08-08)

## Corpus Check
- 60 files · ~198,787 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 379 nodes · 990 edges · 13 communities detected
- Extraction: 85% EXTRACTED · 15% INFERRED · 0% AMBIGUOUS · INFERRED: 149 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 16|Community 16]]

## God Nodes (most connected - your core abstractions)
1. `demo()` - 22 edges
2. `todayISO()` - 21 edges
3. `normalizeProfile()` - 20 edges
4. `useTheme()` - 17 edges
5. `demo()` - 17 edges
6. `writeJSON()` - 17 edges
7. `dailyTargets()` - 15 edges
8. `parseISO()` - 14 edges
9. `demo()` - 13 edges
10. `Enter()` - 12 edges

## Surprising Connections (you probably didn't know these)
- `tick()` --calls--> `fastingState()`  [INFERRED]
  src/app/(tabs)/index.tsx → src/lib/nutrition.ts
- `runSync()` --calls--> `syncNow()`  [INFERRED]
  src/app/(tabs)/profile.tsx → src/lib/sync.ts
- `doExport()` --calls--> `exportBackup()`  [INFERRED]
  src/app/(tabs)/profile.tsx → src/lib/backup.ts
- `finish()` --calls--> `completeOnboarding()`  [INFERRED]
  src/app/onboarding.tsx → src/lib/store.ts
- `addWater()` --calls--> `saveHydration()`  [INFERRED]
  src/app/(tabs)/index.tsx → src/lib/store.ts

## Communities (25 total, 1 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.09
Nodes (55): consistency(), currentStreak(), demo(), todayISO(), weekKey(), intakeQuestionFor(), formatCountdown(), completeOnboarding() (+47 more)

### Community 1 - "Community 1"
Cohesion: 0.12
Nodes (50): parseISO(), costOfExtra(), cycleWeek(), daysAheadThisWeek(), daysBetween(), deficitSpell(), demo(), effectiveMaintenance() (+42 more)

### Community 2 - "Community 2"
Cohesion: 0.12
Nodes (31): adopt(), currentUserId(), ensureAccount(), fromHex(), recoveryPhrase(), signOutAndForget(), supabase(), toHex() (+23 more)

### Community 3 - "Community 3"
Cohesion: 0.1
Nodes (23): backupFilename(), pickBackup(), saveBackup(), saveBackup(), announceMeasurement(), bodyFor(), ensureChannel(), ensurePermission() (+15 more)

### Community 4 - "Community 4"
Cohesion: 0.14
Nodes (28): blocked(), finish(), numOk(), savedProfile(), bmr(), breakFastSteps(), dailyTargets(), demo() (+20 more)

### Community 5 - "Community 5"
Cohesion: 0.11
Nodes (15): Enter(), useTheme(), demo(), isDraft(), leavesDevice(), missingOperatorFields(), recipients(), demo() (+7 more)

### Community 6 - "Community 6"
Cohesion: 0.17
Nodes (14): buildGroceryList(), categorise(), coreOf(), dedupeKey(), demo(), formatAmount(), isPrep(), parseAmount() (+6 more)

### Community 7 - "Community 7"
Cohesion: 0.19
Nodes (17): send(), toBottom(), wipe(), askCoach(), conversationOf(), demo(), describeQuotaError(), describeRecipeFallback() (+9 more)

### Community 8 - "Community 8"
Cohesion: 0.46
Nodes (10): body(), bodyIn(), chromePath(), closedWindowProfile(), createReporter(), has(), launch(), newPage() (+2 more)

### Community 9 - "Community 9"
Cohesion: 0.37
Nodes (8): getOfferings(), getPurchases(), hasEntitlement(), isBillingAvailable(), purchase(), restore(), syncEntitlement(), setPremium()

### Community 10 - "Community 10"
Cohesion: 0.27
Nodes (9): at(), mod(), useReducedMotion(), cookLead(), dayAgenda(), demo(), minutesUntil(), mod() (+1 more)

### Community 16 - "Community 16"
Cohesion: 0.83
Nodes (3): demo(), gatesUsed(), overpromises()

## Knowledge Gaps
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useTheme()` connect `Community 5` to `Community 0`, `Community 1`, `Community 2`, `Community 3`, `Community 4`, `Community 6`, `Community 7`, `Community 9`, `Community 10`?**
  _High betweenness centrality (0.148) - this node is a cross-community bridge._
- **Why does `Enter()` connect `Community 5` to `Community 0`, `Community 1`, `Community 2`, `Community 3`, `Community 6`, `Community 9`, `Community 10`?**
  _High betweenness centrality (0.085) - this node is a cross-community bridge._
- **Why does `normalizeProfile()` connect `Community 4` to `Community 0`, `Community 2`, `Community 3`, `Community 7`?**
  _High betweenness centrality (0.055) - this node is a cross-community bridge._
- **Are the 14 inferred relationships involving `todayISO()` (e.g. with `doAction()` and `logWeight()`) actually correct?**
  _`todayISO()` has 14 INFERRED edges - model-reasoned connections that need verification._
- **Are the 8 inferred relationships involving `normalizeProfile()` (e.g. with `savedProfile()` and `commitAvoid()`) actually correct?**
  _`normalizeProfile()` has 8 INFERRED edges - model-reasoned connections that need verification._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.09 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.12 - nodes in this community are weakly interconnected._