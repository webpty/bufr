-- The allow-list. Nobody signs in to the page who is not here, and nobody is
-- added from the page: a row goes in by hand, with David's approval.
CREATE TABLE users (
  id               TEXT PRIMARY KEY,
  -- Identity, and where sign-in codes go. Shown in settings, never editable.
  email            TEXT NOT NULL UNIQUE,
  name             TEXT NOT NULL DEFAULT '',
  role             TEXT NOT NULL DEFAULT 'member',   -- 'owner' | 'member'
  -- The R2 key of their photo, under media/avatars/. Null: initials instead.
  photo_key        TEXT,
  country          TEXT,
  language         TEXT,
  -- Without this a default cannot be told from a choice, and the browser's
  -- language would override something the person picked.
  language_chosen  INTEGER NOT NULL DEFAULT 0,
  date_order       TEXT NOT NULL DEFAULT 'dmmmy',    -- 'dmmmy' | 'dmy' | 'mdy' | 'ymd'
  clock_24h        INTEGER NOT NULL DEFAULT 1,
  time_zone        TEXT NOT NULL DEFAULT 'America/Panama',
  created_at       TEXT NOT NULL
);
