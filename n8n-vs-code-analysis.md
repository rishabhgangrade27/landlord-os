# Should We Replace n8n Workflows with Code?

**Written:** May 23, 2026  
**Context:** LandlordOS is deployed on Cloudflare Workers (via OpenNext). All 4 workflows are built in n8n. Question: can/should we move them into the codebase?

---

## The 4 Workflows

| # | Workflow | Trigger | What it does |
|---|---|---|---|
| 1 | PDF Ingestion + AI Extraction | Supabase Storage upload → webhook | Downloads PDF, splits pages, sends to Gemini, inserts rows into `transactions`, emails Sonu a summary |
| 2 | Ledger Export (PDF/Excel/CSV) | Frontend webhook call | Fetches tenant ledger data, generates export file, emails it to Sonu |
| 3 | Daily Overdue Cron | Cron (8 AM daily) | Queries `view_rent_ledger`, creates draft legal notices for 30/60-day overdue tenants, emails Sonu a summary |
| 4 | Combined Legal Action | Frontend webhook call | 3 branches: generate notice / send to attorney / mark as sent |

---

## Analysis Per Workflow

---

### WF1 — PDF Ingestion (KEEP in n8n or move to Supabase Edge Function)

**The chain:**
```
Supabase Storage upload
  → Supabase DB trigger (Trigger_n8n_on_Upload) fires HTTP POST to n8n webhook
    → n8n downloads PDF from Storage
      → Splits into pages (pdf-parse)
        → Each page → Gemini Flash 1.5 API (OCR + data extraction)
          → Inserts row into transactions table
            → After all pages done → sends summary email to Sonu
```

**Can we move it to code?**  
Yes, technically. But there are real trade-offs.

**Option A: Supabase Edge Function**
- Supabase has Edge Functions (Deno-based, runs serverless)
- Change the DB trigger to call a Supabase Edge Function URL instead of n8n
- The function downloads the PDF, splits it, calls Gemini, inserts rows
- Email via Resend (free tier: 3000/month)
- Cost: Supabase Edge Functions = free up to 2M invocations/month
- Gemini cost: same either way (~$0.001 per page at their Flash pricing)

**Challenges:**
- Supabase Edge Functions have a 150-second execution limit
- A 500-page PDF might time out — need chunking and async processing
- Currently n8n handles chunking + retry logic visually — easier to debug
- Error handling in code requires more boilerplate

**Option B: Next.js API Route on Cloudflare**
- Cloudflare Workers have a 30-second CPU limit (hard wall)
- 500-page PDFs would absolutely time out
- NOT suitable for WF1 without heavy architectural changes (queue-based processing)

**Verdict: KEEP WF1 in n8n for now.** The visual workflow, retry logic, and chunking support make n8n the right tool here. If n8n Cloud cost becomes an issue, migrate to a Supabase Edge Function — but not until Sonu's volume grows significantly.

---

### WF2 — Ledger Export (REPLACE with code — medium effort)

**The chain:**
```
Frontend button click (with tenant_id + format)
  → n8n webhook
    → Fetches view_rent_ledger + transactions from Supabase
      → Builds grouped monthly table
        → Generates PDF / Excel / CSV
          → Emails file to Sonu
```

**Can we move it to code?**  
Yes. This is the most natural fit for a Next.js API route.

**How:**
- Next.js API route: `POST /api/export-ledger`
- Frontend sends `{ tenant_id, format }` directly to the API
- API fetches data from Supabase using service role key (server-side)
- PDF: `@react-pdf/renderer` or `jsPDF` (already runs in Node/Edge)
- Excel: `exceljs` (might need streaming on Cloudflare due to memory limits)
- CSV: native string building — trivial
- Email: Resend API (free tier = 3000 emails/month)

**Cloudflare caveat:**  
Cloudflare Workers have a 128MB memory limit. Large Excel files (~1000+ rows) MIGHT hit this. For Sonu's scale (6 tenants, ~1729 transactions total), this is not a concern.

**Benefit:**  
- No n8n webhook to configure
- Live response — frontend can download the file directly instead of waiting for email
- One less moving part

**Effort:** ~4 hours  
**Monthly saving:** Part of $20/month n8n cost

**Verdict: REPLACE with code.** This is a clean API route. Zero reason to use n8n for this specifically.

---

### WF3 — Daily Overdue Cron (REPLACE with Cloudflare Cron Trigger)

**The chain:**
```
8 AM daily (cron)
  → Query view_rent_ledger for 30/60-day overdue tenants
    → For each flagged tenant: check if notice draft already exists this month
      → If not: insert draft into legal_notices
        → Send one summary email to Sonu (all flagged tenants, what drafts were created)
```

