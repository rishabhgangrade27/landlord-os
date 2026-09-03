# Demo Sanitization Manifest

This branch (`demo-sanitized`) is a portfolio/interview-safe derivative of the real client project, which lives on `main` in this same repository, **untouched**. This file documents every change made to produce this branch, so it can be understood, audited, or reversed.

**How to get back to the real, unmodified project**: `git checkout main`. This branch shares no commit history with `main` (it was built as an orphan branch) specifically so that sanitizing it can never rewrite or expose anything about the real branch's history. Nothing described below has touched `main` or the real local database.

## SAN-001 — Client identity (code)

- **Location**: `src/components/layout/sidebar.tsx`, `src/lib/legal-notice.ts` (landlord signatory default), `src/app/layout.tsx` (page metadata description)
- **Original value**: the real client's full name, in three places.
- **Sanitized value**: `Demo Administrator` (UI/signatory), generic metadata description.
- **Type**: client identity replacement.
- **Reason**: primary de-branding requirement — a real individual's name should not appear in a portfolio demo.
- **Reversal**: `git checkout main -- src/components/layout/sidebar.tsx src/lib/legal-notice.ts src/app/layout.tsx`, or just switch to `main`.

## SAN-002 — Attorney & landlord-entity contact details (code)

- **Location**: `src/lib/legal-notice.ts` (both `getLandlordInfo()` branches + attorney fallback constants), `src/app/(protected)/settings/attorney-config-form.tsx` (input placeholder text).
- **Original value**: real attorney name/address/phone/email, two real landlord entity names + a real signatory name + real addresses/phone/email for each.
- **Sanitized value**: `Demo Law Offices, P.C.`, `RIVERSIDE HOLDINGS LLC` / `MEADOWBROOK PROPERTIES LLC`, `Alex Rivera`, `100/200/300 Example Ave/Blvd, Sample City, NY 10001`, `(555) 010-01xx/02xx/03xx`, `demo.landlord@example.com` / `demo.attorney@example.com`.
- **Type**: attorney/contact anonymization.
- **Reason**: these values are read into every legal-notice document the app generates — not confined to the Settings page, which is why code-level fallbacks needed sanitizing, not just a hidden Settings screen.
- **Reversal**: `git checkout main -- src/lib/legal-notice.ts src/app/(protected)/settings/attorney-config-form.tsx`.

## SAN-003 — Code comments naming the client

- **Location**: `src/lib/backup.ts` (2 comments), `src/lib/overdue-check.ts`, `src/app/api/generate-notice-docx/[id]/route.ts`, `src/app/(protected)/ledger/print/page.tsx`, `src/app/(protected)/legal-notices/[id]/page.tsx`.
- **Original value**: the client's first name, in internal code comments.
- **Sanitized value**: "the landlord" / "the client" / "the admin".
- **Type**: comment sanitization.
- **Reason**: a technical interviewer or portfolio viewer reads source comments — these count as "externally visible" for this purpose.
- **Reversal**: `git checkout main -- <listed files>`.

## SAN-004 — n8n workflow: real email address and node names

- **Location**: `n8n-workflows-v2/WF1-batch-pdf-processor.json` (node name `Email Sonu — Upload Complete` → `Email Admin — Upload Complete`, both the node definition and its connection reference; the internal `flow` description string), `n8n-workflows-v2/README.md` (client's real email, first name, and a comparison to the developer's personal email).
- **Sanitized value**: `demo.landlord@example.com`, generic node name, generic README wording.
- **Type**: branding/identity replacement in an automation config.
- **Reason**: same content otherwise renders identically for demo purposes; the workflow JSON was re-validated as parseable after the rename (a rename requires updating every reference to keep the workflow graph valid — done here).
- **Reversal**: `git checkout main -- n8n-workflows-v2/`.

## SAN-005 — Tenant PII (database)

