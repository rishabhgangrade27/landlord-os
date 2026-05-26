-- ============================================================
-- LandlordOS — MASTER SQL FIX FILE
-- Run each numbered section ONE AT A TIME in Supabase SQL Editor.
-- Read every comment before running. Do not skip steps.
-- Last updated: May 26, 2026
-- ============================================================


-- ══════════════════════════════════════════════════════════
-- STEP 1 — DROP BROKEN TRIGGERS
-- The "record new has no field updated_at" error comes from
-- triggers that fire on tenant/lease edits.
-- Run this first — it unblocks all tenant editing.
-- ══════════════════════════════════════════════════════════

-- updated_at triggers on tenants
DROP TRIGGER IF EXISTS update_tenants_updated_at   ON tenants;
DROP TRIGGER IF EXISTS tenants_updated_at           ON tenants;
DROP TRIGGER IF EXISTS set_tenants_updated_at       ON tenants;
DROP TRIGGER IF EXISTS trigger_tenants_updated_at   ON tenants;
DROP TRIGGER IF EXISTS moddatetime                  ON tenants;

-- updated_at triggers on leases
DROP TRIGGER IF EXISTS update_leases_updated_at    ON leases;
DROP TRIGGER IF EXISTS leases_updated_at            ON leases;
DROP TRIGGER IF EXISTS set_leases_updated_at        ON leases;
DROP TRIGGER IF EXISTS moddatetime                  ON leases;

-- updated_at triggers on units / properties
DROP TRIGGER IF EXISTS update_units_updated_at      ON units;
DROP TRIGGER IF EXISTS update_properties_updated_at ON properties;

-- lease restriction triggers (moving restrictions to frontend)
DROP TRIGGER IF EXISTS block_lease_delete           ON leases;
DROP TRIGGER IF EXISTS prevent_lease_delete         ON leases;
DROP TRIGGER IF EXISTS block_overlapping_leases     ON leases;
DROP TRIGGER IF EXISTS prevent_overlapping_leases   ON leases;

-- drop backing functions
DROP FUNCTION IF EXISTS moddatetime()               CASCADE;
DROP FUNCTION IF EXISTS set_updated_at()            CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column()  CASCADE;
DROP FUNCTION IF EXISTS prevent_lease_delete()      CASCADE;
DROP FUNCTION IF EXISTS prevent_overlapping_leases() CASCADE;

-- ✅ VERIFY — should return 0 rows for the dropped triggers
SELECT trigger_name, event_object_table
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND trigger_name ILIKE '%updated_at%'
   OR trigger_name ILIKE '%lease_delete%'
   OR trigger_name ILIKE '%overlapping%';


-- ══════════════════════════════════════════════════════════
-- STEP 2 — DELETE THE WRONG $29,000 LEASE (Abdullah Ali)
-- Sonu accidentally created a lease with $29,000 monthly rent.
-- This step deletes it. Run ONLY after Step 1.
-- ══════════════════════════════════════════════════════════

-- 2a: Verify the wrong lease exists first
SELECT l.id, l.rent_amount, l.start_date, l.end_date, l.status, t.name
FROM leases l
JOIN tenants t ON t.id = l.tenant_id
WHERE l.rent_amount = 29000;
-- Should show 1 row for Abdullah Ali. If 0 rows → already deleted, skip 2b.

-- 2b: Delete it (run only after confirming the row above)
DELETE FROM leases
WHERE rent_amount = 29000
  AND tenant_id = (SELECT id FROM tenants WHERE name = 'Abdullah Ali');

-- 2c: Verify — should show remaining leases for Abdullah Ali (no $29,000 row)
SELECT l.id, l.rent_amount, l.start_date, l.end_date, l.status
FROM leases l
JOIN tenants t ON t.id = l.tenant_id
WHERE t.name = 'Abdullah Ali'
ORDER BY l.start_date;


-- ══════════════════════════════════════════════════════════
-- STEP 3 — CREATE CORRECT NEW LEASE FOR ABDULLAH ALI
-- His real lease ($2,555/mo) expired April 30, 2026.
-- This creates the renewal for May 2026 → April 2027.
-- Run AFTER Step 2.
-- Alternative: Use the "Renew Lease" button in the UI on his property page.
-- ══════════════════════════════════════════════════════════

-- 3a: First mark his expired lease as expired (safety check)
UPDATE leases SET status = 'expired'
WHERE tenant_id = (SELECT id FROM tenants WHERE name = 'Abdullah Ali')
  AND status = 'active';

