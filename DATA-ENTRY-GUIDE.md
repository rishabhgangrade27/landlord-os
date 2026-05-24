# LandlordOS — Data Entry Guide (Fresh Start)

After running `cleanup.sql`, follow this exact order. FK constraints require it.

---

## Step 1 — Properties

Go to `/properties` → "Add Property"

Enter one record per property Sonu owns. Fields:
- **Name** — short label, e.g. "1234 Main St Unit 2B" or the building name
- **Address** — full street address
- **City / State / Zip**
- **Property Type** — e.g. residential, commercial
- **Status** — Vacant (default until tenant is added)
- **Nickname** — optional short name for display

---

## Step 2 — Tenants

Go to `/tenants` → "Add Tenant"

> ⚠️ **`case_number` is critical** — this is how WF1 (the OCR workflow) matches HRA check pages to the correct tenant. If it's wrong or missing, all payments for that tenant will land in `needs_review` unmatched.

Fields per tenant:
- **Name** — display name (e.g. "Abdullah Ali")
- **Full Legal Name** — as it appears on HRA checks / court documents
- **HRA Case Number** — exact format from the checks (e.g. "2024HRA12345"). Must match exactly.
- **Phone / Email / Address** — contact info
- **Status** — active (default)
- **SSN / State ID** — optional, shown masked in UI
- **Notes** — anything relevant

---

## Step 3 — Leases

Go to `/leases/new`

One lease per tenant. Fields:
- **Tenant** — select from dropdown
- **Property** — select the property they live in
- **Start Date** — lease start
- **End Date** — leave blank for month-to-month, or enter the end date
- **Monthly Rent** — exact amount in dollars (no commas)
- **Status** — active

> Note: In this system, each property row acts as a unit. `unit_id` is automatically set to the same value as `property_id` when you create a lease.

---

## Step 4 — Contractors (if any)

Go to `/contractors` → "Add Contractor"

Only add if you're tracking maintenance work with assigned contractors.

Fields: Name, Trade, Phone, Email, Address, Payment Method, Status, Notes

---

## Step 5 — Legal Templates (verify, don't re-enter)

`legal_templates` was **not wiped** in the cleanup. Go to Supabase SQL Editor and verify:

```sql
SELECT id, title, notice_type, is_active FROM legal_templates;
```

If templates are missing (e.g. the DB was freshly created), insert them manually in Supabase SQL Editor. Each template needs:
- `title` — e.g. "30-Day Non-Payment Notice"
- `notice_type` — one of: `non_payment_30day`, `non_payment_60day`, `notice_90day`, `court_form`
- `body` — the notice text with placeholders: `{{tenant_name}}`, `{{case_number}}`, `{{property_address}}`, `{{unit_number}}`, `{{monthly_rent}}`, `{{outstanding_balance}}`, `{{total_due}}`, `{{total_paid}}`, `{{period_start}}`, `{{period_end}}`, `{{check_detail_list}}`, `{{lease_start}}`, `{{lease_end}}`, `{{notice_date}}`
- `is_active` — true

---

## Step 6 — Import n8n Workflows

Import in this order in n8n:

### 1. Import WF1+2 (`n8n-workflow-1-2-batch-upload.json`)
The receipt processor. Import first, activate last (after testing).

After import, update credentials:
- **Supabase** credential → set your Supabase Project URL + Service Role Key
- **Google Gemini** credential → set your Gemini API key
- **Gmail** credential → authenticate with business.rishabhjgangrade@gmail.com

### 2. Import WF3 (`n8n-workflow-3-daily-overdue.json`)
The daily overdue cron. Import and set the same Supabase + Gmail credentials.

### 3. Import WF4 (`n8n-workflow-4-legal-action.json`)
The legal action webhook. Import and set the same Supabase + Gmail credentials.

> ⚠️ Do NOT activate WF3 or WF4 until Step 7 is complete (transactions data populated).

---

## Step 7 — Activate WF1 and Process PDFs

1. Activate WF1 in n8n (turn the toggle on)
2. Verify the Supabase storage trigger `Trigger_n8n_on_Upload` is active (check in Supabase → Database → Functions or Edge Functions — it's a storage trigger, do NOT modify it)
3. Go to `/upload` in the frontend
4. Drag and drop the receipt PDFs (HRA check PDFs) one batch at a time
5. After each batch: go to `/transactions` and check that rows are appearing
6. Each row will have a status of `processing`, `needs_review`, or `duplicate_suspected`

> The Supabase storage trigger fires automatically when a file is uploaded to the `receipts` bucket → calls the n8n webhook → Gemini OCR runs → results insert into `transactions` table.

---

## Step 8 — Review Transactions

Go to `/transactions` and work through the rows:

- **`processing`** — high confidence match to a tenant by case number. Spot-check these.
- **`needs_review`** — case number not matched or low confidence. Open each one, verify the data, correct if needed, then click "Verify" or "Reject".
- **`duplicate_suspected`** — same check/case/amount already exists. Confirm whether it's a real duplicate before rejecting.
- **`blank_detected`** — back of check, endorsement stub, blank page. These are expected; ignore or reject.

---

## Step 9 — Activate WF3 and WF4

Once transactions are populated and verified:

1. Activate **WF3** — it will run daily at 8 AM. On overdue tenants, it creates draft legal notices automatically.
2. Activate **WF4** — it responds to webhook calls from the frontend's legal notice pages (Generate / Send to Attorney / Mark Sent buttons).

---

## Verification After Full Setup

```sql
-- Should all show real data:
SELECT COUNT(*) FROM properties;
SELECT COUNT(*) FROM tenants;
SELECT COUNT(*) FROM leases;
SELECT COUNT(*) FROM transactions;

-- Check that transactions have tenant matches:
SELECT status, COUNT(*) FROM transactions GROUP BY status;

-- Unmatched transactions (case_number not in tenants):
SELECT COUNT(*) FROM transactions WHERE matched_tenant_id IS NULL AND status != 'blank_detected';
-- Aim for this to be 0 after review
```

---

## n8n Credential Checklist

| Credential | Where to get it |
|------------|----------------|
| Supabase Project URL | Supabase Dashboard → Project Settings → API → Project URL |
| Supabase Service Role Key | Supabase Dashboard → Project Settings → API → service_role key |
| Gemini API Key | Google AI Studio → Get API Key |
| Gmail OAuth | n8n credential UI → Google OAuth → authenticate with business.rishabhjgangrade@gmail.com |
| HTML2PDF API Key | Already hardcoded in WF1 node (`Id6o7gtmDrORw4Jo32Ko7ZE8NQ41yZJtTgJybfjQDeUtS8NGpS0b0ejVs8qOSz5F`) — move to n8n credential if you want it more secure |
