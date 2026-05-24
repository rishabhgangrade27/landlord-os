# Plan: DB Wipe + n8n Workflow Audit & Fix

## Context
The current database has messy/test data across all tables — transactions were processed through Gemini OCR but came out unclean/misclassified. User wants a complete fresh start: wipe all tables, then re-enter properties/tenants/leases manually and re-process all PDF receipts through n8n WF1 to get clean transaction data. Alongside this, the 3 n8n workflow JSON files need fixes before they're imported and used in production.

---

## Part A — Frontend ↔ Database Full Map

### Tables (all used by frontend)

| Table | Key Columns |
|-------|------------|
| `properties` | id, name, address, city, state, zip, property_type, status, nickname |
| `tenants` | id, name, full_legal_name, case_number, phone, email, status, address, household_size, ssn_encrypted, state_id, notes, unit_id |
| `leases` | id, tenant_id, property_id, unit_id, start_date, end_date, rent_amount, status, notes |
| `units` | id, unit_number, status, property_id, floor, bedrooms, bathrooms, notes — *effectively unused; unit_id = property_id in this system* |
| `transactions` | id, extracted_case_number, extracted_check_number, extracted_amount, extracted_check_date, extracted_rent_from, extracted_rent_to, status, duplicate_suspected, duplicate_reference_id, ocr_confidence, matched_tenant_id, created_at, file_bucket, file_path, page_number, source_pdf_url, review_notes, reviewed_by, reviewed_at, created_by |
| `maintenance_tickets` | id, title, category, priority, status, estimated_cost, actual_cost, cost_approved, description, created_at, unit_id, assigned_contractor_id |
| `contractors` | id, name, trade, status, phone, email, address, payment_method, notes |
| `legal_notices` | id, tenant_id, unit_id, property_id, lease_id, notice_type, status, generated_at, sent_at, attorney_email, admin_notes, rendered_text, reference_id, send_method |
| `expenses` | id, property_id, unit_id, category, description, amount, expense_date |
| `system_settings` | id, processing_mode |
| `legal_templates` | id, title, body, notice_type, is_active |
| `legal_history` | id, notice_id, entity_type, entity_id, action, notice_type, reference_id, snapshot, occurred_at — *referenced by WF4; verify exists* |
| `system_errors` | id, + error fields — *referenced by WF1; verify exists* |

### Views (computed — no data to wipe)

| View | Columns Used |
|------|-------------|
| `view_rent_ledger` | tenant_id, unit_id, month, pending_balance, due_amount, paid_amount, flag_30_day, flag_60_day (frontend) + tenant_name, unit_number, property_id, balance (n8n) |
| `view_yearly_payments` | tenant_id, year, total_due, total_paid, total_balance |
| `view_court_ledger` | tenant_id, ledger_month, month_label, check_number, check_date, amount, monthly_due, running_balance |
| `property_profit` | property_name, address, income, expenses, profit |
| `monthly_profit` | month, income, expenses, profit |
| `view_property_timeline` | property_id, unit_number, tenant_name, start_date, end_date, rent_amount, status |

### Storage
- **Bucket**: `receipts` — uploaded PDF/image files
- Do NOT delete the bucket itself; only table data gets wiped. Optionally delete the files inside if re-uploading all PDFs fresh.

---

## Part B — Data Wipe Order

Delete in this exact order to avoid FK constraint errors. Run in **Supabase SQL Editor**:

```sql
-- Step 1: Audit/child tables first
TRUNCATE TABLE legal_history RESTART IDENTITY CASCADE;
TRUNCATE TABLE system_errors RESTART IDENTITY CASCADE;

-- Step 2: Dependent records
TRUNCATE TABLE legal_notices RESTART IDENTITY CASCADE;
TRUNCATE TABLE transactions RESTART IDENTITY CASCADE;
TRUNCATE TABLE maintenance_tickets RESTART IDENTITY CASCADE;
TRUNCATE TABLE expenses RESTART IDENTITY CASCADE;

-- Step 3: Core junction / leaf records
TRUNCATE TABLE leases RESTART IDENTITY CASCADE;
TRUNCATE TABLE tenants RESTART IDENTITY CASCADE;
TRUNCATE TABLE contractors RESTART IDENTITY CASCADE;
TRUNCATE TABLE units RESTART IDENTITY CASCADE;

-- Step 4: Root records
TRUNCATE TABLE properties RESTART IDENTITY CASCADE;

-- DO NOT TRUNCATE: system_settings, legal_templates
-- These hold config and notice templates needed for the system to work.
```

