-- One opaque row per account. This is the whole server side of sync.
--
-- ciphertext and nonce are base64 text rather than bytea: PostgREST hands
-- bytea back as a hex-escaped string, and every conversion between that and
-- bytes is a place to introduce a bug in code whose entire job is to be
-- byte-exact. Text is equally unreadable to the server.
--
-- revision is optimistic concurrency. Two devices that both write from the
-- same starting point would otherwise silently overwrite one another, and the
-- one that lost would never know.
--
-- The plaintext tables from migration 001 are deliberately left alone. They are
-- unused, but confirming they are empty needs a look at the dashboard that
-- could not be done here — an unauthenticated probe returns [] under row-level
-- security whether or not there is data in them. Dropping a table on that
-- basis would be guessing.

CREATE TABLE IF NOT EXISTS sync_state (
  user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  ciphertext TEXT        NOT NULL,
  nonce      TEXT        NOT NULL,
  revision   BIGINT      NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE sync_state ENABLE ROW LEVEL SECURITY;

-- Four policies, all the same condition. A user reaches their own row and no
-- other; there is no shared read, no admin view, nothing to widen later by
-- accident.
CREATE POLICY sync_state_select ON sync_state
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY sync_state_insert ON sync_state
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY sync_state_update ON sync_state
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY sync_state_delete ON sync_state
  FOR DELETE USING (user_id = auth.uid());
