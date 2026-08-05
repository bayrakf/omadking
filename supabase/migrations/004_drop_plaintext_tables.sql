-- Removes the plaintext tables from migration 001.
--
-- They hold weight, height, age, sex, goals, training sessions, meals and
-- recipes as ordinary readable columns. Nothing ever wrote to them — the
-- client side was never built, and the edge function's write path was removed
-- earlier — but leaving them in place means the next person to add a feature
-- finds a ready-made home for exactly the data this design exists not to keep.
-- Deleting them is the difference between "we do not store that" and "we
-- happen not to have stored that yet".
--
-- The guard below is the point of this file. Row-level security hides the
-- contents from an unauthenticated probe, so emptiness could not be confirmed
-- from outside. Rather than dropping on an assumption, this refuses loudly if
-- any table still holds a row. It is safe to run either way: it destroys data
-- only in the case where there is none.

DO $$
DECLARE
  n bigint;
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['profiles', 'trainings', 'meal_plans', 'recipes', 'subscriptions', 'device_tokens']
  LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      CONTINUE;
    END IF;
    EXECUTE format('SELECT count(*) FROM public.%I', t) INTO n;
    IF n > 0 THEN
      RAISE EXCEPTION
        'Refusing to drop: public.% still holds % row(s). Export it first, then re-run.', t, n;
    END IF;
  END LOOP;
END $$;

-- Children before parents, and without CASCADE on purpose: an unexpected
-- dependency should stop this migration rather than be quietly swept away.
DROP TABLE IF EXISTS recipes;
DROP TABLE IF EXISTS meal_plans;
DROP TABLE IF EXISTS trainings;
DROP TABLE IF EXISTS device_tokens;
DROP TABLE IF EXISTS subscriptions;
DROP TABLE IF EXISTS profiles;
