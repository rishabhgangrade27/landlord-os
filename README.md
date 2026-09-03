# LandlordOS (Demo)

This is a **sanitized, portfolio-safe branch** of a real production application built for a private client. It exists for architecture walkthroughs, technical interviews, and portfolio demonstrations — not for production use.

Property management app for a single-landlord rental portfolio: rent ledger with a continuous per-tenant balance across lease renewals, automated overdue detection, legal-notice drafting (draft-only, human review required before anything is sent), receipt/OCR ingestion, and reporting. Local-first architecture: Next.js + local PostgreSQL, no cloud database, no Docker.

**What's different from the real client branch**: client identity, tenant PII, attorney/landlord contact details, and one credentials-handling script have been replaced with fictional placeholders or excluded outright. See [`DEMO_SANITIZATION_MANIFEST.md`](./DEMO_SANITIZATION_MANIFEST.md) for the exact list of changes and how to restore the original state (this branch is separate from `main` — the original client branch is untouched).

## Stack

Next.js 16 (App Router) + React 19 + TypeScript + Prisma 6 + local PostgreSQL + local password auth (bcrypt + JWT session cookie). One n8n workflow handles batch PDF/OCR ingestion via Gemini; everything else (overdue detection, legal-notice drafting, backups) runs as native Next.js code triggered by OS-level scheduled tasks rather than a workflow engine.

## Notable architecture points

- **The rent ledger is a hand-written Postgres view**, not application code — a window function computes a running per-tenant balance across all of a tenant's leases (`prisma/views.sql`). Prisma has no concept of database views, so this view is applied by a standalone script (`scripts/apply-views.js`) outside the normal migration flow — worth knowing before running `prisma db push` on a fresh database.
- **Legal notices are drafted only, never sent automatically** — every write path for a notice record only ever produces a draft/generated status; sending is a manual, human step.
- **Sensitive fields (SSN, state ID) are never sent to the client in their raw form** on initial page load — they're masked server-side and only fetched via an authenticated server action on explicit user action.

## Local dev setup

1. Copy `.env.example` to `.env.local` and fill in values.
2. Install PostgreSQL locally, create a database, and load the sanitized demo dataset:
   ```bash
   createdb landlordos_demo
   psql landlordos_demo < prisma/demo-seed.sql
   ```
3. ```bash
   npm install
   npx prisma db push
   node scripts/apply-views.js   # Prisma doesn't create SQL views — don't skip this
   npm run dev
   ```

## What's excluded from this branch

Internal engineering logs, one-off historical SQL fix scripts, real legal-notice `.docx` templates (they contain a real attorney's letterhead text, not just placeholders), and Supabase-era one-time migration scripts. None of these affect the running application shown above — see the manifest for the full list and rationale.
