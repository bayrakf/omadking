-- Removes the trigger that created a plaintext profile row for every new user.
--
-- Two reasons, and either alone would be enough.
--
-- It is broken. Anonymous sign-in fails with "Database error creating
-- anonymous user" (HTTP 500) because this AFTER INSERT trigger runs on
-- auth.users and its inserts do not succeed, taking the whole sign-up down
-- with them. Nothing could create an account while it existed.
--
-- It is also the wrong design. The trigger's entire job was to seed the
-- plaintext tables — the ones holding weight, height, age and sex as ordinary
-- columns — and those are being replaced by a single encrypted blob the server
-- cannot read. Keeping the trigger would mean every future account
-- automatically got a readable row, which is exactly what this work exists to
-- prevent.
--
-- Deliberately drops nothing else. The tables themselves are removed in the
-- sync migration, once their contents have been confirmed empty from the
-- dashboard — that check cannot be done from here, because row-level security
-- hides the answer from an unauthenticated probe.

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user();