**Can we move it to code?**  
Yes. Cloudflare Workers has native Cron Triggers — built-in, free, and clean.

**How:**
- Add a `wrangler.jsonc` with cron trigger config:
  ```jsonc
  {
    "triggers": {
      "crons": ["0 8 * * *"]  // 8 AM UTC daily
    }
  }
  ```
- The Worker's `scheduled()` handler runs the logic
- Queries Supabase via REST API (service role key)
- Creates legal notice drafts
- Sends email via Resend

**Benefit:**
- Zero extra infra — it's already in Cloudflare
- No n8n subscription needed for this workflow
- Same reliable behavior

**Effort:** ~2 hours  
**Caveat:** The scheduled() handler is separate from the Next.js app — needs to be configured in the Cloudflare deployment config.

**Verdict: REPLACE with code.** Cloudflare Cron Trigger is literally designed for this.

---

### WF4 — Combined Legal Action (REPLACE with code — easiest)

**The chain (3 branches):**
```
Branch A (generate):   tenant_id + notice_type → fetch data → fill template → insert legal_notices → respond with notice_id
Branch B (attorney):   notice_id + attorney_email → validate → email attorney → update status → log
Branch C (mark sent):  notice_id + send_method → update status → log
```

**Can we move it to code?**  
Yes. This IS just an API with 3 endpoints. n8n is genuinely overkill here.

**How:**
- `POST /api/legal/generate` — Branch A
- `POST /api/legal/send-attorney` — Branch B  
- `POST /api/legal/mark-sent` — Branch C
- Frontend calls these directly (no webhook complexity)
- Email via Resend

**Benefit:**
- Frontend gets direct error responses (not async webhook)
- No webhook URL to configure or secure
- Type-safe request/response in TypeScript

**Effort:** ~3 hours  
**Verdict: REPLACE with code.** This should have been API routes from the start.

---

## Summary & Recommendation

| Workflow | Verdict | Effort | Reason |
|---|---|---|---|
| WF1 — PDF Ingestion | **Keep in n8n** (for now) | — | Timeout risk on Cloudflare Workers. n8n's visual retry/chunking is genuinely useful. Migrate to Supabase Edge Function when n8n cost becomes a pain. |
| WF2 — Ledger Export | **Replace with code** | ~4h | Clean API route. Direct download instead of email. No n8n added value. |
| WF3 — Daily Cron | **Replace with code** | ~2h | Cloudflare Cron Triggers are exact replacement. No extra cost. |
| WF4 — Legal Action | **Replace with code** | ~3h | These are literally just API endpoints. n8n adds zero value here. |

**If WF2, WF3, WF4 are replaced:** n8n only needs to run WF1 (PDF ingestion). At that point, a **self-hosted n8n on a $6/month VPS** (DigitalOcean) is cheaper than n8n Cloud ($20/month). Or use a Supabase Edge Function and eliminate n8n entirely.

**Monthly cost comparison:**
- Current (n8n Cloud): $20/month
- After replacing WF2+WF3+WF4 with code, self-host WF1 on VPS: ~$6/month
- After replacing ALL 4 (Supabase Edge Function for WF1): $0/month
- Resend email (free tier): 3000 emails/month — covers Sonu's volume easily

---

## What Should We Actually Do Right Now?

1. **Phase 1 (now):** Replace WF4 (Legal Action) with API routes — it's already broken because the webhook URL isn't configured. 3 hours of work, zero n8n dependency.

2. **Phase 2 (after Phase 1):** Replace WF2 (Ledger Export) with an API route — Sonu specifically asked for court-ready ledger exports. Making it a direct download (not email) is better UX.

3. **Phase 3 (later):** Add Cloudflare Cron Trigger for WF3. At that point, n8n only runs WF1.

4. **Phase 4 (optional):** Migrate WF1 to Supabase Edge Function. Kill n8n entirely. Save $6-20/month.

---

## One Important Caveat

n8n is currently not running at all — none of the 4 workflow JSONs have been imported to any n8n instance yet. Until n8n is set up, WF1 (PDF processing) doesn't work, meaning uploaded PDFs don't get processed.

**The real blocker for Sonu right now is WF1** — without it, he can't upload receipts and have them auto-processed. This is the workflow that MUST be set up first, whether in n8n or as a Supabase Edge Function.

Recommendation: Set up n8n Cloud (or a VPS), import WF1 and WF3, configure credentials. Then replace WF2 and WF4 with code (they're simpler and the code approach is better). This gives Sonu a working system immediately while we incrementally clean up the architecture.

---

*Last updated: May 23, 2026*  
*File lives at: `landlord-os/n8n-vs-code-analysis.md`*
