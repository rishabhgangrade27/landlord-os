-- ============================================================
-- LandlordOS — Full DB Cleanup Script
-- Run this in Supabase SQL Editor (one section at a time)
-- ============================================================

-- ─── SECTION 1: Create missing tables (before truncating) ───
-- Run this first. These tables are referenced by n8n workflows.

CREATE TABLE IF NOT EXISTS system_errors (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_name text,
  error_message text,
  error_data  jsonb,
  occurred_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS legal_history (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  notice_id    uuid        REFERENCES legal_notices(id) ON DELETE SET NULL,
  entity_type  text,
  entity_id    uuid,
  action       text        NOT NULL,
  notice_type  text,
  reference_id text,
  snapshot     jsonb,
  occurred_at  timestamptz DEFAULT now()
);


-- ─── SECTION 2: Wipe all data ───────────────────────────────
-- CASCADE handles FK dependencies automatically.
-- system_settings and legal_templates are intentionally excluded.

TRUNCATE TABLE
  legal_history,
  system_errors,
  legal_notices,
  transactions,
  maintenance_tickets,
  expenses,
  leases,
  tenants,
  contractors,
  units,
  properties
RESTART IDENTITY CASCADE;


-- ─── SECTION 3: Drop unused columns ─────────────────────────
-- Remove columns that are not used by the frontend or any n8n workflow.

-- leases: 4 unused cols
ALTER TABLE leases
  DROP COLUMN IF EXISTS renewal_flag,
  DROP COLUMN IF EXISTS created_by,
  DROP COLUMN IF EXISTS updated_by,
  DROP COLUMN IF EXISTS updated_at;

-- expenses: 1 unused col
ALTER TABLE expenses
  DROP COLUMN IF EXISTS linked_ticket_id;

-- legal_templates: 2 unused cols
ALTER TABLE legal_templates
  DROP COLUMN IF EXISTS placeholders,
  DROP COLUMN IF EXISTS jurisdiction;

-- units: 1 unused col
ALTER TABLE units
  DROP COLUMN IF EXISTS updated_at;

-- tenants: 1 unused col
ALTER TABLE tenants
  DROP COLUMN IF EXISTS updated_at;


-- ─── SECTION 4: Add missing columns to transactions ─────────
-- These are used by the frontend review panel and n8n WF1 but
-- were not in the original types.ts. Add them if they don't exist.

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS extracted_rent_from  date,
  ADD COLUMN IF NOT EXISTS extracted_rent_to    date,
  ADD COLUMN IF NOT EXISTS duplicate_reference_id uuid REFERENCES transactions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS review_notes         text,
  ADD COLUMN IF NOT EXISTS reviewed_by          text,
  ADD COLUMN IF NOT EXISTS reviewed_at          timestamptz,
  ADD COLUMN IF NOT EXISTS file_bucket          text,
  ADD COLUMN IF NOT EXISTS file_path            text;


-- ─── SECTION 5: Add missing columns to properties & tenants ──
-- These are used by the frontend but were not in types.ts.

ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS status   text DEFAULT 'Vacant',
  ADD COLUMN IF NOT EXISTS nickname text;

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS household_size integer;


-- ─── SECTION 6: Verify clean state ───────────────────────────
-- Run after all sections above to confirm everything is clean.

SELECT 'properties'       AS tbl, COUNT(*) FROM properties
UNION ALL
SELECT 'units'            AS tbl, COUNT(*) FROM units
UNION ALL
SELECT 'tenants'          AS tbl, COUNT(*) FROM tenants
UNION ALL
SELECT 'leases'           AS tbl, COUNT(*) FROM leases
UNION ALL
SELECT 'contractors'      AS tbl, COUNT(*) FROM contractors
UNION ALL
SELECT 'transactions'     AS tbl, COUNT(*) FROM transactions
UNION ALL
SELECT 'maintenance_tickets' AS tbl, COUNT(*) FROM maintenance_tickets
UNION ALL
SELECT 'expenses'         AS tbl, COUNT(*) FROM expenses
UNION ALL
SELECT 'legal_notices'    AS tbl, COUNT(*) FROM legal_notices
UNION ALL
SELECT 'legal_history'    AS tbl, COUNT(*) FROM legal_history
UNION ALL
SELECT 'system_errors'    AS tbl, COUNT(*) FROM system_errors
UNION ALL
SELECT 'system_settings'  AS tbl, COUNT(*) FROM system_settings
UNION ALL
SELECT 'legal_templates'  AS tbl, COUNT(*) FROM legal_templates;
-- Expected: all data tables show 0, system_settings shows 1, legal_templates shows > 0
