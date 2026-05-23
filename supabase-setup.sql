-- ============================================================
-- LandlordOS — Supabase Setup & Cleanup Script
-- Run sections in ORDER. Read each comment before running.
-- ============================================================

-- ──────────────────────────────────────────────────────────
-- SECTION 1: DIAGNOSTIC — Run these first to see current state
-- ──────────────────────────────────────────────────────────

SELECT COUNT(*) AS unit_count FROM units;
SELECT COUNT(*) AS tenant_count FROM tenants;
SELECT COUNT(*) AS lease_count FROM leases;
SELECT COUNT(*) AS transaction_count FROM transactions;
SELECT COUNT(matched_tenant_id) AS matched_transactions FROM transactions;
SELECT COUNT(*) AS utility_bills_count FROM utility_bills;
SELECT COUNT(*) AS vendors_count FROM vendors;
SELECT COUNT(*) AS history_transactions_count FROM history_transactions;
SELECT title, notice_type, is_active FROM legal_templates ORDER BY notice_type;

-- Check tenants and their unit links
SELECT id, name, case_number, unit_id, status FROM tenants ORDER BY name;

-- Check properties
SELECT id, name, nickname, address, status FROM properties ORDER BY nickname;


-- ──────────────────────────────────────────────────────────
-- SECTION 2: DB CLEANUP — Quick fixes
-- ──────────────────────────────────────────────────────────

-- 2a. Drop duplicate lease trigger (keep lease_updated_at, drop this one)
DROP TRIGGER IF EXISTS trigger_update_leases_updated_at ON leases;

-- Verify the right trigger still exists:
SELECT trigger_name FROM information_schema.triggers
WHERE event_object_table = 'leases' AND trigger_name = 'lease_updated_at';

-- 2b. Add unit_id to maintenance_tickets (if not already there)
ALTER TABLE maintenance_tickets
  ADD COLUMN IF NOT EXISTS unit_id UUID REFERENCES units(id);

-- 2c. Fix property_profit view to include profit column
-- (Check current definition first)
SELECT pg_get_viewdef('property_profit', true);

-- If profit column is missing, run:
-- CREATE OR REPLACE VIEW property_profit AS
-- SELECT
--   p.id AS property_id,
--   p.name AS property_name,
--   p.address,
--   COALESCE(SUM(CASE WHEN t.status = 'verified' THEN t.extracted_amount ELSE 0 END), 0) AS total_income,
--   COALESCE(SUM(e.amount), 0) AS total_expenses,
--   COALESCE(SUM(CASE WHEN t.status = 'verified' THEN t.extracted_amount ELSE 0 END), 0)
--     - COALESCE(SUM(e.amount), 0) AS profit
-- FROM properties p
-- LEFT JOIN units u ON u.property_id = p.id
-- LEFT JOIN transactions t ON t.matched_tenant_id IN (
--   SELECT tenant_id FROM leases WHERE unit_id = u.id
-- )
-- LEFT JOIN expenses e ON e.property_id = p.id
-- GROUP BY p.id, p.name, p.address;

-- 2d. Check and drop redundant tables
SELECT COUNT(*) FROM utility_bills;  -- if 0, drop it
SELECT COUNT(*) FROM vendors;         -- if 0, drop it

-- Drop if empty (only run after confirming 0 rows above):
-- DROP TABLE IF EXISTS utility_bills;
-- DROP TABLE IF EXISTS vendors;


-- ──────────────────────────────────────────────────────────
-- SECTION 3: INSERT LEGAL TEMPLATES (if missing from Section 1)
-- Run only if legal_templates is empty
-- ──────────────────────────────────────────────────────────

