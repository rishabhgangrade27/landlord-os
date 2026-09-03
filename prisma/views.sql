-- Ledger views, ported from the original Supabase Postgres views.
-- These are NOT managed by Prisma (Prisma has no first-class view support in
-- this version) — Prisma migrations/db push do not create or touch these.
-- Run manually after every `prisma db push` on a fresh database:
--   psql "$DATABASE_URL" -f prisma/views.sql
-- (or see scripts/apply-views.js for a DATABASE_URL-from-.env.local runner)
--
-- Logic is unchanged from Supabase's final, already-debugged version — only
-- the `::lease_status_enum` / `::transaction_status_v2` casts are stripped,
-- since this schema uses plain text status columns instead of Postgres enums.

CREATE OR REPLACE VIEW view_rent_ledger AS
WITH lease_months AS (
  SELECT
    l.id AS lease_id,
    l.tenant_id,
    l.unit_id,
    l.property_id,
    l.rent_amount AS monthly_due,
    (generate_series(
      date_trunc('month', l.start_date::timestamp with time zone),
      date_trunc('month', LEAST(COALESCE(l.end_date, CURRENT_DATE), CURRENT_DATE)::timestamp with time zone),
      '1 mon'::interval
    ))::date AS month
  FROM "Lease" l
  WHERE l.status IN ('active', 'expired')
),
monthly_payments AS (
  SELECT
    t.matched_tenant_id AS tenant_id,
    (date_trunc('month', COALESCE(t.extracted_rent_from, t.extracted_check_date)::timestamp with time zone))::date AS payment_month,
    sum(t.extracted_amount) AS total_paid
  FROM "Transaction" t
  WHERE t.status IN ('verified', 'processing')
    AND (t.duplicate_suspected = false OR t.duplicate_suspected IS NULL)
    AND t.extracted_check_date IS NOT NULL
    AND t.deleted_at IS NULL
  GROUP BY
    t.matched_tenant_id,
    (date_trunc('month', COALESCE(t.extracted_rent_from, t.extracted_check_date)::timestamp with time zone))::date
),
monthly_snapshot AS (
  SELECT
    lm.tenant_id, lm.lease_id, lm.unit_id, lm.property_id, lm.month, lm.monthly_due,
    COALESCE(mp.total_paid, 0) AS paid_amount
  FROM lease_months lm
  LEFT JOIN monthly_payments mp
    ON lm.tenant_id = mp.tenant_id AND lm.month = mp.payment_month
),
cumulative_ledger AS (
  SELECT
    ms.tenant_id, ms.lease_id, ms.unit_id, ms.property_id, ms.month, ms.monthly_due, ms.paid_amount,
    sum(ms.monthly_due) OVER (PARTITION BY ms.tenant_id ORDER BY ms.month ROWS UNBOUNDED PRECEDING) AS cumulative_due,
    sum(ms.paid_amount) OVER (PARTITION BY ms.tenant_id ORDER BY ms.month ROWS UNBOUNDED PRECEDING) AS cumulative_paid
  FROM monthly_snapshot ms
)
SELECT
  cl.tenant_id,
  cl.unit_id,
  cl.lease_id,
  COALESCE(cl.property_id, cl.unit_id) AS property_id,
  cl.month,
  cl.monthly_due AS due_amount,
  cl.paid_amount,
  (cl.cumulative_due - cl.cumulative_paid) AS pending_balance,
  lag(cl.cumulative_due - cl.cumulative_paid, 1, 0) OVER (PARTITION BY cl.tenant_id ORDER BY cl.month) AS carryover_from_previous,
  CASE WHEN (cl.cumulative_due - cl.cumulative_paid) > 0 THEN true ELSE false END AS flag_30_day,
  CASE WHEN (cl.cumulative_due - cl.cumulative_paid) > 0
        AND lag(cl.cumulative_due - cl.cumulative_paid, 1, 0) OVER (PARTITION BY cl.tenant_id ORDER BY cl.month) > 0
       THEN true ELSE false END AS flag_60_day,
  t.name AS tenant_name,
  t.full_legal_name,
  COALESCE(p.nickname, p.name) AS unit_number,
  p.address AS property_address
FROM cumulative_ledger cl
LEFT JOIN "Tenant" t ON t.id = cl.tenant_id
LEFT JOIN "Property" p ON p.id = COALESCE(cl.property_id, cl.unit_id);

CREATE OR REPLACE VIEW view_court_ledger AS
SELECT
  t.matched_tenant_id AS tenant_id,
  ten.full_legal_name AS tenant_name,
  ten.case_number,
  ten.address AS tenant_address,
  p.nickname AS unit_number,
  p.address AS property_address,
  l.rent_amount AS monthly_due,
  l.start_date AS lease_start,
  l.end_date AS lease_end,
  to_char((COALESCE(t.extracted_rent_from, t.extracted_check_date))::timestamp with time zone, 'FMMonth YYYY') AS month_label,
  (date_trunc('month', (COALESCE(t.extracted_rent_from, t.extracted_check_date))::timestamp with time zone))::date AS ledger_month,
  t.extracted_check_number AS check_number,
  t.extracted_check_date AS check_date,
  t.extracted_amount AS amount,
  t.extracted_rent_from AS rent_from,
  t.extracted_rent_to AS rent_to,
  t.ocr_confidence,
  t.duplicate_suspected,
  t.status,
  t.id AS transaction_id
