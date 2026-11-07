-- Consent audit trail (Cloudflare D1). One shared database can serve many sites:
-- each site's Worker writes its own SITE value into the site column.
-- Create once with:  npx wrangler d1 execute <database name> --remote --file=worker/schema.sql
-- Append-only: the Worker only ever inserts. Nothing here identifies a person:
-- consent_id is a random UUID held in the visitor's own consent cookie.
CREATE TABLE IF NOT EXISTS consent_log (
  site           TEXT    NOT NULL DEFAULT '', -- the site's domain, from the Worker's SITE var
  consent_id     TEXT    NOT NULL,            -- random UUID from the visitor's consent cookie
  created_at     TEXT    NOT NULL,            -- ISO 8601 UTC, set by the server
  action         TEXT    NOT NULL,            -- accept | reject | changed | withdrawn
  analytics      INTEGER NOT NULL,            -- 1 = analytics cookies allowed, 0 = not allowed
  categories     TEXT,                        -- optional categories switched on, e.g. "analytics,media"; empty = none; NULL = older banner
  policy_version TEXT    NOT NULL,            -- the version setting the visitor saw, e.g. v2
  page           TEXT    NOT NULL DEFAULT ''  -- page path where the choice was made
);
CREATE INDEX IF NOT EXISTS consent_log_site_id ON consent_log (site, consent_id);

-- MIGRATIONS for a database created by an earlier version. Run each once, on Staging first,
-- and BEFORE deploying the matching Worker code (old code keeps working after each step):
--   ALTER TABLE consent_log ADD COLUMN site TEXT NOT NULL DEFAULT 'pixel-north.co.uk';
--   CREATE INDEX IF NOT EXISTS consent_log_site_id ON consent_log (site, consent_id);
--   ALTER TABLE consent_log ADD COLUMN categories TEXT;   -- needed by Kit cookie control 4.x