-- NOTE: Placeholders here match EXACTLY what Workflow 4 (Code — Fill Template node) fills.
-- Do NOT rename them — changing them breaks WF4 without a matching code update.
INSERT INTO legal_templates (title, notice_type, body, jurisdiction, is_active)
VALUES
(
  '30-Day Notice of Non-Payment',
  'non_payment_30day',
  'NOTICE OF NON-PAYMENT OF RENT — 30 DAYS

Date: {{notice_date}}

To:   {{tenant_name}}
      {{property_address}}, Unit {{unit_number}}
      Case No: {{case_number}}

You are hereby notified that you owe rent in the total amount of {{outstanding_balance}}
for the premises located at {{property_address}}, Unit {{unit_number}}.

Monthly rent: {{monthly_rent}}
Lease period: {{lease_start}} — {{lease_end}}

Total charged: {{total_due}}
Total paid:    {{total_paid}}
Balance owed:  {{outstanding_balance}}

DEMAND IS HEREBY MADE that you pay the full amount owed within THIRTY (30) DAYS
of this notice, or vacate and surrender the premises.

Failure to pay or vacate will result in legal proceedings to recover possession
of the premises and all monies owed, including court costs and attorney fees.

PAYMENT HISTORY ({{period_start}} — {{period_end}}):
{{check_detail_list}}

NOTE: This notice does not constitute legal advice. Consult a licensed attorney.',
  'New York',
  true
),
(
  '60-Day Notice of Non-Payment',
  'non_payment_60day',
  'NOTICE OF NON-PAYMENT OF RENT — 60 DAYS

Date: {{notice_date}}

To:   {{tenant_name}}
      {{property_address}}, Unit {{unit_number}}
      Case No: {{case_number}}

This is a SECOND AND FINAL NOTICE. You have been in rent arrears in the amount of
{{outstanding_balance}} for the premises located at {{property_address}}, Unit {{unit_number}}.

Monthly rent: {{monthly_rent}}
Lease period: {{lease_start}} — {{lease_end}}

Total charged: {{total_due}}
Total paid:    {{total_paid}}
Balance owed:  {{outstanding_balance}}

DEMAND IS HEREBY MADE that you pay the full amount owed within SIXTY (60) DAYS
of this notice, or vacate and surrender the premises.

Continued non-payment will result in initiation of eviction proceedings (holdover
or non-payment proceeding) in Housing Court, at which point all legal costs
will be charged to you.

PAYMENT HISTORY ({{period_start}} — {{period_end}}):
{{check_detail_list}}

NOTE: This notice does not constitute legal advice. Consult a licensed attorney.',
  'New York',
  true
),
(
  '90-Day Legal Notice',
  'notice_90day',
  'NOTICE TO VACATE — 90 DAYS

Date: {{notice_date}}

To:   {{tenant_name}}
      {{property_address}}, Unit {{unit_number}}
      Case No: {{case_number}}

You are hereby notified that your tenancy at {{property_address}}, Unit {{unit_number}}
will be terminated ninety (90) days from the date of this notice ({{notice_date}}).

You must vacate and surrender possession of the premises on or before
ninety (90) days from this date.

Monthly rent: {{monthly_rent}}
Lease period: {{lease_start}} — {{lease_end}}

Outstanding balance owed: {{outstanding_balance}}
Total charged:            {{total_due}}
Total paid:               {{total_paid}}

Failure to vacate by the required date will result in commencement of a summary
proceeding in the appropriate Housing Court.

PAYMENT HISTORY ({{period_start}} — {{period_end}}):
{{check_detail_list}}

NOTE: This notice does not constitute legal advice. Consult a licensed attorney.',
  'New York',
  true
),
(
  'Court Filing Summary',
  'court_form',
  'COURT FILING SUMMARY — RENT ARREARS

Date Prepared: {{notice_date}}

TENANT INFORMATION
Name (Legal):   {{tenant_name}}
Case Number:    {{case_number}}
Address:        {{property_address}}, Unit {{unit_number}}

LEASE INFORMATION
Monthly Rent:   {{monthly_rent}}
Lease Start:    {{lease_start}}
Lease End:      {{lease_end}}

ARREARS SUMMARY
Total Charged:         {{total_due}}
Total Paid:            {{total_paid}}
Outstanding Balance:   {{outstanding_balance}}

PAYMENT HISTORY ({{period_start}} — {{period_end}}):
{{check_detail_list}}

This document is a summary for attorney/court reference only.
It does not constitute a legal pleading.

Prepared: {{notice_date}}',
  'New York',
  true
)
ON CONFLICT (notice_type) DO UPDATE SET
  title      = EXCLUDED.title,
  body       = EXCLUDED.body,
  is_active  = EXCLUDED.is_active;
