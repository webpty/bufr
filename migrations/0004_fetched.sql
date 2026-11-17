-- Each photo the NAS fetched and cleared, newest 200 kept: what the overview
-- lists and the fetching speed is worked out from.
CREATE TABLE fetched (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  path     TEXT NOT NULL,
  size     INTEGER NOT NULL,
  -- How long the NAS took to fetch it, as it reports. Null from a fetcher
  -- older than 0.2, which did not say.
  seconds  REAL,
  sender   TEXT NOT NULL,
  at       TEXT NOT NULL
);

CREATE INDEX fetched_at ON fetched (at);