> ⚠️ If `legal_history` or `system_errors` don't exist yet in your DB, skip those two lines — they'll be created in Part C first.

---

## Part C — Schema Fixes Required in Supabase

Before importing n8n workflows, verify these two tables exist. Create any that are missing via Supabase SQL Editor.

### 1. `system_errors` table (referenced in WF1 error-logging node)

```sql
CREATE TABLE IF NOT EXISTS system_errors (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_name text,
  error_message text,
  error_data jsonb,
  occurred_at timestamptz DEFAULT now()
);
```

### 2. `legal_history` table (referenced in WF4 audit trail)

```sql
CREATE TABLE IF NOT EXISTS legal_history (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  notice_id uuid REFERENCES legal_notices(id) ON DELETE SET NULL,
  entity_type text,
  entity_id uuid,
  action text NOT NULL,
  notice_type text,
  reference_id text,
  snapshot jsonb,
  occurred_at timestamptz DEFAULT now()
);
```

### 3. Verify `view_rent_ledger` has all needed columns

n8n WF3 reads `property_id` and `tenant_name` from this view. Run this to check:

```sql
SELECT * FROM view_rent_ledger LIMIT 1;
```

If `property_id` or `tenant_name` columns are missing, the view SQL needs to be updated to include them via the leases/tenants join. Flag this for fixing before activating WF3.

---

## Part D — n8n Workflow Changes

Three workflow files need edits. Use the files in `landlord-os/` (not the `landlord-os-files/` copies — those are older):

- `landlord-os/n8n-workflow-1-2-batch-upload.json`
- `landlord-os/n8n-workflow-3-daily-overdue.json`
- `landlord-os/n8n-workflow-4-legal-action.json`

---

### WF1 — Batch PDF Upload & Processing

**Change 1: Notification email recipient**
- Find the Gmail/Send Email node that sends the processing summary after OCR
- Change `to` email: `business.rishabhjgangrade@gmail.com` → `skg71885@gmail.com`
- The Gmail credential (sender) stays as `business.rishabhjgangrade@gmail.com`

**Change 2: Gemini model name (verify)**
- Current model: `models/gemini-3-flash-preview`
- If this model is deprecated or unavailable, update to: `models/gemini-2.0-flash` (stable)
- Check in the HTTP Request node that calls the Gemini API

**No structural changes needed** — the fields inserted into `transactions` match the frontend schema exactly:
`extracted_case_number`, `extracted_check_number`, `extracted_amount`, `extracted_check_date`, `extracted_rent_from`, `extracted_rent_to`, `page_number`, `matched_tenant_id`, `duplicate_suspected`, `duplicate_reference_id`, `status`, `ocr_confidence`, `source_pdf_url`, `file_bucket`, `file_path`, `created_by`

---

### WF3 — Daily Overdue Cron

**Change 1: Fix the overdue flag filter — critical bug**

Current Supabase HTTP GET URL query params:
```
flag_30_day=eq.true&flag_60_day=eq.true
```
This is an AND — only catches tenants who are **both** 30-day AND 60-day overdue (misses tenants who are only 30 days overdue).

Fix — change the query params to use PostgREST OR syntax:
```
or=(flag_30_day.eq.true,flag_60_day.eq.true)
```
Remove the two separate `flag_30_day` and `flag_60_day` params; replace with the single `or` param above.

**Change 2: Handle `property_id` in legal_notices insert**
- The insert into `legal_notices` uses `property_id` pulled from the ledger row
- If `view_rent_ledger` doesn't expose `property_id` (per Part C Step 3), this will insert null
- After confirming view has `property_id`, no code change needed
- If not, set `property_id` field to null in the insert (make it optional) until view is fixed