-- Note: changed DO NOTHING → DO UPDATE so re-running this fixes existing rows too


-- ──────────────────────────────────────────────────────────
-- SECTION 4: INSERT PROPERTIES + UNITS
-- Run ONLY if units table is empty (check Section 1 first)
-- These are Sonu's 3 buildings with their units
-- ──────────────────────────────────────────────────────────

-- 4a. Insert properties (3 buildings)
-- NOTE: If properties already exist with these addresses, skip this section.
-- Adjust addresses if the existing rows have slightly different names.

-- Check existing properties first:
SELECT id, name, nickname, address FROM properties;

-- Insert buildings (only if not already there):
/*
INSERT INTO properties (name, address, city_state_zip, property_type, status)
VALUES
  ('8607 101st Street', '8607 101st Street', 'Richmond Hill / Jamaica, NY 11418', 'residential', 'active'),
  ('338 Beach 84th Street', '338 Beach 84th Street', 'Rockaway Beach, NY 11693', 'residential', 'active'),
  ('465 Beach 43rd Street', '465 Beach 43rd Street', 'Far Rockaway, NY 11691', 'residential', 'inactive')  -- SOLD property
ON CONFLICT DO NOTHING;
*/

-- 4b. Insert units for 8607 101st Street
-- (Replace the property_id UUID with the actual ID from your properties table)
/*
INSERT INTO units (property_id, unit_number, status)
SELECT id, '1R', 'occupied' FROM properties WHERE address ILIKE '%8607 101st%'
ON CONFLICT DO NOTHING;

INSERT INTO units (property_id, unit_number, status)
SELECT id, '1L', 'vacant' FROM properties WHERE address ILIKE '%8607 101st%'
ON CONFLICT DO NOTHING;

INSERT INTO units (property_id, unit_number, status)
SELECT id, '2R', 'occupied' FROM properties WHERE address ILIKE '%8607 101st%'
ON CONFLICT DO NOTHING;

INSERT INTO units (property_id, unit_number, status)
SELECT id, '2L', 'occupied' FROM properties WHERE address ILIKE '%8607 101st%'
ON CONFLICT DO NOTHING;

-- Units for 338 Beach 84th Street
INSERT INTO units (property_id, unit_number, status)
SELECT id, '1', 'occupied' FROM properties WHERE address ILIKE '%338 Beach 84th%'
ON CONFLICT DO NOTHING;

INSERT INTO units (property_id, unit_number, status)
SELECT id, '2', 'vacant' FROM properties WHERE address ILIKE '%338 Beach 84th%'
ON CONFLICT DO NOTHING;

-- Units for 465 Beach 43rd Street (SOLD — historical only)
INSERT INTO units (property_id, unit_number, status)
SELECT id, '1', 'inactive' FROM properties WHERE address ILIKE '%465 Beach 43rd%'
ON CONFLICT DO NOTHING;
*/


-- ──────────────────────────────────────────────────────────
-- SECTION 5: INSERT TENANTS + LEASES
-- Run ONLY if tenants table is empty or missing these tenants
-- ──────────────────────────────────────────────────────────

-- 5a. Insert tenants
-- NOTE: Replace unit_id values with actual UUIDs from your units table.
-- Run: SELECT id, unit_number, property_id FROM units; to get the IDs.

