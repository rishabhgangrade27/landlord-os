# n8n Workflows v2 — LandlordOS

These are the corrected, production-ready workflow JSONs. Import these instead of the originals.

---

## Which workflows to import

| File | Import? | Notes |
|---|---|---|
| `WF1-batch-pdf-processor.json` | ✅ YES | Replaces original WF1+WF2 |
| `WF3-daily-overdue-cron.json` | ✅ YES | Replaces original WF3 |
| ~~WF4~~ | ❌ SKIP | Frontend `/api/generate-notice` handles everything WF4 did |

---

## WF1 — What changed from original

**Original problem:** Triggered by a FlutterFlow webhook. LandlordOS frontend is Next.js, not FlutterFlow — so the webhook was never called. Also, the email was going to Rishabh's Gmail, not Sonu's.

**New design:**
- Runs every 15 minutes on a schedule
- Polls Supabase for any `transactions` rows where `status = 'uploaded'`
- When it finds rows, it downloads the PDF from Supabase Storage → Gemini OCR → processes pages → inserts real transaction rows → deletes the original placeholder row
- Emails skg71885@gmail.com when processing is complete

**How upload works now (end to end):**
1. Sonu uploads a PDF on `/upload` page in LandlordOS
2. Frontend uploads file to Supabase Storage `receipts` bucket
3. Frontend inserts a placeholder `transactions` row with `status='uploaded'`, `file_path`, `source_pdf_url`
4. WF1 cron runs → finds that row → processes it → inserts real rows → deletes placeholder

---

## WF3 — Bugs fixed from original

1. **OR filter bug** — n8n Supabase node doesn't support PostgREST `or=()` syntax. Fixed by using HTTP Request node calling the REST API directly with correct URL: `?or=(flag_30_day.eq.true,flag_60_day.eq.true)`

2. **No dedup** — Original could create multiple draft notices for the same tenant in one run. Fixed with a Code node that deduplicates by `tenant_id` (60-day flag wins if both present).

3. **unit_number missing from view** — Original referenced `$json.unit_number` from `view_rent_ledger` but the view didn't expose that column. Now falls back to `'—'` gracefully. If you want the real unit shown, add `p.nickname as unit_number` to `view_rent_ledger` in Supabase.

4. **Notice dedup scope** — Added `created_at >= start of current month` filter to "Check Existing Notice" so the same tenant gets at most one notice per calendar month, not just "ever".

5. **Gmail credential** — Updated display name to `skg71885@gmail.com` (was `business.rishabhjgangrade@gmail.com` in original).

---

## Setup checklist before activating

### Step 1 — Supabase credential
- In n8n → Credentials → Create "Supabase" credential
- URL: `https://izuxwhpycupbznnaosar.supabase.co`
- Service Role Key: (get from Supabase Dashboard → Settings → API → service_role)

### Step 2 — Gemini API credential
- In n8n → Credentials → Create "Google Gemini (PaLM) API" credential
- API Key: (from Google AI Studio)

### Step 3 — Gmail OAuth credential
- In n8n → Credentials → Create "Gmail OAuth2" credential
- Log in with **skg71885@gmail.com** (not Rishabh's email)
- Name the credential exactly: `Gmail — skg71885@gmail.com`

### Step 4 — Environment variable (for WF3)
- In n8n → Settings → Environment Variables → add:
  - `SUPABASE_SERVICE_ROLE_KEY` = (same service role key as above)

### Step 5 — Import & activate
1. Import `WF1-batch-pdf-processor.json` → update credential IDs to match your new ones → Activate
2. Import `WF3-daily-overdue-cron.json` → update credential IDs → Activate
3. Do NOT import WF4

### Step 6 — Test WF1
- Upload a small PDF on the LandlordOS `/upload` page
- Check Supabase `transactions` table — a row with `status='uploaded'` should appear
- Either wait up to 15 min for the cron, or manually trigger WF1 once in n8n
- Check that the row gets processed (status changes to `processing` or `needs_review`)
