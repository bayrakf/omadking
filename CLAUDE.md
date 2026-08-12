# OMADCoach — working notes

Meal timing and macro planning for people doing One Meal A Day while training.
Expo (iOS / Android / web) + Supabase edge functions + Gemini.

`README.md` is the product and architecture reference. This file is the part that
is easy to violate without noticing.

## Commands

```bash
npm run check      # self-checks in the pure lib modules + static prose/code checks
npm run typecheck  # tsc --noEmit
npm run e2e        # builds the web bundle, serves it, drives real Chrome (357 checks)
```

**Do not read `npm run check` through `tail`.** Its failures print above the last
lines, so `| tail -2` shows two ✅ and hides a ❌. Run it plain, or `grep ❌`.
This has already produced one false "green" report.

## Constraints that break things

- **`gap`, `rowGap`, `columnGap` crash this react-native-web.** Space with margins,
  including the negative trailing margin on the container. Every new row or grid is
  where someone reaches for `gap`.
- **`Tap` applies its `style` to the view *inside* the `Pressable`.** A percentage
  width therefore measures against a Pressable that has already collapsed to its
  content. Put the width on a plain wrapping `View` and let `Tap` fill it.
- **Native-only modules need a `.web.ts` twin.** Metro resolves `.web.ts` first, and
  the e2e run ends with a bundle probe asserting the native packages are absent.
- **Accessibility labels and roles are a contract**, with the e2e suite and with a
  screen reader. `accessibilityRole="checkbox"` plus `accessibilityState` is what
  makes a strip cell announce as ticked. Changing a label is a behaviour change.

## Where logic lives

- **`src/lib/nutrition.ts` is the only place numbers are calculated.** Screens read
  from it; they never do arithmetic on profile fields.
- **Anything with a branch, a formula or a parser belongs in `src/lib`**, free of
  React and AsyncStorage so it runs in plain node, with a `demo()` of `assert`s, and
  listed in `MODULES` in `scripts/check-logic.mjs`.
- **Every fix leaves a check behind.** Pure logic → an assertion in that module's
  `demo()`. Impure code and screens → a static check in `check-logic.mjs`, in the
  style already there. Negative-test it: reintroduce the bug and watch it trip.
- **Static checks must find their subject, not name its path.** The erase-order check
  pinned `profile.tsx`; moving the handler broke the check rather than the rule, and
  it reported a missing function as an ordering failure.
- Macros and timing are computed on device. Only recipe prose comes from the model,
  so an outage degrades the suggestion and never the plan.

## Working rules

**A move is copy-then-adjust, never a rewrite from memory.** Moving cards between
screens in one session silently dropped a whole input field, two accessibility
labels, and the checkbox role on two strips. Copy the block verbatim, then change
only what has to change.

**Verify each commit on its own, not just the tip.** A branch whose tip is green can
still contain a commit that does not build.

```bash
git worktree add -q --detach /tmp/wt <sha>
ln -s "$PWD/node_modules" /tmp/wt/node_modules
cp expo-env.d.ts /tmp/wt/          # gitignored; without it tsc fails for an unrelated reason
(cd /tmp/wt && npx tsc --noEmit && node scripts/check-logic.mjs)
git worktree remove --force /tmp/wt
```

**Look at the screen.** Four real defects this session were invisible in the diff and
obvious in a screenshot: an unreadable "now" marker, a cryptic legend, two bars in the
same colour, and option labels wrapping over four lines. Build the web bundle, serve
`dist/`, drive it with `e2e/harness.mjs` (it already knows how to find Chrome and seed
storage).

**The e2e harness seeds localStorage once per context**, via a sentinel key. It used
to seed on every navigation, which silently reverted anything a test changed before it
navigated. If a flow spans two pages, that is why.

## Voice

The palette is an instrument panel: cold at rest, and **`ember` is rationed** to the
eating window, a meal being due, and the meal itself. It means something because it is
rare. Do not spend it on charts.

The app states no figure it did not compute from the user's own data — no study
percentages, no success rates, no testimonials. Wording rules are enforced by checks
rather than left to judgement. A gauge with no real numerator is decoration pretending
to be instrumentation; don't build one.

Commit messages are German, Conventional Commits prefix, ASCII transliteration
(`ae`/`oe`/`ue`). Subject says what changed; the body says why it was wrong before.