/*
-- Tenant 1: Jean Walston — Unit 2L at 8607 101st St
INSERT INTO tenants (name, case_number, email, status, unit_id)
VALUES (
  'Jean Walston',
  '38482672D-01',
  'jean.walston@example.com',
  'active',
  (SELECT u.id FROM units u JOIN properties p ON p.id = u.property_id
   WHERE p.address ILIKE '%8607 101st%' AND u.unit_number = '2L' LIMIT 1)
)
ON CONFLICT (case_number) DO NOTHING;

-- Tenant 2: Chameka Flemister — Unit 2R (eviction in process)
INSERT INTO tenants (name, case_number, email, status, unit_id)
VALUES (
  'Chameka Flemister',
  '38084283B-01',
  'chameka.flemister@example.com',
  'active',
  (SELECT u.id FROM units u JOIN properties p ON p.id = u.property_id
   WHERE p.address ILIKE '%8607 101st%' AND u.unit_number = '2R' LIMIT 1)
)
ON CONFLICT (case_number) DO NOTHING;

-- Tenant 3: Abdullah S Ali — Unit 1R (lease expired April 30, 2026)
INSERT INTO tenants (name, full_legal_name, case_number, email, status, unit_id)
VALUES (
  'Abdullah Ali',
  'Abdullah S Ali',
  '37797070C-01',
  'abdullah.ali@example.com',
  'active',
  (SELECT u.id FROM units u JOIN properties p ON p.id = u.property_id
   WHERE p.address ILIKE '%8607 101st%' AND u.unit_number = '1R' LIMIT 1)
)
ON CONFLICT (case_number) DO NOTHING;

-- Tenant 4: Angel Deonarine — Unit 1 at 338 Beach 84th St
INSERT INTO tenants (name, case_number, email, status, unit_id)
VALUES (
  'Angel Deonarine',
  '30297467A-01',
  'angel.deonarine@example.com',
  'active',
  (SELECT u.id FROM units u JOIN properties p ON p.id = u.property_id
   WHERE p.address ILIKE '%338 Beach 84th%' AND u.unit_number = '1' LIMIT 1)
)
ON CONFLICT (case_number) DO NOTHING;

-- Tenant 5: Marrushka Morissaint — Unit 2 at 338 Beach 84th St (moved out ~Feb 2026)
INSERT INTO tenants (name, full_legal_name, case_number, email, status, unit_id)
VALUES (
  'Marrushka Morissaint',
  'Marrushka S Morissaint',
  '39123669C-01',
  'marrushka.morissaint@example.com',
  'moved_out',
  (SELECT u.id FROM units u JOIN properties p ON p.id = u.property_id
   WHERE p.address ILIKE '%338 Beach 84th%' AND u.unit_number = '2' LIMIT 1)
)
ON CONFLICT (case_number) DO NOTHING;

-- Tenant 6: Shannick Feliciano — 465 Beach 43rd (SOLD property — historical)
INSERT INTO tenants (name, case_number, email, status, household_members)
VALUES (
  'Shannick Feliciano',
  '8877773F',
  'shannick.feliciano@example.com',
  'moved_out',
  'Cristian Martinez, Yazmin Martinez, Kayla Martinez, Diamond Martinez, Jeremiah Reyes'
)
ON CONFLICT (case_number) DO NOTHING;
*/


-- ──────────────────────────────────────────────────────────
-- SECTION 6: INSERT LEASES
-- Run AFTER tenants are inserted
-- ──────────────────────────────────────────────────────────

