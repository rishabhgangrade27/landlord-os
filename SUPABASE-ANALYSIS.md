# LandlordOS — Supabase Database Analysis & Cleanup Plan
*Live read of `izuxwhpycupbznnaosar.supabase.co` — May 23, 2026*

---

## What's in the database right now

| Table | Rows | Verdict |
|---|---|---|
| `properties` | 7 | ✅ Keep — but 4 dead columns to drop |
| `tenants` | 6 | ✅ Keep — but 5 dead columns to drop |
| `leases` | 12 | ✅ Keep — 3 active, 9 historical |
| `transactions` | 1,729 | ✅ Keep — but 9 dead columns to drop |
| `legal_templates` | 4 | ✅ Keep — template bodies need updating |
| `system_settings` | 1 | ✅ Keep as-is |
| `system_errors` | 5 | ✅ Keep — mark as resolved |
| `history_transactions` | ? | ✅ Keep |
| `expenses` | 0 | ✅ Keep (will get data when expense form is used) |
| `maintenance_tickets` | 0 | ✅ Keep |
| `contractors` | 0 | ✅ Keep |
| `legal_notices` | 0 | ✅ Keep |
| `utility_bills` | 0 | ❌ Drop — unused, never will be used |
| `vendors` | 0 | ❌ Drop — unused, never will be used |
| `units` | 0 | ⚠️ Keep empty for now (see note below) |

---

## Dead columns by table

### `transactions` (1,729 rows)
All of these have **0 data** across all 1,729 rows. They were from the original FlutterFlow app before Gemini OCR was added. The `extracted_*` columns replaced them entirely.

| Column | Why dead | Replacement |
|---|---|---|
| `tenant_id` | Old FK, 0 data | `matched_tenant_id` |
| `case_number` | Old text field, 0 data | `extracted_case_number` |
| `amount` | Old decimal, 0 data | `extracted_amount` |
| `check_number` | Old text, 0 data | `extracted_check_number` |
| `receipt_image_url` | Old URL, 0 data | `source_pdf_url` + `file_path` |
| `ai_json` | Raw Gemini JSON — never stored | nothing (Gemini extracts and discards) |
| `ocr_raw_output` | Raw text — never stored | nothing |
| `type` | All NULL — never set | nothing (not needed) |
| `date` | = upload date = `created_at::date` | use `created_at` or `extracted_check_date` |

**What stays in transactions (the good columns):**
`id`, `created_at`, `status`, `status_changed_at`, `status_changed_by`,
`extracted_case_number`, `extracted_check_number`, `extracted_amount`, `extracted_check_date`,
`extracted_rent_from`, `extracted_rent_to`, `matched_tenant_id`,
`review_notes`, `reviewed_at`, `reviewed_by`,
`file_path`, `file_bucket`, `source_pdf_url`, `page_number`,
`duplicate_suspected`, `duplicate_reference_id`, `ocr_confidence`,
`source`, `created_by`, `processed_by`, `updated_by`, `deleted_at`

---

### `tenants` (6 rows)
All 6 rows have NULL for these columns. Never used, never populated.

| Column | Why dead |
|---|---|
| `lease_status` | Stale — shows "Active" even for `moved_out` tenants. Wrong data. Actual status is in `leases.status` |
| `current_balance` | Always NULL — balance is computed by `view_rent_ledger` |
| `legacy_id` | Migration artifact from FlutterFlow, 0 data |
| `household_members` | Never populated |
| `household_size` | Never populated |

**Also needs fixing:** `unit_id` is NULL for all tenants. This needs to be populated (by joining to leases).

**What stays in tenants:**
`id`, `name`, `full_legal_name`, `case_number`, `email`, `phone`,
`address`, `notes`, `status`, `unit_id` *(after populating)*,
`ssn_encrypted`, `state_id`, `created_at`, `updated_at`, `deleted_at`

---

### `properties` (7 rows)
All 7 rows have NULL for these. Never populated.

| Column | Why dead |
|---|---|
| `tenant_id` | Old FK from FlutterFlow, 0 data |
| `legacy_tenant_id` | Migration artifact, 0 data |
| `market_rent` | Never set, 0 data |
| `city_state_zip` | 0 data — city/state/zip were split into separate columns instead |

**Also needs fixing:** `status` = "Vacant" for ALL 7 units, even ones with active tenants. Needs to be "Occupied" for units with active leases.

**⚠️ Note on properties table structure:**
The `properties` table holds individual apartment **units** (not buildings). Each row is one unit, e.g. "8607 101ST ST - Unit 1R". This is how the original FlutterFlow app was designed. The `units` table is empty.
- 8607 101ST ST: Unit 1R (Abdullah, expired), Unit 1L (vacant), Unit 2R (Chameka), Unit 2L (Jean)
- 338 BEACH 84TH ST: Unit 1 (Angel), Unit 2 (vacant)
- 465 BEACH 43RD ST: Unit 1 (SOLD, inactive)

