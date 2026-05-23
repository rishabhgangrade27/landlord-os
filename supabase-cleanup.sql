-- ====================================================================
-- LandlordOS — Supabase Database Cleanup (v2 — corrected after full analysis)
-- Analyzed: May 23, 2026 | Project: izuxwhpycupbznnaosar.supabase.co
--
-- CRITICAL ORDER: Views must be fixed BEFORE dropping old columns.
-- Several views directly SELECT dead columns — dropping first breaks them.
--
-- Run ONE section at a time in Supabase SQL Editor.
-- Each section ends with a VERIFY query. Read the result before moving on.
-- ====================================================================


-- ====================================================================
-- SECTION 1: VERIFY ALL DEAD COLUMNS ARE NULL
-- Every number below must be 0. If any > 0, stop and tell Rishabh.
-- ====================================================================

-- 1a. transactions (old columns — all must be 0)
SELECT
  COUNT(*) FILTER (WHERE tenant_id IS NOT NULL)                           AS t_tenant_id,
  COUNT(*) FILTER (WHERE case_number IS NOT NULL AND case_number != '')   AS t_case_number,
  COUNT(*) FILTER (WHERE amount IS NOT NULL)                              AS t_amount,
  COUNT(*) FILTER (WHERE check_number IS NOT NULL AND check_number != '') AS t_check_number,
  COUNT(*) FILTER (WHERE receipt_image_url IS NOT NULL AND receipt_image_url != '') AS t_receipt_url,
  COUNT(*) FILTER (WHERE ai_json IS NOT NULL)                             AS t_ai_json,
  COUNT(*) FILTER (WHERE ocr_raw_output IS NOT NULL)                      AS t_ocr_raw,
  COUNT(*) FILTER (WHERE type IS NOT NULL AND type != '')                 AS t_type,
  COUNT(*) FILTER (WHERE date != created_at::date)                        AS t_date_not_equal_created_at
FROM transactions;
-- ALL must be 0.

-- 1b. tenants (all must be 0)
SELECT
  COUNT(*) FILTER (WHERE current_balance IS NOT NULL)   AS current_balance,
  COUNT(*) FILTER (WHERE legacy_id IS NOT NULL)         AS legacy_id,
  COUNT(*) FILTER (WHERE household_members IS NOT NULL) AS household_members,
  COUNT(*) FILTER (WHERE household_size IS NOT NULL)    AS household_size
FROM tenants;

-- 1c. properties (all must be 0)
SELECT
  COUNT(*) FILTER (WHERE tenant_id IS NOT NULL)                               AS p_tenant_id,
  COUNT(*) FILTER (WHERE legacy_tenant_id IS NOT NULL)                        AS p_legacy_tenant_id,
  COUNT(*) FILTER (WHERE market_rent IS NOT NULL)                             AS p_market_rent,
  COUNT(*) FILTER (WHERE city_state_zip IS NOT NULL AND city_state_zip != '') AS p_city_state_zip
FROM properties;

-- 1d. leases.notice_required_days — should be exactly one value: 30
SELECT DISTINCT notice_required_days FROM leases;
-- Expected: one row with value 30.


-- ====================================================================
-- SECTION 2: FIX view_verified_transactions
-- Currently uses dead columns: transactions.tenant_id, .amount, .date
-- Fix: alias matched_tenant_id, extracted_amount, extracted_check_date
-- Keep the SAME output column names so downstream views still work.
-- Downstream: view_monthly_payments and view_tenant_balances depend on this.
-- ====================================================================
CREATE OR REPLACE VIEW view_verified_transactions AS
SELECT
  id,
  matched_tenant_id          AS tenant_id,     -- replaces old tenant_id
  extracted_check_date       AS date,           -- replaces old date
  extracted_amount           AS amount,         -- replaces old amount
  extracted_check_number     AS check_number,
  extracted_case_number      AS case_number,
  matched_tenant_id,
  source_pdf_url,
  file_path,
  page_number,
  ocr_confidence,
  duplicate_suspected,
  status,
  created_at
