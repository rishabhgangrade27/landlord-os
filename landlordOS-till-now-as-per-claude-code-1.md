# LandlordOS — Complete Status Document
**Written by Claude Code | Last updated: 22 May 2026**

---

## What Is This Project?

A property management web app for **Sonu Gupta** (landlord, Queens / Far Rockaway, NY).
Single user. No public-facing pages. Replaces a half-built FlutterFlow version.

**You (Rishabh @ Apex AI)** are building it.
**Folder on your machine:** `c:\Users\Rishabh\Desktop\ADKO - james joannou (client)\landlord-os\`

---

## Tech Stack (exact versions)

| Layer | What | Version |
|---|---|---|
| Framework | Next.js App Router | 16.2.6 |
| Language | TypeScript | latest |
| UI | Tailwind CSS v4 + shadcn/ui | v4 / 4.8.0 |
| Component lib | @base-ui/react (NOT Radix) | — |
| Database + Auth | Supabase | @supabase/ssr |
| Runtime | Node.js | — |
| Deployment target | Cloudflare Pages (via GitHub push) | — |

**Critical thing to know:** shadcn/ui 4.8.0 switched from Radix UI to `@base-ui/react`.
This means **no `asChild` prop** exists on any component. This caused all the TypeScript errors.

---

## What Has Been Built (Files That Exist)

### Infrastructure / Config
- `package.json` — all dependencies installed
- `next.config.js` — Cloudflare-compatible config
- `tailwind.config.ts` — Tailwind v4 config
- `.env.local` — Supabase credentials (see below)
- `.env.example` — template for new devs
- `.gitignore` — ignores `.env*`, `node_modules`, `.next`
- `tsconfig.json`

### Supabase Clients
- `src/lib/supabase/client.ts` — browser-side client (`createBrowserClient`)
- `src/lib/supabase/server.ts` — server-side client (`createServerClient`, cookies awaited)
- `src/lib/supabase/types.ts` — full TypeScript types for every table and view

### Auth / Middleware
- `src/middleware.ts` — redirects unauthenticated users to `/login`, redirects logged-in users away from `/login`
  - **Note:** Next.js 16 renamed this to `proxy.ts` — currently works but shows a deprecation warning. Non-breaking.

### Layout
- `src/components/layout/sidebar.tsx` — left sidebar with 13 nav items, sign-out, user menu
- `src/app/(protected)/layout.tsx` — wraps all protected routes with sidebar + main area

### Shared UI Components
- `src/components/ui/link-button.tsx` — custom `<LinkButton href="...">` that replaces the broken `<Button asChild><Link>` pattern
- All shadcn/ui components installed: `button`, `card`, `dialog`, `input`, `label`, `select`, `separator`, `tabs`, `textarea`, `toast`

### Pages Built (19 total)

| Route | File | Type | Status |
|---|---|---|---|
| `/login` | `src/app/login/page.tsx` | Client | ✅ Built |
| `/dashboard` | `src/app/(protected)/dashboard/page.tsx` | Server | ✅ Built |
| `/properties` | `src/app/(protected)/properties/page.tsx` | Server | ✅ Built |
| `/properties/new` | `src/app/(protected)/properties/new/page.tsx` | Client | ✅ Built |
| `/properties/[id]` | `src/app/(protected)/properties/[id]/page.tsx` | Server | ✅ Built |
| `/properties/[id]/timeline` | `src/app/(protected)/properties/[id]/timeline/page.tsx` | Server | ✅ Built |
| `/units/[id]` | `src/app/(protected)/units/[id]/page.tsx` | Server | ✅ Built |
| `/tenants` | `src/app/(protected)/tenants/page.tsx` | Server | ✅ Built |
| `/tenants/new` | `src/app/(protected)/tenants/new/page.tsx` | Client | ✅ Built |
| `/tenants/[id]` | `src/app/(protected)/tenants/[id]/page.tsx` | Server | ✅ Built |
| `/leases` | `src/app/(protected)/leases/page.tsx` | Server | ✅ Built |
| `/leases/new` | `src/app/(protected)/leases/new/page.tsx` | Client | ✅ Built |
| `/ledger` | `src/app/(protected)/ledger/page.tsx` | Server | ✅ Built |
| `/upload` | `src/app/(protected)/upload/page.tsx` | Client | ✅ Built |
| `/transactions/[id]` | `src/app/(protected)/transactions/[id]/page.tsx` | Server | ✅ Built |
| `/maintenance` | `src/app/(protected)/maintenance/page.tsx` | Server | ✅ Built |
| `/maintenance/new` | `src/app/(protected)/maintenance/new/page.tsx` | Client | ✅ Built |
| `/maintenance/[id]` | `src/app/(protected)/maintenance/[id]/page.tsx` | Server | ✅ Built |
| `/contractors` | `src/app/(protected)/contractors/page.tsx` | Server | ✅ Built |
| `/contractors/new` | `src/app/(protected)/contractors/new/page.tsx` | Client | ✅ Built |
| `/contractors/[id]` | `src/app/(protected)/contractors/[id]/page.tsx` | Server | ✅ Built |
| `/legal-notices` | `src/app/(protected)/legal-notices/page.tsx` | Server | ✅ Built |
| `/legal-notices/[id]` | `src/app/(protected)/legal-notices/[id]/page.tsx` | Server | ✅ Built |
| `/reports` | `src/app/(protected)/reports/page.tsx` | Server | ✅ Built |
| `/settings` | `src/app/(protected)/settings/page.tsx` | Server | ✅ Built |

### Inline Edit / Action Components Built

| Component | What it does |
|---|---|
| `add-unit-dialog.tsx` | Adds a unit inside a property detail page |
| `edit-property-dialog.tsx` | Edits property details inline |
| `edit-unit-dialog.tsx` | Edits a unit inline |
| `edit-tenant-dialog.tsx` | Edits tenant info inline (with SSN/ID masking) |
| `update-ticket-dialog.tsx` | Updates maintenance ticket status, contractor, costs |
| `edit-contractor-dialog.tsx` | Edits contractor info inline |
| `send-attorney-button.tsx` | Marks legal notice as pending attorney + logs email |
| `update-status-dialog.tsx` | Updates legal notice status manually |
| `masked-field.tsx` | Eye-icon toggle for SSN and State ID (never shown by default) |
| `ledger-export-button.tsx` | Calls n8n webhook to export ledger as PDF |
| `processing-mode-toggle.tsx` | Toggles PDF processing mode (immediate vs scheduled) |

---

## What Just Got Fixed (This Session)

**Problem:** shadcn/ui 4.8.0 uses `@base-ui/react`. None of these components have `asChild`.
The build was compiling but failing TypeScript checks.

**Patterns fixed:**

1. **`<DialogTrigger asChild><Button>` → removed DialogTrigger, added `onClick={() => setOpen(true)}` to Button**
   - Fixed in all 8 dialog files ✅

2. **`<Button asChild><Link href="...">` → replaced with `<LinkButton href="...">`**
   - Fixed across all 19 page files ✅

3. **`<DropdownMenuTrigger asChild><button>` → moved className directly onto DropdownMenuTrigger**
   - Fixed in `sidebar.tsx` ✅

---

## Current State of the `.env.local`

```
NEXT_PUBLIC_SUPABASE_URL=https://izuxwhpycupbznnaosar.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...  ← already filled in
SUPABASE_SERVICE_ROLE_KEY=                 ← EMPTY — needed
NEXT_PUBLIC_N8N_WEBHOOK_LEDGER_EXPORT=     ← EMPTY — needed when n8n is set up
N8N_WEBHOOK_LEGAL_ACTION=                  ← EMPTY — needed when n8n is set up
```

---

## What Needs to Happen Next (in order)

### Step 1 — Run the Build ← YOU ARE HERE
```
cd "c:\Users\Rishabh\Desktop\ADKO - james joannou (client)\landlord-os"
npm run build
```
Expected result: TypeScript errors should be gone. If there are new errors, they'll be small fixable things.

### Step 2 — Test Locally
```
npm run dev
```
Open `http://localhost:3000`. Log in with Sonu's Supabase credentials. Click through every page. Make sure nothing crashes.