-- 3b: Verify no active leases remain for him before creating new one
SELECT id, rent_amount, start_date, end_date, status
FROM leases
WHERE tenant_id = (SELECT id FROM tenants WHERE name = 'Abdullah Ali')
ORDER BY start_date;

-- 3c: Create the new correct lease
-- NOTE: Update rent_amount if Sonu agreed on a different amount for 2026
INSERT INTO leases (tenant_id, property_id, unit_id, start_date, end_date, rent_amount, status, notes)
SELECT
  t.id,
  p.id,
  p.id,                          -- unit_id = property_id (properties table = units here)
  '2026-05-01',
  '2027-04-30',
  2555,                          -- ← UPDATE if rent changed for renewal
  'active',
  'Renewal — May 2026 to Apr 2027'
FROM tenants t, properties p
WHERE t.name = 'Abdullah Ali'
  AND (p.nickname ILIKE '%1Right%' OR p.nickname ILIKE '%1R%')
LIMIT 1;

-- 3d: Mark property as Occupied
UPDATE properties SET status = 'Occupied'
WHERE nickname ILIKE '%1R%' OR nickname ILIKE '%1Right%';

-- 3e: Ensure tenant is active
UPDATE tenants SET status = 'active' WHERE name = 'Abdullah Ali';

-- 3f: Final verify — should show 1 active lease at $2,555
SELECT l.id, l.start_date, l.end_date, l.rent_amount, l.status, t.name
FROM leases l
JOIN tenants t ON t.id = l.tenant_id
WHERE t.name = 'Abdullah Ali'
ORDER BY l.start_date;


-- ══════════════════════════════════════════════════════════
-- STEP 4 — UPDATE CASE NUMBERS WITH LEADING ZEROS
-- HRA checks print case numbers with leading zeros.
-- The system must match exactly for AI extraction to work.
-- Run ONLY if case numbers in the DB don't have leading zeros.
-- ══════════════════════════════════════════════════════════

-- 4a: Check current case numbers
SELECT name, case_number FROM tenants ORDER BY name;

-- 4b: Update (run only if case numbers are missing the leading zeros)
/*
UPDATE tenants SET case_number = '00038482672D-01' WHERE name = 'Jean Walston';
UPDATE tenants SET case_number = '00038084283B-01' WHERE name = 'Chameka Flemister';
UPDATE tenants SET case_number = '00037797070C-01' WHERE name = 'Abdullah Ali';
UPDATE tenants SET case_number = '00030297467A-01' WHERE name = 'Angel Deonarine';
UPDATE tenants SET case_number = '00039123669C-01' WHERE name = 'Marrushka Morissaint';
-- Shannick Feliciano: case_number = '8877773F' — verify format from an actual check before updating
*/


-- ══════════════════════════════════════════════════════════
-- STEP 5 — BALANCE DIAGNOSTIC (informational only, no changes)
-- Run this anytime to see current balance per active tenant.
-- HIGH balances ($50K+) are EXPECTED until HRA receipts are
-- uploaded via /upload and processed by n8n.
-- ══════════════════════════════════════════════════════════

SELECT
  t.name,
  l.start_date,
  l.rent_amount,
  l.status                        AS lease_status,
  SUM(vrl.due_amount)             AS total_due,
  SUM(vrl.paid_amount)            AS total_paid,
  MAX(vrl.pending_balance)        AS current_balance
FROM tenants t
JOIN leases l ON l.tenant_id = t.id
LEFT JOIN view_rent_ledger vrl
  ON vrl.tenant_id = t.id AND vrl.lease_id = l.id
WHERE l.status = 'active'
GROUP BY t.name, l.start_date, l.rent_amount, l.status
ORDER BY t.name;

-- If total_paid = 0 for everyone → receipts not uploaded yet.
-- Upload PDFs via /upload, wait for n8n to process, then re-check here.


-- ══════════════════════════════════════════════════════════
-- STEP 6 — VERIFY ALL PROPERTIES (quick sanity check)
-- ══════════════════════════════════════════════════════════

SELECT id, nickname, address, city, state, status
FROM properties
ORDER BY nickname;

SELECT
  t.name,
  t.case_number,
  t.status                        AS tenant_status,
  l.rent_amount,
  l.start_date,
  l.end_date,
  l.status                        AS lease_status,
  p.nickname                      AS unit
FROM tenants t
LEFT JOIN leases l ON l.tenant_id = t.id AND l.status = 'active'
LEFT JOIN properties p ON p.id = l.property_id
ORDER BY t.name;