/*
-- Jean Walston — 4 leases (active lease to Dec 31, 2026)
-- Insert all her historical leases, then the current one.
-- Replace unit_id subquery results with actual UUIDs.
INSERT INTO leases (tenant_id, unit_id, start_date, end_date, rent_amount, lease_type, status)
SELECT
  (SELECT id FROM tenants WHERE case_number = '38482672D-01'),
  (SELECT u.id FROM units u JOIN properties p ON p.id = u.property_id
   WHERE p.address ILIKE '%8607 101st%' AND u.unit_number = '2L' LIMIT 1),
  '2024-01-01', '2026-12-31', 2428.80, 'fixed', 'active'
WHERE NOT EXISTS (
  SELECT 1 FROM leases WHERE tenant_id = (SELECT id FROM tenants WHERE case_number = '38482672D-01')
  AND start_date = '2024-01-01'
);

-- Chameka Flemister — Month-to-month (eviction)
INSERT INTO leases (tenant_id, unit_id, start_date, end_date, rent_amount, lease_type, status)
SELECT
  (SELECT id FROM tenants WHERE case_number = '38084283B-01'),
  (SELECT u.id FROM units u JOIN properties p ON p.id = u.property_id
   WHERE p.address ILIKE '%8607 101st%' AND u.unit_number = '2R' LIMIT 1),
  '2022-11-01', '2027-12-31', 2217.00, 'month_to_month', 'active'
WHERE NOT EXISTS (
  SELECT 1 FROM leases WHERE tenant_id = (SELECT id FROM tenants WHERE case_number = '38084283B-01')
  AND start_date = '2022-11-01'
);

-- Abdullah S Ali — Last lease expired April 30, 2026
INSERT INTO leases (tenant_id, unit_id, start_date, end_date, rent_amount, lease_type, status)
SELECT
  (SELECT id FROM tenants WHERE case_number = '37797070C-01'),
  (SELECT u.id FROM units u JOIN properties p ON p.id = u.property_id
   WHERE p.address ILIKE '%8607 101st%' AND u.unit_number = '1R' LIMIT 1),
  '2023-05-01', '2026-04-30', 2555.00, 'fixed', 'expired'
WHERE NOT EXISTS (
  SELECT 1 FROM leases WHERE tenant_id = (SELECT id FROM tenants WHERE case_number = '37797070C-01')
  AND start_date = '2023-05-01'
);
-- TODO: Ask Sonu if Abdullah is renewing. If yes, insert new lease here.
-- If month-to-month: INSERT with start_date = '2026-05-01', end_date = '2027-12-31',
-- lease_type = 'month_to_month', status = 'active'

-- Angel Deonarine — Active lease July 2025 → June 2026
INSERT INTO leases (tenant_id, unit_id, start_date, end_date, rent_amount, lease_type, status)
SELECT
  (SELECT id FROM tenants WHERE case_number = '30297467A-01'),
  (SELECT u.id FROM units u JOIN properties p ON p.id = u.property_id
   WHERE p.address ILIKE '%338 Beach 84th%' AND u.unit_number = '1' LIMIT 1),
  '2025-07-01', '2026-06-30', 3644.00, 'fixed', 'active'
WHERE NOT EXISTS (
  SELECT 1 FROM leases WHERE tenant_id = (SELECT id FROM tenants WHERE case_number = '30297467A-01')
  AND start_date = '2025-07-01'
);

-- Marrushka Morissaint — Ended (moved out ~Feb 2026)
INSERT INTO leases (tenant_id, unit_id, start_date, end_date, rent_amount, lease_type, status)
SELECT
  (SELECT id FROM tenants WHERE case_number = '39123669C-01'),
  (SELECT u.id FROM units u JOIN properties p ON p.id = u.property_id
   WHERE p.address ILIKE '%338 Beach 84th%' AND u.unit_number = '2' LIMIT 1),
  '2022-11-01', '2026-02-28', 3214.00, 'month_to_month', 'ended'
WHERE NOT EXISTS (
  SELECT 1 FROM leases WHERE tenant_id = (SELECT id FROM tenants WHERE case_number = '39123669C-01')
);

-- Shannick Feliciano — Historical (property sold Feb 2024)
INSERT INTO leases (tenant_id, unit_id, start_date, end_date, rent_amount, lease_type, status)
SELECT
  (SELECT id FROM tenants WHERE case_number = '8877773F'),
  (SELECT u.id FROM units u JOIN properties p ON p.id = u.property_id
   WHERE p.address ILIKE '%465 Beach 43rd%' AND u.unit_number = '1' LIMIT 1),
  '2018-01-01', '2024-02-29', 1956.00, 'month_to_month', 'ended'
WHERE NOT EXISTS (
  SELECT 1 FROM leases WHERE tenant_id = (SELECT id FROM tenants WHERE case_number = '8877773F')
);
*/


-- ──────────────────────────────────────────────────────────
-- SECTION 7: FIX TRANSACTION MATCHING (1,729 unmatched rows)
-- The extracted case numbers have leading zeros — strip them to match.
-- ──────────────────────────────────────────────────────────

-- Step 7a: See what Gemini actually extracted
SELECT DISTINCT extracted_case_number
FROM transactions
WHERE extracted_case_number IS NOT NULL
ORDER BY extracted_case_number
LIMIT 20;

