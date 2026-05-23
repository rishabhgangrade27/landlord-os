-- ====================================================================
-- UNIT_ID FK FIX — Drop FK constraints, populate unit_id from property_id
-- Also: fix view_yearly_payments to show tenant name (not UUID)
-- Run in Supabase SQL Editor, one block at a time.
-- ====================================================================


-- ====================================================================
-- BLOCK A: Find the FK constraint names on unit_id
-- ====================================================================
SELECT tc.constraint_name, tc.table_name, kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON kcu.constraint_name = tc.constraint_name
  AND kcu.constraint_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND kcu.column_name = 'unit_id';
-- Read the constraint_name values. Typically:
--   leases_unit_id_fkey    on leases
--   tenants_unit_id_fkey   on tenants
-- If different, replace the names below.


-- ====================================================================
-- BLOCK B: Drop the FK constraints
-- ====================================================================
ALTER TABLE leases  DROP CONSTRAINT IF EXISTS leases_unit_id_fkey;
ALTER TABLE tenants DROP CONSTRAINT IF EXISTS tenants_unit_id_fkey;

-- VERIFY — should return 0 rows:
SELECT tc.constraint_name, tc.table_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON kcu.constraint_name = tc.constraint_name
  AND kcu.constraint_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND kcu.column_name = 'unit_id';


-- ====================================================================
-- BLOCK C: Populate unit_id = property_id
-- No FK blocking this anymore.
-- ====================================================================

-- Leases: unit_id = property_id (same unit, different column name)
UPDATE leases
SET unit_id = property_id
WHERE unit_id IS NULL AND property_id IS NOT NULL;

-- Tenants with active lease: unit_id from that lease's property
UPDATE tenants t
SET unit_id = (
  SELECT l.property_id FROM leases l
  WHERE l.tenant_id = t.id
    AND l.status = 'active'::lease_status_enum
  ORDER BY l.start_date DESC LIMIT 1
)
WHERE t.unit_id IS NULL;

-- Remaining tenants (moved_out): use most recent lease's property
UPDATE tenants t
SET unit_id = (
  SELECT l.property_id FROM leases l
  WHERE l.tenant_id = t.id
  ORDER BY l.start_date DESC LIMIT 1
)
WHERE t.unit_id IS NULL;

-- VERIFY — all 6 tenants should have a unit name now:
SELECT t.name, t.status, p.nickname AS unit
FROM tenants t
LEFT JOIN properties p ON p.id = t.unit_id
ORDER BY t.name;

-- VERIFY — should return 0:
SELECT COUNT(*) FILTER (WHERE unit_id IS NULL) AS leases_missing_unit FROM leases;


-- ====================================================================
-- BLOCK D: Fix view_yearly_payments — add tenant_name
-- Currently shows tenant_id UUID. Useless for Sonu.
-- ====================================================================
CREATE OR REPLACE VIEW view_yearly_payments AS
SELECT
  vrl.tenant_id,
  t.name                                     AS tenant_name,
  t.full_legal_name,
  EXTRACT(year FROM month)                   AS year,
  SUM(vrl.due_amount)                        AS total_due,
  SUM(vrl.paid_amount)                       AS total_paid,
  SUM(vrl.due_amount) - SUM(vrl.paid_amount) AS total_balance
FROM view_rent_ledger vrl
LEFT JOIN tenants t ON t.id = vrl.tenant_id
GROUP BY vrl.tenant_id, t.name, t.full_legal_name, EXTRACT(year FROM month)
ORDER BY year DESC, tenant_name;

-- VERIFY:
SELECT tenant_name, year, total_due, total_paid, total_balance
FROM view_yearly_payments
LIMIT 10;
