# n8n Workflows — LandlordOS

n8n's role in this project has shrunk to **one job**: the PDF batch
upload/OCR pipeline. Everything else (daily overdue checks, legal notice
generation/sending, court-ledger PDF export) is native Next.js code now —
see `SCRATCHPAD.md` at the project root for the full picture of what moved
where and why.

The old WF3/WF4/WF5 workflows (and the pre-Postgres v1/v2 versions of WF1)
are kept in `../n8n-workflows-archive/` purely as historical reference —
**do not import them**, their logic has been superseded by native code or
folded into the current WF1.

---

## The one workflow that matters: WF1 — Batch PDF Processor

`WF1-batch-pdf-processor.json` — polls the local Postgres `landlordos` DB
every 15 minutes for `Transaction` rows with `status = 'uploaded'`, reads
the matching receipt PDF from local disk, runs it through Gemini OCR,
dedupes/matches it to a tenant, and inserts the real transaction row.

**How upload works end to end:**
1. The admin uploads a PDF on the `/upload` page in LandlordOS.
2. The Next.js app writes the file to `storage/receipts/<name>` on local
   disk (not Supabase Storage anymore) and inserts a placeholder
   `Transaction` row with `status='uploaded'`, `file_path`, `source_pdf_url`.
3. WF1's cron finds that row → OCR's the file → inserts real row(s) →
   deletes the placeholder → emails demo.landlord@example.com.

Every DB step in WF1 uses the Postgres node's **Execute Query** operation
with raw parameterized SQL (`$1`, `$2`, ... placeholders + a comma-separated
"Query Parameters" expression) — the old Supabase node's structured
filters/`fieldsUi` don't have a direct Postgres equivalent, and raw SQL is
the most stable option across n8n versions.

**Table names are case-sensitive PascalCase** in Postgres (`"Transaction"`,
`"Tenant"`, `"SystemError"`) because Prisma's schema doesn't `@@map` them to
snake_case. Every query in WF1 double-quotes them — don't let an editor or
a "helpful" reformat strip those quotes, the queries will break silently
(Postgres folds unquoted identifiers to lowercase, and there's no
`transaction` table, only `"Transaction"`).

---

## Setup checklist before activating WF1

### 1. Postgres credential
- In n8n → Credentials → New → **Postgres**
- Host: `localhost`, Port: `5432`, Database: `landlordos`
- Name it exactly: `LandlordOS Local Postgres`
- Open `WF1-batch-pdf-processor.json` in a text editor and replace every
  `REPLACE_WITH_LOCAL_POSTGRES_CREDENTIAL_ID` with this credential's real ID
  — or simpler, just import first and re-select the credential on each
  Postgres node when n8n prompts for it (it'll flag all 6 Postgres nodes).

### 2. Storage path environment variable
- In n8n → Settings → Environment Variables → add:
  - `LANDLORD_STORAGE_DIR` = absolute path to the app's `storage` folder
    (e.g. `C:\LandlordOS\landlord-os\storage`) — this **must** match wherever
    the Next.js app's `storage/` directory actually is on this machine.

### 3. Gemini API credential
- In n8n → Credentials → New → **Google Gemini (PaLM) API**
- API Key: from Google AI Studio

### 4. Gmail OAuth credential
- In n8n → Credentials → New → **Gmail OAuth2**
- Log in with **demo.landlord@example.com** (not the developer's personal email)
- Name it exactly: `Gmail — demo.landlord@example.com`

### 5. Import & activate
- Import `WF1-batch-pdf-processor.json` → fix credentials on all 6 Postgres
  nodes + Gemini + Gmail → Activate.

### 6. Test it
- Upload a small PDF on the LandlordOS `/upload` page.
- Check the `Transaction` table (via the app's `/transactions` page, or
  `psql`) — a row with `status='uploaded'` should appear.
- Wait up to 15 min for the cron, or manually trigger WF1 once in n8n.
- Confirm the row gets processed (`status` changes to `processing` or
  `needs_review`, and the placeholder row is gone).