-- Step 7b: THE FIX — strips leading zeros then matches tenants
-- Safe to run multiple times (only updates rows with NULL matched_tenant_id)
UPDATE transactions t
SET
  matched_tenant_id = ten.id,
  status = 'pending_review'
FROM tenants ten
WHERE
  t.matched_tenant_id IS NULL
  AND t.extracted_case_number IS NOT NULL
  AND (
    LTRIM(t.extracted_case_number, '0') = ten.case_number
    OR LTRIM(t.extracted_case_number, '0') || '-01' = ten.case_number
    OR SPLIT_PART(LTRIM(t.extracted_case_number, '0'), '-', 1) = SPLIT_PART(ten.case_number, '-', 1)
    OR t.extracted_case_number = ten.case_number
  );

-- Step 7c: Check results
SELECT
  COUNT(*) AS total,
  COUNT(matched_tenant_id) AS matched,
  COUNT(*) - COUNT(matched_tenant_id) AS still_unmatched
FROM transactions;

-- Breakdown by tenant (verify counts make sense)
SELECT
  ten.name,
  ten.case_number,
  COUNT(t.id) AS transaction_count
FROM tenants ten
LEFT JOIN transactions t ON t.matched_tenant_id = ten.id
GROUP BY ten.name, ten.case_number
ORDER BY transaction_count DESC;

-- Step 7d: Verify ledger now shows real data
SELECT tenant_id, month, due_amount, paid_amount, pending_balance
FROM view_rent_ledger
WHERE paid_amount > 0
ORDER BY tenant_id, month
LIMIT 30;


-- ──────────────────────────────────────────────────────────
-- SECTION 8: MARK DUPLICATE TRANSACTIONS
-- Run AFTER Section 7 (transaction matching must be done first)
-- A duplicate = same case_number + check_number + amount
-- Keep earliest created_at; mark the rest as 'duplicate'
-- ──────────────────────────────────────────────────────────

UPDATE transactions t1
SET status = 'duplicate'
WHERE t1.status != 'duplicate'
  AND EXISTS (
    SELECT 1 FROM transactions t2
    WHERE t2.id != t1.id
      AND t2.status != 'duplicate'
      AND COALESCE(LTRIM(t2.extracted_case_number, '0'), '') =
          COALESCE(LTRIM(t1.extracted_case_number, '0'), '')
      AND t2.extracted_check_number = t1.extracted_check_number
      AND t2.extracted_amount = t1.extracted_amount
      AND t2.created_at < t1.created_at
  );

-- Check duplicates found
SELECT
  COUNT(*) AS total,
  COUNT(CASE WHEN status = 'duplicate' THEN 1 END) AS duplicates,
  COUNT(CASE WHEN status = 'pending_review' THEN 1 END) AS pending_review,
  COUNT(CASE WHEN status = 'needs_review' THEN 1 END) AS needs_review,
  COUNT(CASE WHEN status = 'verified' THEN 1 END) AS verified
FROM transactions;


-- ──────────────────────────────────────────────────────────
-- SECTION 9: FINAL VERIFICATION
-- Run after all sections above are complete
-- ──────────────────────────────────────────────────────────

-- Overall counts
SELECT 'properties' AS tbl, COUNT(*) AS rows FROM properties
UNION ALL SELECT 'units', COUNT(*) FROM units
UNION ALL SELECT 'tenants', COUNT(*) FROM tenants
UNION ALL SELECT 'leases', COUNT(*) FROM leases
UNION ALL SELECT 'transactions', COUNT(*) FROM transactions
UNION ALL SELECT 'legal_templates', COUNT(*) FROM legal_templates
UNION ALL SELECT 'expenses', COUNT(*) FROM expenses
ORDER BY tbl;

-- Rent ledger spot check
SELECT
  t.name,
  t.case_number,
  rl.month,
  rl.due_amount,
  rl.paid_amount,
  rl.pending_balance,
  rl.flag_30_day,
  rl.flag_60_day
FROM view_rent_ledger rl
JOIN tenants t ON t.id = rl.tenant_id
ORDER BY t.name, rl.month DESC
LIMIT 50;