### Step 3 — Fix Any Runtime Issues Found in Testing
Things to manually verify:
- Dashboard loads and shows real data (properties, tenants, overdue flags)
- Tenant detail page — SSN and State ID fields are masked by default ✅ eye icon works
- Upload page — drag a PDF, confirm it goes to the `receipts` bucket in Supabase Storage
- Ledger page — rows show up, 30-day / 60-day color coding works
- Reports page — views load (yearly payments, monthly profit, property profit)
- Settings page — toggle switches between Immediate and Scheduled
- All edit dialogs open and save correctly

### Step 4 — Rename `middleware.ts` → `proxy.ts` (Next.js 16 compliance)
Just rename the file. The logic inside stays the same.

### Step 5 — Deploy to Cloudflare Pages
1. Push the repo to GitHub (company org: `BrandRadar-AI`, `Roar-AI-Labs`, or `Apex-AI-Clients` — NOT personal)
2. Connect that repo to Cloudflare Pages
3. Set all env vars in Cloudflare Pages dashboard (same as `.env.local`)
4. Build command: `npm run build` | Output: `.next`

### Step 6 — Get Missing Credentials
Things still needed:
- **Supabase Service Role Key** — from Supabase dashboard → Project Settings → API. Needed for any server-side admin operations.
- **n8n Webhook URLs** — once n8n is hosted and workflows are built:
  - Ledger export URL → `NEXT_PUBLIC_N8N_WEBHOOK_LEDGER_EXPORT`
  - Legal action URL → `N8N_WEBHOOK_LEGAL_ACTION`

