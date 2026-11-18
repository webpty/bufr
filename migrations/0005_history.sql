-- 0.3.0: the overview becomes figures and charts, kept for good.
--
-- When each fetched photo arrived at bufr.cc, so the time it waited for the
-- NAS can be worked out. Null for the photos fetched before 0.3.0.
ALTER TABLE fetched ADD COLUMN added TEXT;

CREATE INDEX fetched_added ON fetched (added);

-- Each photo received from Geotag, with how long the upload took as timed at
-- bufr.cc: from the request arriving to the photo being stored.
CREATE TABLE uploads (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  size     INTEGER NOT NULL,
  seconds  REAL,
  sender   TEXT NOT NULL,
  at       TEXT NOT NULL
);

CREATE INDEX uploads_at ON uploads (at);