FROM "Transaction" t
JOIN "Tenant" ten ON ten.id = t.matched_tenant_id
JOIN LATERAL (
  SELECT l2.id, l2.tenant_id, l2.start_date, l2.end_date, l2.rent_amount,
         l2.created_at, l2.status, l2.property_id, l2.unit_id, l2.notes
  FROM "Lease" l2
  WHERE l2.tenant_id = ten.id
    AND l2.status IN ('active', 'expired')
    AND l2.start_date <= COALESCE(t.extracted_rent_from, t.extracted_check_date)::timestamp with time zone
  ORDER BY l2.start_date DESC
  LIMIT 1
) l ON true
JOIN "Property" p ON p.id = l.property_id
WHERE t.status <> 'blank_detected'
  AND (t.duplicate_suspected = false OR t.duplicate_suspected IS NULL)
  AND t.deleted_at IS NULL;

-- The three Reports-page views below were never ported when
-- view_rent_ledger/view_court_ledger were (see SCRATCHPAD.md Phase 8) —
-- the Reports page has been showing hardcoded empty arrays since the
-- SQLite/Postgres switch, not from any code bug, just because these three
-- were missed. Same treatment: pulled as-is from Supabase's live
-- definitions via the Supabase MCP connector, enum casts stripped.

CREATE OR REPLACE VIEW monthly_profit AS
SELECT date_trunc('month'::text, t.extracted_check_date::timestamp with time zone) AS month,
    COALESCE(sum(t.extracted_amount), 0::numeric) AS income,
    COALESCE(sum(e.amount), 0::numeric) AS expenses,
    COALESCE(sum(t.extracted_amount), 0::numeric) - COALESCE(sum(e.amount), 0::numeric) AS profit
FROM "Transaction" t
LEFT JOIN "Lease" l ON t.matched_tenant_id = l.tenant_id AND l.status = 'active'
LEFT JOIN "Expense" e ON e.property_id = l.property_id AND date_trunc('month'::text, e.expense_date::timestamp with time zone) = date_trunc('month'::text, t.extracted_check_date::timestamp with time zone)
WHERE t.status IN ('verified', 'processing') AND (t.duplicate_suspected IS NULL OR t.duplicate_suspected = false) AND t.extracted_check_date IS NOT NULL AND t.deleted_at IS NULL
GROUP BY (date_trunc('month'::text, t.extracted_check_date::timestamp with time zone))
ORDER BY (date_trunc('month'::text, t.extracted_check_date::timestamp with time zone)) DESC;

CREATE OR REPLACE VIEW property_profit AS
SELECT p.id AS property_id,
    p.nickname AS property_name,
    p.address,
    COALESCE(sum(
        CASE
            WHEN t.status = 'verified' AND t.duplicate_suspected = false THEN t.extracted_amount
            ELSE 0::numeric
        END), 0::numeric) AS income,
    COALESCE(sum(e.amount), 0::numeric) AS expenses,
    COALESCE(sum(
        CASE
            WHEN t.status = 'verified' AND t.duplicate_suspected = false THEN t.extracted_amount
            ELSE 0::numeric
        END), 0::numeric) - COALESCE(sum(e.amount), 0::numeric) AS profit
FROM "Property" p
LEFT JOIN "Lease" l ON l.property_id = p.id AND l.status = 'active'
LEFT JOIN "Transaction" t ON t.matched_tenant_id = l.tenant_id
LEFT JOIN "Expense" e ON e.property_id = p.id
GROUP BY p.id, p.nickname, p.address;

-- total_due is hardcoded to 0 here — that's not a porting bug, the
-- original Supabase definition did this too (never computed a real
-- "due" figure for the yearly view, only total_paid). Preserved as-is.
CREATE OR REPLACE VIEW view_yearly_payments AS
SELECT ten.id AS tenant_id,
    ten.name AS tenant_name,
    EXTRACT(year FROM t.extracted_check_date::date)::integer AS year,
    COALESCE(sum(t.extracted_amount), 0::numeric) AS total_paid,
    0::numeric AS total_due,
    COALESCE(sum(t.extracted_amount), 0::numeric) AS total_balance
FROM "Transaction" t
JOIN "Tenant" ten ON ten.id = t.matched_tenant_id
WHERE t.status IN ('verified', 'processing') AND (t.duplicate_suspected IS NULL OR t.duplicate_suspected = false) AND t.extracted_check_date IS NOT NULL AND t.deleted_at IS NULL
GROUP BY ten.id, ten.name, (EXTRACT(year FROM t.extracted_check_date::date))
ORDER BY (EXTRACT(year FROM t.extracted_check_date::date)::integer) DESC, ten.name;
