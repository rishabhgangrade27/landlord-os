-- ============================================================
-- LandlordOS — Data Population Script
-- Run in Supabase SQL Editor AFTER cleanup.sql has been run
-- ============================================================

-- ─── STEP 1: PROPERTIES ──────────────────────────────────────
-- One row per UNIT (unit_id = property_id pattern used throughout the system)
-- Fixed UUIDs used so leases & tenants can reference them cleanly

INSERT INTO properties (id, name, address, city, state, zip, property_type, status, nickname) VALUES

  -- ── 8607 101st Street, Richmond Hill NY 11418 ─────────────
  ('00000000-0000-0000-0001-000000000001',
   '8607 101st St — Unit 1R',
   '8607 101st Street', 'Richmond Hill', 'NY', '11418',
   'residential', 'Occupied', '101st-1R'),

  ('00000000-0000-0000-0001-000000000002',
   '8607 101st St — Unit 1L',
   '8607 101st Street', 'Richmond Hill', 'NY', '11418',
   'residential', 'Vacant', '101st-1L'),

  ('00000000-0000-0000-0001-000000000003',
   '8607 101st St — Unit 2R',
   '8607 101st Street', 'Richmond Hill', 'NY', '11418',
   'residential', 'Occupied', '101st-2R'),

  ('00000000-0000-0000-0001-000000000004',
   '8607 101st St — Unit 2L',
   '8607 101st Street', 'Richmond Hill', 'NY', '11418',
   'residential', 'Occupied', '101st-2L'),

  -- ── 338 Beach 84th Street, Rockaway Beach NY 11693 ────────
  ('00000000-0000-0000-0002-000000000001',
   '338 Beach 84th St — Unit 1',
   '338 Beach 84th Street', 'Rockaway Beach', 'NY', '11693',
   'residential', 'Occupied', 'Beach84-1'),

  ('00000000-0000-0000-0002-000000000002',
   '338 Beach 84th St — Unit 2',
   '338 Beach 84th Street', 'Rockaway Beach', 'NY', '11693',
   'residential', 'Vacant', 'Beach84-2'),

  -- ── 465 Beach 43rd Street, Far Rockaway NY 11691 (SOLD) ───
  ('00000000-0000-0000-0003-000000000001',
   '465 Beach 43rd St',
   '465 Beach 43rd Street', 'Far Rockaway', 'NY', '11691',
   'residential', 'Sold', 'Beach43');


-- ─── STEP 2: TENANTS ─────────────────────────────────────────

INSERT INTO tenants (
  id, name, full_legal_name, case_number,
  address, status, unit_id, household_size
) VALUES

  -- Jean Walston — Unit 2L, 8607 101st St
  ('00000000-0000-0000-0010-000000000001',
   'Jean Walston',
   'Jean Walston',
   '38482672D-01',
   '8607 101st Street, Unit 2L, Richmond Hill, NY 11418',
   'active',
   '00000000-0000-0000-0001-000000000004',  -- property: 101st-2L
   null),

  -- Chameka Flemister — Unit 2R, 8607 101st St (eviction in process)
  ('00000000-0000-0000-0010-000000000002',
   'Chameka Flemister',
   'Chameka Flemister',
   '38084283B-01',
   '8607 101st Street, Unit 2R, Richmond Hill, NY 11418',
   'active',
   '00000000-0000-0000-0001-000000000003',  -- property: 101st-2R
   null),

  -- Abdullah S Ali — Unit 1R, 8607 101st St (lease expired, still occupying)
  ('00000000-0000-0000-0010-000000000003',
   'Abdullah Ali',
   'Abdullah S Ali',
   '37797070C-01',
   '8607 101st Street, Unit 1R, Richmond Hill, NY 11418',
   'active',
   '00000000-0000-0000-0001-000000000001',  -- property: 101st-1R
   null),

  -- Angel Deonarine — Unit 1, 338 Beach 84th St
  ('00000000-0000-0000-0010-000000000004',
   'Angel Deonarine',
   'Angel Deonarine',
   '30297467A-01',
   '338 Beach 84th Street, Unit 1, Rockaway Beach, NY 11693',
   'active',
   '00000000-0000-0000-0002-000000000001',  -- property: Beach84-1
   null),

  -- Marrushka S Morissaint — Unit 2, 338 Beach 84th St (moved out Feb 2026)
  ('00000000-0000-0000-0010-000000000005',
   'Marrushka Morissaint',
   'Marrushka S Morissaint',
   '39123669C-01',
   '338 Beach 84th Street, Unit 2, Rockaway Beach, NY 11693',
   'moved_out',
   '00000000-0000-0000-0002-000000000002',  -- property: Beach84-2
   null),

  -- Shannick Feliciano — 465 Beach 43rd St (property sold Feb 2024, historical)
  ('00000000-0000-0000-0010-000000000006',
   'Shannick Feliciano',
   'Shannick Feliciano',
   '8877773F',
   '465 Beach 43rd Street, Far Rockaway, NY 11691',
   'moved_out',
   '00000000-0000-0000-0003-000000000001',  -- property: Beach43
   6);  -- household: Shannick + 5 family members


