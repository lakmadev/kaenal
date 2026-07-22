-- 0008_search_vectors.sql
--
-- Federated search (03 §1 `q` param, 04 command palette). Each searchable
-- entity gets a STORED generated `tsvector` + a GIN index, so `/v1/search` can
-- rank matches over code/title/description.
--
-- The spec says "tsvector column, updated by trigger"; a GENERATED column is the
-- stronger form of the same guarantee — Postgres recomputes it from the row on
-- every write, so it can never drift, needs no trigger to remember, and back-
-- fills existing rows on ALTER with no UPDATE (so it does not touch
-- `lock_version`). Weights: code A, title B, description C, for ranking.
-- `to_tsvector('english', …)` with a constant config is IMMUTABLE, as a
-- generated expression requires.

ALTER TABLE inspections ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(code, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(title, '')), 'B')
  ) STORED;
CREATE INDEX IF NOT EXISTS inspections_search_idx ON inspections USING gin (search_vector);

ALTER TABLE ncrs ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(code, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(title, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'C')
  ) STORED;
CREATE INDEX IF NOT EXISTS ncrs_search_idx ON ncrs USING gin (search_vector);

ALTER TABLE capas ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(code, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(title, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'C')
  ) STORED;
CREATE INDEX IF NOT EXISTS capas_search_idx ON capas USING gin (search_vector);

ALTER TABLE documents ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(code, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(title, '')), 'B')
  ) STORED;
CREATE INDEX IF NOT EXISTS documents_search_idx ON documents USING gin (search_vector);
