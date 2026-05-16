-- facts.db schema — OSC Phase 2 Day 6
-- Lightweight structured storage for semantic fact extraction

CREATE TABLE IF NOT EXISTS facts (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  subject      TEXT    NOT NULL,
  predicate    TEXT    NOT NULL,
  object       TEXT    NOT NULL,
  source       TEXT,                    -- file path or session key
  confidence   REAL    DEFAULT 1.0,   -- 0–1
  tags         TEXT,                    -- comma-separated tags
  ttl_hours    INTEGER,                 -- NULL = never expire
  created_at   TEXT    DEFAULT (datetime('now')),
  updated_at   TEXT    DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_facts_subject   ON facts(subject);
CREATE INDEX IF NOT EXISTS idx_facts_predicate ON facts(predicate);
CREATE INDEX IF NOT EXISTS idx_facts_created  ON facts(created_at);
CREATE INDEX IF NOT EXISTS idx_facts_ttl      ON facts(ttl_hours);