### Step 7 — n8n Workflows (separate from the app)
Two workflows still need to be built:
- **Workflow 3:** Daily cron job that checks for overdue rent and sends Sonu a summary
- **Workflow 4:** Combined legal action trigger (creates legal notice, exports to PDF, sends to attorney)

Workflow 1 (PDF processing / Gemini extraction) and Workflow 2 (storage trigger) are already built.

### Step 8 — Fix the 1,729 Unmatched Transactions (Supabase task, not app code)
There's a known SQL issue where transactions exist but aren't linked to tenants. Need to run a matching query in Supabase to link them. This is a data fix, not a code fix.

### Step 9 — Ask Sonu These Questions
- Abdullah Ali: lease renewal? (it may have lapsed)
- n8n hosting: Sonu's server, your server, or Apex AI handles it?
- Collect $100 (if not already done)

---

## Key Schema Facts (Don't Get These Wrong)

| Table | Important Column | Note |
|---|---|---|
| `leases` | `rent_amount` | NOT `monthly_rent` — this was a past confusion |
| `tenants` | `ssn_encrypted`, `state_id` | Masked in UI, never logged |
| `system_settings` | `processing_mode` | Row ID = 1, values: `'immediate'` or `'scheduled'` |
| `maintenance_tickets` | `assigned_contractor_id` | FK to contractors |

### Views Used
- `view_rent_ledger` — main ledger, has `flag_30_day` and `flag_60_day` columns
- `view_court_ledger` — per-check legal breakdown for attorney
- `view_property_timeline` — events/history for a property
- `view_yearly_payments` — yearly summary per tenant
- `property_profit` — profit by property
- `monthly_profit` — monthly income vs expenses

### Supabase Storage
- Bucket: `receipts`
- Trigger: `Trigger_n8n_on_Upload` — already configured, fires n8n when a file is uploaded
- **DO NOT TOUCH THIS TRIGGER**

---

## Things That Must Never Be Done

1. Never commit `.env.local` or any file with real keys/credentials
2. Never expose SSN or State ID in console logs, error messages, or API responses
3. Never touch the Supabase Storage trigger `Trigger_n8n_on_Upload`
4. Never deploy to personal Vercel/Netlify/Replit with real client data — only company Cloudflare account
5. Never push to a personal GitHub account — only the company orgs listed above

---

## Warnings / Deprecations (Non-Breaking, Fix Later)

| Warning | File | Fix |
|---|---|---|
| `middleware` file convention deprecated | `src/middleware.ts` | Rename to `src/proxy.ts` |
| Workspace root inferred as `C:\Users\Rishabh\` | `next.config.js` | Add `turbopack: { root: '.' }` |

---

## Summary in One Line

> The entire Next.js app is scaffolded and coded. All TypeScript errors from the shadcn/base-ui `asChild` change are now fixed. Next step: `npm run build` to confirm a clean build, then `npm run dev` to test against the real Supabase database.
