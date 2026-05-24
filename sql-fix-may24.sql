-- ============================================================
-- LandlordOS — SQL Fix (May 24, 2026)
-- Run each section ONE AT A TIME in Supabase SQL Editor.
-- Read each comment before running.
-- ============================================================

-- ──────────────────────────────────────────────────────────
-- FIX 1: Drop the trigger causing "record has no field updated_at"
-- This trigger fires on tenant updates and references updated_at
-- which no longer exists after cleanup.sql dropped it.
-- ──────────────────────────────────────────────────────────

-- Step 1a: Find all triggers on tenants table
SELECT trigger_name, event_manipulation, action_statement
FROM information_schema.triggers
WHERE event_object_table = 'tenants'
  AND event_object_schema = 'public';

-- Step 1b: Drop whichever trigger(s) reference updated_at
-- (replace trigger name with what you see from Step 1a)
DROP TRIGGER IF EXISTS update_tenants_updated_at ON tenants;
DROP TRIGGER IF EXISTS tenants_updated_at ON tenants;
DROP TRIGGER IF EXISTS set_tenants_updated_at ON tenants;
DROP TRIGGER IF EXISTS trigger_tenants_updated_at ON tenants;
DROP TRIGGER IF EXISTS moddatetime ON tenants;

-- Step 1c: Verify no triggers remain (should return 0 rows, or only ones you want)
SELECT trigger_name FROM information_schema.triggers
WHERE event_object_table = 'tenants' AND event_object_schema = 'public';


-- ──────────────────────────────────────────────────────────
-- FIX 2: Delete the wrong $29,000 lease for Abdullah Ali
-- Sonu accidentally created this — it has rent_amount = 29000
-- ──────────────────────────────────────────────────────────

-- Step 2a: Find it first (verify before deleting)
SELECT l.id, l.rent_amount, l.start_date, l.end_date, l.status, t.name
FROM leases l
JOIN tenants t ON t.id = l.tenant_id
WHERE l.rent_amount = 29000;

-- Step 2b: Delete it (only run after confirming the right record above)
DELETE FROM leases
WHERE rent_amount = 29000
  AND tenant_id = (SELECT id FROM tenants WHERE name = 'Abdullah Ali');

-- Step 2c: Verify Abdullah Ali's leases after delete — should show 2 rows only
SELECT l.id, l.rent_amount, l.start_date, l.end_date, l.status
FROM leases l
JOIN tenants t ON t.id = l.tenant_id
WHERE t.name = 'Abdullah Ali'
ORDER BY l.start_date;


-- ──────────────────────────────────────────────────────────
-- FIX 3: Abdullah Ali needs a new active lease
-- His last lease (rent $2,555) ended April 30, 2026.
-- Create a new lease for May 2026 onward.
-- ──────────────────────────────────────────────────────────

-- Step 3a: Get IDs needed
SELECT id FROM tenants WHERE name = 'Abdullah Ali';
SELECT id FROM properties WHERE nickname ILIKE '%Ali%' OR nickname ILIKE '%1Right%' OR nickname ILIKE '%1R%' LIMIT 5;

-- Step 3b: Insert new lease (update dates/rent to what Sonu wants)
-- Replace <tenant_uuid> and <property_uuid> with IDs from Step 3a
/*
INSERT INTO leases (tenant_id, property_id, unit_id, start_date, end_date, rent_amount, status, notes)
SELECT
  t.id,
  p.id,
  p.id,
  '2026-05-01',
  '2027-04-30',
  2555,       -- or updated rent amount
  'active',
  'Renewal — May 2026'
FROM tenants t, properties p
WHERE t.name = 'Abdullah Ali'
  AND p.nickname ILIKE '%1Right%';
*/

-- Step 3c: Mark any other active leases for Abdullah Ali as expired first
/*
UPDATE leases SET status = 'expired'
WHERE tenant_id = (SELECT id FROM tenants WHERE name = 'Abdullah Ali')
  AND status = 'active';
*/


-- ──────────────────────────────────────────────────────────
-- FIX 4: Case numbers — add leading zeros to match HRA checks
-- Only run if you have NOT already done this manually.
-- ──────────────────────────────────────────────────────────

-- Step 4a: Check current case numbers
SELECT name, case_number FROM tenants ORDER BY name;

-- Step 4b: Update with leading zeros (run only if still missing zeros)
/*
UPDATE tenants SET case_number = '00038482672D-01' WHERE name = 'Jean Walston';
UPDATE tenants SET case_number = '00038084283B-01' WHERE name = 'Chameka Flemister';
UPDATE tenants SET case_number = '00037797070C-01' WHERE name = 'Abdullah Ali';
UPDATE tenants SET case_number = '00030297467A-01' WHERE name = 'Angel Deonarine';
UPDATE tenants SET case_number = '00039123669C-01' WHERE name = 'Marrushka Morissaint';
-- Shannick Feliciano case# 8877773F — verify format from actual check
*/


-- ──────────────────────────────────────────────────────────
-- FIX 5: Verify property nicknames are set correctly
-- ──────────────────────────────────────────────────────────

SELECT id, nickname, name, address, city, state, status
FROM properties
ORDER BY nickname;