---

### `leases` (12 rows)

| Column | Why to remove |
|---|---|
| `notice_required_days` | All 12 rows = 30. Single constant, never varies. |

**Also needs fixing:** `unit_id` is NULL for all 12 leases. Since `property_id` already points to the unit, we can set `unit_id = property_id`.

---

## Data issues (not dead columns, but wrong data)

### 1. Transaction matching (1,729 rows unmatched)
Gemini extracted case numbers with leading zeros: `00038084283B-01`
Tenants table has: `38084283B-01`
**Fix:** `LTRIM(extracted_case_number, '0')` match → updates `matched_tenant_id`.
Once this runs, `view_court_ledger`, `view_rent_ledger`, and all ledger views will populate.

### 2. Property status all "Vacant"
- 8607 Unit 2R, 2L and 338 Unit 1 have active tenants → should be "Occupied"
- **Fix:** `UPDATE properties SET status = 'Occupied' WHERE EXISTS (active lease)`

### 3. Legal template bodies have wrong placeholder names
Current templates use `{{today_date}}`, `{{balance_owed}}`, `{{yearly_summary}}`
Workflow 4 fills: `{{notice_date}}`, `{{outstanding_balance}}`, `{{check_detail_list}}`
**Fix:** UPDATE all 4 template bodies (Section 10 of cleanup script)

### 4. Abdullah Ali's lease expired April 30
Most recent lease: 2025-05-01 → 2026-04-30, status=expired.
Needs either a renewal lease or month-to-month insert.
**Ask Sonu:** Is he renewing? New dates and rent?

---

## Views

| View | Status |
|---|---|
| `view_rent_ledger` | ✅ Works. Will show real data after tx match fix |
| `view_court_ledger` | ✅ Works. Shows 0 rows now (no matched txs yet) |
| `view_yearly_payments` | ✅ Works |
| `monthly_profit` | ✅ Works. 0 rows now (no verified txs yet) |
| `property_profit` | ⚠️ Missing `profit` column (income - expenses). Fix in Section 14 |
| `view_transactions_admin` | ✅ Works |
| `view_tenant_balances` | ⚠️ Only 2 cols (`tenant_id, total_paid`). Barely useful. Can drop after confirming nothing uses it. |
| `view_verified_transactions` | ✅ Works. 0 rows (no verified txs yet) |

---

## Cleanup order (run `supabase-cleanup.sql` section by section)

| Section | What | Risk |
|---|---|---|
| 1 | Diagnostics | Read-only ✅ |
| 2 | Drop 8 dead transaction columns | Low — all confirmed NULL |
| 3 | Drop `date` from transactions | Low — equals created_at for all rows |
| 4 | Mark system_errors resolved | Low |
| 5 | Drop 5 dead tenant columns | Low — all confirmed NULL |
| 6 | Drop 4 dead property columns | Low — all confirmed NULL |
| 7 | Drop `notice_required_days` from leases | Low |
| 8 | Populate `unit_id` in leases + tenants | Medium — data insert, verify after |
| 9 | Fix property status → Occupied/Vacant | Low |
| 10 | Update legal template bodies | Medium — UPDATE, verify after |
| 11 | Fix transaction matching (LTRIM) | Medium — 1,729 UPDATE, verify after |
| 12 | Mark duplicate transactions | Medium |
| 13 | Drop utility_bills + vendors | Low — confirmed empty |
| 14 | Fix property_profit view (add profit col) | Low |
| 15 | Final verification | Read-only ✅ |

**Do sections in order. Each section has a VERIFY query — read the result before moving to the next.**

---

## After cleanup: expected state

- Transactions: 9 fewer columns, ~1,700+ matched to tenants
- Tenants: 5 fewer columns, all have `unit_id` populated  
- Properties: 4 fewer columns, correct Occupied/Vacant status
- Legal templates: correct WF4 placeholders
- property_profit view: has actual profit column
- utility_bills + vendors: gone
- All ledger views: will show real balance data

**Note on trigger/view inspection:**
The service role key bypasses RLS for data operations, but Supabase's Management API (which returns trigger definitions and view SQL) requires a Personal Access Token (PAT from your account settings page), not the service role key. PostgREST doesn't expose `information_schema` externally.

**Section 0 of `supabase-cleanup.sql` solves this** — it runs the `information_schema` queries INSIDE the SQL Editor (where you have full database access), so you get trigger and view SQL before making any changes.