- **Location**: `Tenant` table (name, full_legal_name, email, phone, address, ssn_encrypted, state_id, case_number, notes), `Transaction` table (extracted_case_number kept consistent with the sanitized tenant it matches; review_notes/reviewed_by/created_by/updated_by/status_changed_by/processed_by/source_pdf_url/file_path), `Property` (name/nickname/address/city/state/zip/created_by), `Contractor` (name/email/phone/address/notes), `LegalNotice` (rendered_text/admin_notes/attorney_email), `SystemSettings` (attorney_*), `Unit.notes`, `Lease.notes`, `MaintenanceTicket.description`, `pdf_jobs` (html_content/filename/pdf_url), `SystemError.raw_payload`, `LegalHistory.snapshot`.
- **Original value**: not reproduced here — see the real client database (`landlordos`, local Postgres), untouched by any of this.
- **Sanitized value**: sequential fictional values (`Sample Tenant 01`, `SAMPLE-0001`, synthetic SSN/state-ID patterns, `(555) 010-xxxx` phone numbers, `example.com` emails, `Sample City, NY 10001` addresses); all free-text notes/description fields replaced with a generic placeholder sentence regardless of original content, since free-text fields proved to contain real names/dates/events liberally (see "What went wrong" below).
- **Mechanism**: `prisma/anonymize-demo.sql` — run once against a **disposable copy** of the database (`landlordos_demo`, created via `pg_dump`/`psql`, never against the real `landlordos` database), then exported via `pg_dump --data-only` to `prisma/demo-seed.sql`, which is what's actually committed to this branch. The temporary `landlordos_demo` database was dropped after export — it does not persist on disk.
- **Reversal**: N/A at the database level — the real database was never touched; this only produced a new, separate, disposable dataset. To regenerate this seed differently, edit `prisma/anonymize-demo.sql` and re-run the create/clone/anonymize/export sequence documented at the top of that file's usage (clone real DB → demo DB → run script → `pg_dump --data-only` → seed file).
- **Row counts preserved exactly**: 15 tenants, 22 leases, 2600 transactions, 7 properties, 16 legal notices, 12 contractors — matching the real database, so the demo looks and behaves like a real, populated system.

## SAN-006 — Excluded entirely (not sanitized in place; removed from this branch)

Rather than line-editing dense internal documents for every possible identifying reference (error-prone, and these add no value to a code/architecture demo), the following are simply not present on this branch:

| Excluded | Why |
|---|---|
| `SCRATCHPAD.md`, `HANDOFF-STATUS.md`, `DB-WIPE-AND-N8N-PLAN.md`, `SUPABASE-ANALYSIS.md`, `DATA-ENTRY-GUIDE.md`, `n8n-vs-code-analysis.md`, `landlordOS-till-now-as-per-claude-code-1.md`, `AGENTS.md`, `CLAUDE.md`, `INSTALL-GUIDE.md`, `USAGE.md` | Internal engineering/ops narrative, dense with the client's name, real dollar figures, and tenant details throughout |
| Root-level `*.sql` one-off fix scripts (`cleanup.sql`, `drop-triggers.sql`, `SUPABASE-RUN-NOW.sql`, `supabase-*.sql`, `sql-fix-may24.sql`, `pdf-jobs-migration.sql`, `populate.sql`) | Historical Supabase-era data-repair scripts tied to specific real records; irrelevant to demonstrating the current architecture |
| `n8n-workflows-archive/` | Deprecated Supabase-era workflows, superseded, not part of the current system |
| `templates/legal-notices/*.docx` | These are **real** `.docx` files — the attorney's actual letterhead and address are baked into the document XML itself, not exposed via `{{placeholder}}` tags. A text/string sanitization pass does not reach this. |
| `scripts/download-buckets.ts`, `scripts/migrate-to-postgres.js`, `scripts/generate-notice-templates.js` | One-time Supabase-migration/template-generation tooling; `download-buckets.ts` in particular had a hardcoded Supabase service-role key in its history (see the note below) |
| `backups/`, `data-dumps/`, `storage/` | Real backup dumps and uploaded receipt files |

## What went wrong during sanitization (kept here deliberately, not swept under the rug)

1. **A hardcoded Supabase service-role key was found** in the working tree of `scripts/download-buckets.ts` (a fallback default, since removed in a separate fix committed to `main` before this branch was created). It is present in one historical commit on `main` (`190b702`) but has **never been pushed to `origin`/GitHub** — confirmed directly. This branch does not share that history (orphan branch) and does not include that file. **Action still needed from the project owner: rotate that key regardless**, since it was exposed in a local diff review during this process.
2. **The first anonymization run silently rolled back** (one wrong table name caused the whole transaction to abort), and a verification query right after mistakenly read the *unmodified* copy, printing several real tenant names and case numbers into the session that produced this branch. The real database was independently confirmed untouched throughout. Fixed and re-verified with a corrected script and a rigorous check (every real tenant name, pulled fresh from the database, grepped against the final output with zero matches) before this file was written.
3. **The first anonymization pass missed free-text fields** (`Lease.notes`, `pdf_jobs.filename`, `pdf_jobs.pdf_url`) that turned out to contain real tenant names, dates, and one live Supabase storage URL. Caught by the same rigorous re-verification step and fixed by blanket-genericizing every free-text notes/description column rather than trying to selectively judge which ones were "probably fine."

## Final verification performed before this branch was pushed

- `prisma/demo-seed.sql` grepped against every real tenant name/legal name pulled fresh from the live database: **zero matches**.
- Grepped for the client's name, the attorney's name, the real Supabase project reference, and a known real street name: **zero matches**.
- `n8n-workflows-v2/WF1-batch-pdf-processor.json` re-parsed as JSON after the node rename: **valid**.
- `npm run build`: see the final report for the result.