FROM transactions
WHERE status = 'verified'::transaction_status_v2;

-- VERIFY:
SELECT * FROM view_verified_transactions LIMIT 1;
-- No error = success. (Will return empty until transactions are verified.)


-- ====================================================================
-- SECTION 3: FIX view_tenant_balances
-- Currently uses: transactions.tenant_id (old) + transactions.amount (old)
-- Fix: use matched_tenant_id + extracted_amount, exclude duplicates
-- ====================================================================
CREATE OR REPLACE VIEW view_tenant_balances AS
SELECT
  t.id AS tenant_id,
  COALESCE(SUM(tr.extracted_amount), 0) AS total_paid
FROM tenants t
LEFT JOIN transactions tr
  ON tr.matched_tenant_id = t.id
  AND tr.status = 'verified'::transaction_status_v2
  AND tr.duplicate_suspected = false
GROUP BY t.id;

-- VERIFY:
SELECT * FROM view_tenant_balances LIMIT 3;


-- ====================================================================
-- SECTION 4: FIX view_unit_profitability
-- Currently uses: transactions.tenant_id (old), .amount (old), .type (old)
-- Also broken: joins through units table (which is empty)
-- Fix: join properties directly via leases.property_id
-- ====================================================================
CREATE OR REPLACE VIEW view_unit_profitability AS
SELECT
  p.id                     AS unit_id,
  p.nickname               AS unit_label,
  COALESCE(SUM(tr.extracted_amount) FILTER (
    WHERE tr.status = 'verified'::transaction_status_v2
      AND tr.duplicate_suspected = false
  ), 0) AS total_income
FROM properties p
LEFT JOIN leases l
  ON l.property_id = p.id AND l.status = 'active'::lease_status_enum
LEFT JOIN transactions tr
  ON tr.matched_tenant_id = l.tenant_id
GROUP BY p.id, p.nickname;

-- VERIFY:
SELECT * FROM view_unit_profitability LIMIT 5;