No email changes needed — WF3 already correctly sends to `skg71885@gmail.com`.

---

### WF4 — Combined Legal Action

**Change 1: Fix `unit_number` reference in "Code — Fill Template" node**

Current code in the node:
```javascript
.replace(/{{unit_number}}/g, lease.unit_number || '—')
```

Problem: `leases` table has no `unit_number` column. The lease only has `unit_id` (which equals `property_id` in this system).

Fix Step A — Update the "Fetch Active Lease" Supabase HTTP node to join properties:
- Change its `select` query param from `*` to `*,properties(name,address)`

Fix Step B — In the "Code — Fill Template" node, change the unit_number line to:
```javascript
.replace(/{{unit_number}}/g, lease.properties?.name || lease.properties?.address || '—')
```

This way `{{unit_number}}` in the legal notice template will show the property name instead of being blank.

**Change 2: `legal_history` table must exist before WF4 is activated**
- WF4 inserts to `legal_history` on every `send_attorney` and `mark_sent` action
- Create the table per Part C Step 2 before activating this workflow

No email changes needed — WF4 already CCs `skg71885@gmail.com`.

---

## Part E — Re-data-entry Order After Wipe

Once the DB is clean and workflows are ready, populate in this order (FK constraints require this sequence):

1. **Properties** → `/properties` → "Add Property" for each property Sonu owns
2. **Tenants** → `/tenants` → "Add Tenant" for each tenant — `case_number` is critical (used by WF1 for OCR tenant matching)
3. **Leases** → `/leases/new` for each tenant, linked to the correct property
4. **Contractors** → `/contractors` if any maintenance contractors are used
5. **Legal Templates** → verify templates still exist (they were preserved); add new ones via Supabase SQL Editor if needed
6. **Activate n8n WF1** → import + configure Supabase credential + activate
7. **Re-upload all PDFs** → go to `/upload`, drag-drop receipt PDFs → Supabase storage trigger fires → WF1 processes via Gemini → `transactions` table populates with clean, classified data

---

## Part F — Verification Checklist

### Schema
- [ ] `system_errors` table exists (`SELECT COUNT(*) FROM system_errors`)
- [ ] `legal_history` table exists (`SELECT COUNT(*) FROM legal_history`)
- [ ] `view_rent_ledger` returns `property_id` and `tenant_name` columns

### Data wipe confirmation
- [ ] `SELECT COUNT(*) FROM transactions` → 0
- [ ] `SELECT COUNT(*) FROM properties` → 0
- [ ] `SELECT COUNT(*) FROM tenants` → 0
- [ ] `SELECT COUNT(*) FROM leases` → 0
- [ ] `SELECT COUNT(*) FROM legal_notices` → 0
- [ ] `SELECT COUNT(*) FROM system_settings` → 1 (preserved)
- [ ] `SELECT COUNT(*) FROM legal_templates` → > 0 (preserved)

### n8n workflow tests (after import into n8n + credentials set up)
- [ ] **WF1**: Upload a test PDF → check `transactions` table gets a new row with correct fields → check `skg71885@gmail.com` receives summary email
- [ ] **WF3**: Manually trigger (or wait for 8 AM) → after adding test tenant with overdue rent, check `legal_notices` gets a draft row
- [ ] **WF4**: POST to the `/legal-action` webhook with `action: "generate"` and a valid `notice_id` → check `legal_notices` gets `rendered_text` populated

### Frontend smoke test (after re-entering data)
- [ ] `/dashboard` shows correct property/tenant/lease counts
- [ ] `/ledger` shows rent ledger rows once transactions are processed
- [ ] `/tenants/[id]` → Court Ledger tab shows check history
- [ ] `/reports` shows yearly payment summary

---

## n8n Credential Setup (reminder)

When importing workflows into n8n, you'll need to re-link these credentials:
- **Supabase** credential — Supabase project URL + Service Role Key
- **Google Gemini** credential — Gemini API key
- **Gmail** credential — business.rishabhjgangrade@gmail.com OAuth
- **HTML2PDF** — API key (currently hardcoded in WF1 HTTP node; consider moving to n8n credential)
