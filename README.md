# PropertyOS Demo

A single-admin property-management app: per-tenant rent ledgers, lease/unit/property
management, maintenance tracking, and attorney-review legal-notice drafting for
overdue accounts.

**This is a sanitized portfolio/demo build of a real production system**, published
for architecture walkthroughs and interviews. Everything on this branch has been
de-branded and de-identified — no real names, addresses, or client data. See
[Demo limitations](#demo-limitations) below for what's intentionally turned off.

## Stack

- **Frontend:** Next.js (App Router), React, TypeScript, Tailwind, shadcn/ui
- **Backend:** Supabase (Postgres + Auth), row-level security
- **OCR pipeline (production only, disabled here):** Gemini for document extraction,
  orchestrated via n8n on a Supabase Storage trigger
- **Deploy:** Cloudflare Pages via `@opennextjs/cloudflare`

## Core features shown in this demo

- Dashboard with portfolio-level overdue/occupancy summary
- Properties → units → tenants → leases, with balance carried continuously across
  lease renewals (partitioned by tenant, not by lease)
- Rent ledger with monthly per-tenant balances
- Legal notice generation (14/30/90-day, court ledger) — **drafts only**, routed to
  one of several landlord-entity/attorney templates based on which property the
  tenant is in
- Maintenance ticket tracking

## Demo limitations

- **Upload Receipts is intentionally disabled.** In production, this page uploads
  scanned checks to storage where an automation pipeline (Gemini + n8n) parses them
  and inserts transactions automatically. That pipeline needs a live backend
  integration that isn't part of this public demo — the rest of the app runs
  against seeded sample data instead.
- All data in this environment is fictional, generated for demo purposes.

## Local development

```bash
npm install
npm run dev
```

Requires a Supabase project (Postgres + Auth) with this app's schema applied. Copy
`.env.example` to `.env.local` and fill in your own project's values.