-- ====================================================================
-- SECTION 5: FIX history_transactions (it's a VIEW, not a table)
-- Currently uses: transactions.tenant_id (old), .amount (old), .date (old)
-- Fix: use matched_tenant_id, extracted_amount, extracted_check_date
-- ====================================================================
CREATE OR REPLACE VIEW history_transactions AS
SELECT
  matched_tenant_id                AS tenant_id,
  'transaction'::text              AS event_type,
  status::text                     AS event_subtype,
  created_at                       AS event_time,
  COALESCE((auth.jwt() ->> 'email'::text), 'system'::text) AS actor,
  concat('Transaction ', status::text, ': $', extracted_amount) AS summary,
  jsonb_build_object(
    'transaction_id', id,
    'amount',         extracted_amount,
    'date',           extracted_check_date,
    'status',         status
  ) AS metadata
FROM transactions t;

-- VERIFY:
SELECT * FROM history_transactions LIMIT 1;


-- ====================================================================
-- SECTION 6: FIX property_profit
-- Currently: uses transactions.amount (old) + utility_bills (to be dropped)
--            + joins through units (empty table)
-- Fix: use extracted_amount, join properties directly, drop utility_bills join
-- ====================================================================
CREATE OR REPLACE VIEW property_profit AS
SELECT
  p.id           AS property_id,
  p.nickname     AS property_name,
  p.address,
  COALESCE(SUM(
    CASE WHEN t.status = 'verified'::transaction_status_v2
          AND t.duplicate_suspected = false
    THEN t.extracted_amount ELSE 0 END
  ), 0) AS total_income,
  COALESCE(SUM(e.amount), 0) AS total_expenses,
  COALESCE(SUM(
    CASE WHEN t.status = 'verified'::transaction_status_v2
          AND t.duplicate_suspected = false
    THEN t.extracted_amount ELSE 0 END
  ), 0) - COALESCE(SUM(e.amount), 0) AS profit
FROM properties p
LEFT JOIN leases l
  ON l.property_id = p.id AND l.status = 'active'::lease_status_enum
LEFT JOIN transactions t
  ON t.matched_tenant_id = l.tenant_id
LEFT JOIN expenses e
  ON e.property_id = p.id
GROUP BY p.id, p.nickname, p.address;

-- VERIFY:
SELECT property_name, total_income, total_expenses, profit FROM property_profit;
-- Will show 0s until transactions are verified, but no error = success.


-- ====================================================================
-- SECTION 7: FIX view_court_ledger
-- CRITICAL: This view ALWAYS returns 0 rows because it joins through
-- the empty units table via leases.unit_id (which is NULL for all rows).
-- Fix: join properties directly via leases.property_id.
-- This is why the Generate Notice flow has no check history — fix this first.
-- ====================================================================
CREATE OR REPLACE VIEW view_court_ledger AS
SELECT
  t.matched_tenant_id                                        AS tenant_id,
  ten.full_legal_name                                        AS tenant_name,
  ten.case_number,
  ten.address                                                AS tenant_address,
  p.nickname                                                 AS unit_number,
  p.address                                                  AS property_address,
  l.rent_amount                                              AS monthly_due,
  l.start_date                                               AS lease_start,
  l.end_date                                                 AS lease_end,
  to_char(t.extracted_check_date::timestamp with time zone, 'FMMonth YYYY'::text)
                                                             AS month_label,
  date_trunc('month'::text, t.extracted_check_date::timestamp with time zone)
                                                             AS ledger_month,
  t.extracted_check_number                                   AS check_number,
  t.extracted_check_date                                     AS check_date,
  t.extracted_amount                                         AS amount,
  t.extracted_rent_from                                      AS rent_from,
  t.extracted_rent_to                                        AS rent_to,
  t.ocr_confidence,
  t.duplicate_suspected,
  t.status,
  t.id                                                       AS transaction_id
FROM transactions t
JOIN tenants ten
  ON ten.id = t.matched_tenant_id
JOIN leases l
  ON l.tenant_id = ten.id AND l.status = 'active'::lease_status_enum
JOIN properties p
  ON p.id = l.property_id              -- FIXED: direct join, no units table
WHERE t.status != 'blank_detected'::transaction_status_v2
  AND t.duplicate_suspected = false
ORDER BY t.extracted_check_date;

-- VERIFY — tests the view compiles and executes without error.
-- Returns 0 rows here (transactions not matched yet — that's Section 13).
-- After Section 13 runs: re-run this and you should see rows.
SELECT COUNT(*) AS court_ledger_rows FROM view_court_ledger;


-- ====================================================================
-- SECTION 8: FIX monthly_profit
-- Broken: joins through empty units table → always returns 0 rows
-- Fix: join expenses via leases.property_id directly
-- ====================================================================
CREATE OR REPLACE VIEW monthly_profit AS
SELECT
  date_trunc('month'::text, t.extracted_check_date::timestamp with time zone) AS month,
  SUM(t.extracted_amount)                                           AS income,
  COALESCE(SUM(e.amount), 0::numeric)                              AS expenses,
  SUM(t.extracted_amount) - COALESCE(SUM(e.amount), 0::numeric)   AS profit
FROM transactions t
LEFT JOIN leases l
  ON t.matched_tenant_id = l.tenant_id AND l.status = 'active'::lease_status_enum
LEFT JOIN expenses e
  ON e.property_id = l.property_id
  AND date_trunc('month'::text, e.expense_date::timestamp with time zone)
    = date_trunc('month'::text, t.extracted_check_date::timestamp with time zone)
WHERE t.status = 'verified'::transaction_status_v2
  AND t.duplicate_suspected = false
  AND t.extracted_check_date IS NOT NULL
GROUP BY date_trunc('month'::text, t.extracted_check_date::timestamp with time zone)
ORDER BY month DESC;

-- VERIFY:
SELECT 'monthly_profit recreated' AS status;


-- ====================================================================
-- SECTION 9: FIX view_property_timeline
-- Broken: joins through empty units table via l.unit_id
-- Fix: join properties directly via l.property_id
-- ====================================================================
CREATE OR REPLACE VIEW view_property_timeline AS
WITH lease_history AS (
  SELECT
    l.property_id,
    p.nickname                    AS unit_label,
    l.start_date,
    COALESCE(l.end_date, CURRENT_DATE) AS end_date,
    t.full_legal_name             AS tenant_name,
    l.rent_amount,
    'Occupied'::text              AS status
  FROM leases l
  LEFT JOIN tenants t  ON l.tenant_id = t.id
  LEFT JOIN properties p ON l.property_id = p.id   -- FIXED: direct join
),
vacancy_gaps AS (
  SELECT
    lh1.property_id,
    lh1.unit_label,
    lh1.end_date                  AS gap_start,
    COALESCE(
      MIN(lh2.start_date),
      CURRENT_DATE
    )                             AS gap_end,
    'Vacant'::text                AS status,
    NULL::text                    AS tenant_name,
    NULL::numeric                 AS rent_amount
  FROM lease_history lh1
  LEFT JOIN lease_history lh2
    ON lh2.property_id = lh1.property_id
   AND lh2.start_date > lh1.end_date
  WHERE lh1.end_date < CURRENT_DATE
  GROUP BY lh1.property_id, lh1.unit_label, lh1.end_date
  HAVING lh1.end_date < COALESCE(MIN(lh2.start_date), CURRENT_DATE)
)
SELECT * FROM lease_history
UNION ALL
SELECT * FROM vacancy_gaps
ORDER BY property_id, start_date;

-- VERIFY:
SELECT COUNT(*) AS rows FROM view_property_timeline;


-- ====================================================================
-- SECTION 10: FIX view_lease_status + view_leases_with_computed_status
-- Both SELECT notice_required_days. Must recreate BEFORE dropping that col.
-- view_lease_status also uses it in a CASE WHEN — hardcode 30 instead.
-- ====================================================================
CREATE OR REPLACE VIEW view_lease_status AS
SELECT
  id,
  tenant_id,
  start_date,
  end_date,
  rent_amount,
  created_at,
  status,
  property_id,
  renewal_flag,
  updated_at,
  created_by,
  updated_by,
  CASE
    WHEN end_date < CURRENT_DATE                   THEN 'expired'::text
    WHEN (end_date - CURRENT_DATE) <= 30           THEN 'expiring'::text  -- was: <= notice_required_days
    ELSE 'active'::text
  END AS calculated_status,
  (end_date - CURRENT_DATE) AS days_until_expiry
FROM leases l;

CREATE OR REPLACE VIEW view_leases_with_computed_status AS
SELECT
  id,
  tenant_id,
  property_id,
  start_date,
  end_date,
  rent_amount,
  status,
  renewal_flag,
  created_at,
  updated_at,
  created_by,
  updated_by,
  CASE
    WHEN end_date < CURRENT_DATE  THEN 'expired'::text
    WHEN start_date > CURRENT_DATE THEN 'upcoming'::text
    ELSE status::text
  END AS computed_status
FROM leases l;
-- notice_required_days removed from SELECT

-- VERIFY:
SELECT calculated_status, COUNT(*) FROM view_lease_status GROUP BY 1;
SELECT computed_status, COUNT(*) FROM view_leases_with_computed_status GROUP BY 1;


-- ====================================================================
-- SECTION 11: NOW SAFE — DROP DEAD COLUMNS FROM transactions
-- All views that used these columns have been fixed above.
-- ====================================================================
ALTER TABLE transactions DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE transactions DROP COLUMN IF EXISTS case_number;
ALTER TABLE transactions DROP COLUMN IF EXISTS amount;
ALTER TABLE transactions DROP COLUMN IF EXISTS check_number;
ALTER TABLE transactions DROP COLUMN IF EXISTS receipt_image_url;
ALTER TABLE transactions DROP COLUMN IF EXISTS ai_json;
ALTER TABLE transactions DROP COLUMN IF EXISTS ocr_raw_output;
ALTER TABLE transactions DROP COLUMN IF EXISTS type;
ALTER TABLE transactions DROP COLUMN IF EXISTS date;

-- VERIFY:
SELECT column_name FROM information_schema.columns
WHERE table_name = 'transactions' AND table_schema = 'public'
ORDER BY ordinal_position;
-- Must NOT include: tenant_id, case_number, amount, check_number,
--                   receipt_image_url, ai_json, ocr_raw_output, type, date


-- ====================================================================
-- SECTION 12: DROP DEAD COLUMNS FROM tenants, properties, leases
-- ====================================================================

-- tenants
ALTER TABLE tenants DROP COLUMN IF EXISTS current_balance;
ALTER TABLE tenants DROP COLUMN IF EXISTS legacy_id;
ALTER TABLE tenants DROP COLUMN IF EXISTS household_members;
ALTER TABLE tenants DROP COLUMN IF EXISTS household_size;
ALTER TABLE tenants DROP COLUMN IF EXISTS lease_status;
-- lease_status showed 'Active' for ALL tenants incl. moved_out — stale, wrong data.

-- properties
ALTER TABLE properties DROP COLUMN IF EXISTS tenant_id;
ALTER TABLE properties DROP COLUMN IF EXISTS legacy_tenant_id;
ALTER TABLE properties DROP COLUMN IF EXISTS market_rent;
ALTER TABLE properties DROP COLUMN IF EXISTS city_state_zip;

-- leases (notice_required_days: all rows = 30, not a useful variable)
-- Safe now because view_lease_status and view_leases_with_computed_status
-- were already recreated without it in Section 10.
ALTER TABLE leases DROP COLUMN IF EXISTS notice_required_days;

-- VERIFY — clean column lists:
SELECT table_name, string_agg(column_name, ', ' ORDER BY ordinal_position) AS columns
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('transactions', 'tenants', 'properties', 'leases')
GROUP BY table_name ORDER BY table_name;


-- ====================================================================
-- SECTION 13: FIX TRANSACTION MATCHING (1,729 unmatched rows)
-- Gemini adds leading zeros: "00038084283B-01" vs tenants: "38084283B-01"
-- LTRIM strips zeros, then matches to tenants.id
-- ====================================================================

-- Preview count first:
SELECT COUNT(*) AS will_be_matched
FROM transactions t
JOIN tenants tn ON tn.case_number = LTRIM(t.extracted_case_number, '0')
WHERE t.matched_tenant_id IS NULL
  AND t.extracted_case_number IS NOT NULL
  AND t.extracted_case_number != '';

-- Run the fix:
UPDATE transactions t
SET matched_tenant_id = tn.id
FROM tenants tn
WHERE tn.case_number = LTRIM(t.extracted_case_number, '0')
  AND t.matched_tenant_id IS NULL
  AND t.extracted_case_number IS NOT NULL
  AND t.extracted_case_number != '';

-- VERIFY:
SELECT
  COUNT(*)                            AS total,
  COUNT(matched_tenant_id)            AS matched,
  COUNT(*) - COUNT(matched_tenant_id) AS unmatched
FROM transactions;
-- matched should jump significantly from 0


-- ====================================================================
-- SECTION 14: MARK DUPLICATE TRANSACTIONS
-- Same tenant + same check number = keep oldest, flag the rest
-- ====================================================================

-- Preview:
SELECT matched_tenant_id, extracted_check_number, COUNT(*) AS occurrences
FROM transactions
WHERE extracted_check_number IS NOT NULL
  AND extracted_check_number != ''
  AND matched_tenant_id IS NOT NULL
GROUP BY matched_tenant_id, extracted_check_number
HAVING COUNT(*) > 1
ORDER BY occurrences DESC
LIMIT 20;

-- Flag duplicates:
UPDATE transactions t
SET
  duplicate_suspected = true,
  duplicate_reference_id = (
    SELECT id FROM transactions t2
    WHERE t2.extracted_check_number = t.extracted_check_number
      AND t2.matched_tenant_id = t.matched_tenant_id
      AND t2.created_at < t.created_at
    ORDER BY t2.created_at ASC LIMIT 1
  )
WHERE duplicate_suspected = false
  AND extracted_check_number IS NOT NULL
  AND extracted_check_number != ''
  AND matched_tenant_id IS NOT NULL
  AND (
    SELECT COUNT(*) FROM transactions t3
    WHERE t3.extracted_check_number = t.extracted_check_number
      AND t3.matched_tenant_id = t.matched_tenant_id
  ) > 1
  AND created_at > (
    SELECT MIN(created_at) FROM transactions t4
    WHERE t4.extracted_check_number = t.extracted_check_number
      AND t4.matched_tenant_id = t.matched_tenant_id
  );

-- VERIFY:
SELECT
  COUNT(*) FILTER (WHERE duplicate_suspected = true)  AS flagged,
  COUNT(*) FILTER (WHERE duplicate_suspected = false) AS clean
FROM transactions WHERE matched_tenant_id IS NOT NULL;


-- ====================================================================
-- SECTION 15: POPULATE unit_id IN leases AND tenants
-- Currently NULL for all rows.
-- properties table acts as units — leases.property_id = the unit's row.
-- So: leases.unit_id = leases.property_id (same FK, different name)
-- ====================================================================

-- leases
UPDATE leases SET unit_id = property_id
WHERE unit_id IS NULL AND property_id IS NOT NULL;

-- tenants — from active lease
UPDATE tenants t
SET unit_id = (
  SELECT l.property_id FROM leases l
  WHERE l.tenant_id = t.id AND l.status = 'active'::lease_status_enum
  ORDER BY l.start_date DESC LIMIT 1
)
WHERE t.unit_id IS NULL;

-- tenants — moved_out, use most recent expired lease
UPDATE tenants t
SET unit_id = (
  SELECT l.property_id FROM leases l
  WHERE l.tenant_id = t.id
  ORDER BY l.start_date DESC LIMIT 1
)
WHERE t.unit_id IS NULL;

-- VERIFY:
SELECT t.name, t.status, p.nickname AS unit
FROM tenants t LEFT JOIN properties p ON p.id = t.unit_id
ORDER BY t.name;
-- All 6 tenants should have a unit name.

SELECT COUNT(*) FILTER (WHERE unit_id IS NULL) AS leases_missing_unit FROM leases;
-- Should be 0.


-- ====================================================================
-- SECTION 16: FIX PROPERTY STATUS (all show 'Vacant' — stale)
-- ====================================================================

UPDATE properties p
SET status = 'Occupied'
WHERE EXISTS (
  SELECT 1 FROM leases l
  WHERE l.property_id = p.id AND l.status = 'active'::lease_status_enum
);

UPDATE properties p
SET status = 'Vacant'
WHERE status != 'Inactive'
  AND NOT EXISTS (
    SELECT 1 FROM leases l
    WHERE l.property_id = p.id AND l.status = 'active'::lease_status_enum
  );

-- VERIFY:
SELECT nickname, status,
  (SELECT t.name FROM tenants t JOIN leases l ON l.tenant_id = t.id
   WHERE l.property_id = p.id AND l.status = 'active' LIMIT 1) AS tenant
FROM properties p ORDER BY nickname;
-- 8607 2R → Occupied (Chameka), 8607 2L → Occupied (Jean),
-- 338 Unit 1 → Occupied (Angel), rest → Vacant or Inactive


-- ====================================================================
-- SECTION 17: UPDATE LEGAL TEMPLATE BODIES
-- Current bodies use wrong placeholder names (today_date, balance_owed etc.)
-- Workflow 4 fills: notice_date, tenant_name, outstanding_balance, etc.
-- ====================================================================

UPDATE legal_templates SET
  title = '30-Day Notice of Non-Payment',
  body  = 'NOTICE OF NON-PAYMENT OF RENT — 30 DAYS

Date: {{notice_date}}

To:   {{tenant_name}}
      {{property_address}}, Unit {{unit_number}}
      Case No: {{case_number}}

You are hereby notified that you owe rent in the amount of {{outstanding_balance}}
for the premises at {{property_address}}, Unit {{unit_number}}.

Monthly rent: {{monthly_rent}}
Lease period: {{lease_start}} — {{lease_end}}
Total charged: {{total_due}} | Total paid: {{total_paid}} | Balance: {{outstanding_balance}}

DEMAND IS HEREBY MADE that you pay the full amount owed within THIRTY (30) DAYS
of this notice, or vacate and surrender the premises.

PAYMENT HISTORY ({{period_start}} — {{period_end}}):
{{check_detail_list}}

NOTE: This notice does not constitute legal advice. Consult a licensed attorney.'
WHERE notice_type = 'non_payment_30day';

UPDATE legal_templates SET
  title = '60-Day Notice of Non-Payment',
  body  = 'NOTICE OF NON-PAYMENT OF RENT — 60 DAYS

Date: {{notice_date}}

To:   {{tenant_name}}
      {{property_address}}, Unit {{unit_number}}
      Case No: {{case_number}}

SECOND AND FINAL NOTICE. You are in arrears: {{outstanding_balance}}
for the premises at {{property_address}}, Unit {{unit_number}}.

Monthly rent: {{monthly_rent}}
Lease period: {{lease_start}} — {{lease_end}}
Total charged: {{total_due}} | Total paid: {{total_paid}} | Balance: {{outstanding_balance}}

DEMAND IS HEREBY MADE that you pay within SIXTY (60) DAYS or vacate.
Continued non-payment will result in eviction proceedings in Housing Court.

PAYMENT HISTORY ({{period_start}} — {{period_end}}):
{{check_detail_list}}

NOTE: This notice does not constitute legal advice. Consult a licensed attorney.'
WHERE notice_type = 'non_payment_60day';

UPDATE legal_templates SET
  title = '90-Day Notice to Vacate',
  body  = 'NOTICE TO VACATE — 90 DAYS

Date: {{notice_date}}

To:   {{tenant_name}}
      {{property_address}}, Unit {{unit_number}}
      Case No: {{case_number}}

Your tenancy at {{property_address}}, Unit {{unit_number}} will be terminated
ninety (90) days from the date of this notice.

Monthly rent: {{monthly_rent}}
Lease period: {{lease_start}} — {{lease_end}}
Outstanding balance: {{outstanding_balance}} | Charged: {{total_due}} | Paid: {{total_paid}}

Failure to vacate will result in summary proceedings in Housing Court.

PAYMENT HISTORY ({{period_start}} — {{period_end}}):
{{check_detail_list}}

NOTE: This notice does not constitute legal advice. Consult a licensed attorney.'
WHERE notice_type = 'notice_90day';

UPDATE legal_templates SET
  title = 'Court Filing Summary',
  body  = 'COURT FILING SUMMARY — RENT ARREARS

Date Prepared: {{notice_date}}

TENANT: {{tenant_name}} | Case No: {{case_number}}
Address: {{property_address}}, Unit {{unit_number}}

LEASE: Monthly rent {{monthly_rent}} | {{lease_start}} — {{lease_end}}

ARREARS: Charged {{total_due}} | Paid {{total_paid}} | Balance {{outstanding_balance}}

PAYMENT HISTORY ({{period_start}} — {{period_end}}):
{{check_detail_list}}

For attorney/court reference only. Not a legal pleading. Prepared: {{notice_date}}'
WHERE notice_type = 'court_form';

-- VERIFY:
SELECT notice_type, LEFT(body, 50) AS preview FROM legal_templates ORDER BY notice_type;


-- ====================================================================
-- SECTION 18: RESOLVE SYSTEM_ERRORS + DROP EMPTY TABLES
-- ====================================================================

-- Mark all 5 errors resolved (root cause = leading zeros, fixed in Sec 13)
UPDATE system_errors
SET is_resolved = true,
    resolution_notes = 'Upload errors from May 17 2026. Root cause: leading zeros in extracted_case_number. Fixed by LTRIM match update.'
WHERE is_resolved = false;

-- Drop empty unused tables
-- CONFIRM 0 rows first:
SELECT 'utility_bills' AS tbl, COUNT(*) FROM utility_bills
UNION ALL SELECT 'vendors', COUNT(*) FROM vendors;
-- Both must be 0.

DROP TABLE IF EXISTS utility_bills;
DROP TABLE IF EXISTS vendors;

-- VERIFY utility_bills + vendors gone:
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name IN ('utility_bills', 'vendors');
-- 0 rows expected.


-- ====================================================================
-- SECTION 19: FINAL STATE — Save this output
-- ====================================================================

-- Row counts:
SELECT 'properties' AS tbl, COUNT(*) FROM properties
UNION ALL SELECT 'tenants', COUNT(*) FROM tenants
UNION ALL SELECT 'leases', COUNT(*) FROM leases
UNION ALL SELECT 'transactions', COUNT(*) FROM transactions
UNION ALL SELECT 'legal_templates', COUNT(*) FROM legal_templates
UNION ALL SELECT 'expenses', COUNT(*) FROM expenses
UNION ALL SELECT 'maintenance_tickets', COUNT(*) FROM maintenance_tickets
UNION ALL SELECT 'legal_notices', COUNT(*) FROM legal_notices
UNION ALL SELECT 'tenant_audit_log', COUNT(*) FROM tenant_audit_log;

-- Transaction health:
SELECT
  COUNT(*)                                           AS total,
  COUNT(matched_tenant_id)                           AS matched,
  COUNT(*) - COUNT(matched_tenant_id)                AS unmatched,
  COUNT(*) FILTER (WHERE duplicate_suspected = true) AS duplicates,
  COUNT(*) FILTER (WHERE status = 'needs_review')    AS needs_review,
  COUNT(*) FILTER (WHERE status = 'blank_detected')  AS blank_pages
FROM transactions;

-- Tenants + their units:
SELECT t.name, t.status, p.nickname AS unit
FROM tenants t LEFT JOIN properties p ON p.id = t.unit_id
ORDER BY t.name;

-- Active leases:
SELECT t.name, l.start_date, l.end_date, l.rent_amount
FROM leases l JOIN tenants t ON t.id = l.tenant_id
WHERE l.status = 'active' ORDER BY t.name;

-- Property status:
SELECT nickname, status FROM properties ORDER BY nickname;

-- Cleaned column lists:
SELECT table_name, string_agg(column_name, ', ' ORDER BY ordinal_position) AS columns
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('transactions', 'tenants', 'properties', 'leases')
GROUP BY table_name ORDER BY table_name;

-- Views check (should all return 0 errors):
SELECT COUNT(*) FROM view_verified_transactions;
SELECT COUNT(*) FROM view_tenant_balances;
SELECT COUNT(*) FROM view_unit_profitability;
SELECT COUNT(*) FROM history_transactions;
SELECT COUNT(*) FROM property_profit;
SELECT COUNT(*) FROM monthly_profit;
SELECT COUNT(*) FROM view_court_ledger;
SELECT COUNT(*) FROM view_lease_status;
SELECT COUNT(*) FROM view_leases_with_computed_status;
SELECT COUNT(*) FROM view_property_timeline;
SELECT COUNT(*) FROM view_rent_ledger;
SELECT COUNT(*) FROM view_yearly_payments;
