-- ============================================================
-- LandlordOS — Drop Problematic Triggers
-- Run this FIRST in Supabase SQL Editor before anything else.
-- These triggers were blocking tenant edits, lease deletes,
-- and direct DB fixes. Restrictions move to the frontend.
-- ============================================================

-- ──────────────────────────────────────────────────────────
-- PART 1: Drop all updated_at timestamp triggers
-- These fire on INSERT/UPDATE and reference updated_at columns
-- that were dropped by cleanup.sql — causing the
-- "record new has no field updated_at" error.
-- ──────────────────────────────────────────────────────────

-- On tenants
DROP TRIGGER IF EXISTS update_tenants_updated_at   ON tenants;
DROP TRIGGER IF EXISTS tenants_updated_at           ON tenants;
DROP TRIGGER IF EXISTS set_tenants_updated_at       ON tenants;
DROP TRIGGER IF EXISTS trigger_tenants_updated_at   ON tenants;
DROP TRIGGER IF EXISTS moddatetime                  ON tenants;

-- On leases
DROP TRIGGER IF EXISTS update_leases_updated_at    ON leases;
DROP TRIGGER IF EXISTS leases_updated_at            ON leases;
DROP TRIGGER IF EXISTS set_leases_updated_at        ON leases;
DROP TRIGGER IF EXISTS moddatetime                  ON leases;

-- On units
DROP TRIGGER IF EXISTS update_units_updated_at     ON units;
DROP TRIGGER IF EXISTS units_updated_at             ON units;
DROP TRIGGER IF EXISTS set_units_updated_at         ON units;
DROP TRIGGER IF EXISTS moddatetime                  ON units;

-- On properties
DROP TRIGGER IF EXISTS update_properties_updated_at ON properties;
DROP TRIGGER IF EXISTS properties_updated_at         ON properties;
DROP TRIGGER IF EXISTS set_properties_updated_at     ON properties;
DROP TRIGGER IF EXISTS moddatetime                   ON properties;

-- On maintenance_tickets
DROP TRIGGER IF EXISTS update_maintenance_tickets_updated_at ON maintenance_tickets;
DROP TRIGGER IF EXISTS maintenance_tickets_updated_at         ON maintenance_tickets;
DROP TRIGGER IF EXISTS moddatetime                            ON maintenance_tickets;

-- Drop the moddatetime function if it exists (used by the above triggers)
DROP FUNCTION IF EXISTS moddatetime() CASCADE;
DROP FUNCTION IF EXISTS set_updated_at() CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;


-- ──────────────────────────────────────────────────────────
-- PART 2: Drop lease-restriction triggers
-- These prevent deleting or overlapping leases.
-- Sonu needs to be able to fix mistakes directly in Supabase.
-- The frontend shows warnings — DB no longer blocks.
-- ──────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS block_lease_delete          ON leases;
DROP TRIGGER IF EXISTS prevent_lease_delete        ON leases;
DROP TRIGGER IF EXISTS block_overlapping_leases    ON leases;
DROP TRIGGER IF EXISTS prevent_overlapping_leases  ON leases;

-- Drop the functions backing them
DROP FUNCTION IF EXISTS prevent_lease_delete()         CASCADE;
DROP FUNCTION IF EXISTS prevent_overlapping_leases()   CASCADE;


-- ──────────────────────────────────────────────────────────
-- PART 3: KEEPING these (they protect permanent records)
-- ──────────────────────────────────────────────────────────
-- lock_case_number / prevent_case_number_change  → KEEP
--   (case number is a legal identifier — set once, never changes)
--
-- prevent_tenant_delete / block_tenant_delete    → KEEP
--   (tenant history is permanent for court purposes)
--
-- prevent_unit_delete / block_unit_delete        → KEEP
--   (units are physical spaces — never deleted)


-- ──────────────────────────────────────────────────────────
-- VERIFY — run this after the drops above
-- Should return 0 rows for the dropped triggers
-- ──────────────────────────────────────────────────────────

SELECT trigger_name, event_object_table, event_manipulation
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND trigger_name IN (
    'update_tenants_updated_at', 'tenants_updated_at', 'set_tenants_updated_at',
    'update_leases_updated_at',  'leases_updated_at',  'set_leases_updated_at',
    'block_lease_delete', 'prevent_lease_delete',
    'block_overlapping_leases', 'prevent_overlapping_leases'
  )
ORDER BY event_object_table, trigger_name;
-- Expected: 0 rows

-- ──────────────────────────────────────────────────────────
-- PART 4: Drop transactions table restriction triggers
-- lock_verified_rows: prevents editing verified transactions
-- set_verified_timestamp: sets timestamp on verify (broken)
-- Both block direct DB fixes — dropping them.
-- ──────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS lock_verified_rows      ON transactions;
DROP TRIGGER IF EXISTS set_verified_timestamp  ON transactions;

DROP FUNCTION IF EXISTS lock_verified_rows()      CASCADE;
DROP FUNCTION IF EXISTS set_verified_timestamp()  CASCADE;


-- Show what triggers remain (for review)
SELECT trigger_name, event_object_table
FROM information_schema.triggers
WHERE event_object_schema = 'public'
ORDER BY event_object_table, trigger_name;