-- ─── STEP 3: LEASES ──────────────────────────────────────────
-- Most recent / current lease per tenant only.
-- Historical leases (older periods) can be added later if needed
-- for full ledger accuracy.

INSERT INTO leases (
  id, tenant_id, property_id, unit_id,
  start_date, end_date, rent_amount, status, notes
) VALUES

  -- Jean Walston — active lease Jan 2025 → Dec 2026
  ('00000000-0000-0000-0020-000000000001',
   '00000000-0000-0000-0010-000000000001',  -- Jean Walston
   '00000000-0000-0000-0001-000000000004',  -- 101st-2L
   '00000000-0000-0000-0001-000000000004',
   '2025-01-01', '2026-12-31',
   2428.80, 'active', null),

  -- Chameka Flemister — active (eviction in process)
  ('00000000-0000-0000-0020-000000000002',
   '00000000-0000-0000-0010-000000000002',  -- Chameka Flemister
   '00000000-0000-0000-0001-000000000003',  -- 101st-2R
   '00000000-0000-0000-0001-000000000003',
   '2022-11-01', '2027-12-31',
   2217.00, 'active', 'Eviction in process'),

  -- Abdullah S Ali — expired April 2026 (renewal pending)
  ('00000000-0000-0000-0020-000000000003',
   '00000000-0000-0000-0010-000000000003',  -- Abdullah S Ali
   '00000000-0000-0000-0001-000000000001',  -- 101st-1R
   '00000000-0000-0000-0001-000000000001',
   '2023-05-01', '2026-04-30',
   2555.00, 'expired', 'Lease expired — renewal pending, new lease required'),

  -- Angel Deonarine — active July 2025 → June 2026
  ('00000000-0000-0000-0020-000000000004',
   '00000000-0000-0000-0010-000000000004',  -- Angel Deonarine
   '00000000-0000-0000-0002-000000000001',  -- Beach84-1
   '00000000-0000-0000-0002-000000000001',
   '2025-07-01', '2026-06-30',
   3644.00, 'active', null),

  -- Marrushka S Morissaint — ended Feb 2026
  ('00000000-0000-0000-0020-000000000005',
   '00000000-0000-0000-0010-000000000005',  -- Marrushka Morissaint
   '00000000-0000-0000-0002-000000000002',  -- Beach84-2
   '00000000-0000-0000-0002-000000000002',
   '2022-11-01', '2026-02-28',
   3214.00, 'expired', 'Tenant moved out February 2026'),

  -- Shannick Feliciano — historical, property sold Feb 2024
  ('00000000-0000-0000-0020-000000000006',
   '00000000-0000-0000-0010-000000000006',  -- Shannick Feliciano
   '00000000-0000-0000-0003-000000000001',  -- Beach43
   '00000000-0000-0000-0003-000000000001',
   '2018-01-01', '2024-02-29',
   1956.00, 'expired', 'Property sold February 2024 — historical record only');


-- ─── STEP 4: VERIFY ──────────────────────────────────────────

SELECT
  (SELECT COUNT(*) FROM properties) AS properties,
  (SELECT COUNT(*) FROM tenants)    AS tenants,
  (SELECT COUNT(*) FROM leases)     AS leases;
-- Expected: properties=7, tenants=6, leases=6

-- Quick sanity check — each active tenant should have an active lease:
SELECT
  t.name,
  t.case_number,
  t.status AS tenant_status,
  l.rent_amount,
  l.start_date,
  l.end_date,
  l.status AS lease_status,
  p.nickname AS property
FROM tenants t
LEFT JOIN leases l ON l.tenant_id = t.id
LEFT JOIN properties p ON p.id = t.unit_id
ORDER BY t.name;
