-- Signed-in browsers. The cookie carries a random id; only its HMAC is kept
-- here, so a copy of this table signs nobody in.
CREATE TABLE sessions (
  id_hash     TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  TEXT NOT NULL,
  created_at  TEXT NOT NULL
);

CREATE INDEX sessions_by_user ON sessions (user_id);
