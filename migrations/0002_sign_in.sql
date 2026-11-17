-- Sign-in codes: ten minutes each, three per address per ten minutes, and only
-- the newest one alive. The code itself is never kept, only its HMAC.
CREATE TABLE codes (
  id          TEXT PRIMARY KEY,
  email       TEXT NOT NULL,
  code_hash   TEXT NOT NULL,
  expires_at  TEXT NOT NULL,
  used_at     TEXT,
  created_at  TEXT NOT NULL
);

CREATE INDEX codes_by_email ON codes (email, created_at);

-- Wrong codes, counted: five for one address close it for a quarter of an
-- hour. Thrown away after a day.
CREATE TABLE sign_in_tries (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  email  TEXT NOT NULL,
  at     TEXT NOT NULL
);

CREATE INDEX sign_in_tries_email_at ON sign_in_tries (email, at);
