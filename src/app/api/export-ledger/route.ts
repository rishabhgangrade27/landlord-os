import { createClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'

// Uses service role key — bypasses RLS, safe on server only
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function safeCSV(v: unknown): string {
  if (v == null) return ''
  const s = String(v)
  return s.includes(',') || s.includes('"') || s.includes('\n')
    ? `"${s.replace(/"/g, '""')}"`
    : s
}

function fmt(n: unknown) {
  return `$${Number(n ?? 0).toFixed(2)}`
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const tenantId = searchParams.get('tenant_id')
  const format   = searchParams.get('format') ?? 'csv'   // 'csv' | 'json'
  const type     = searchParams.get('type')   ?? 'court'  // 'court' | 'summary'

  if (!tenantId) {
    return new Response('Missing tenant_id', { status: 400 })
  }

  const supabase = getSupabase()

  // ── Tenant info ──────────────────────────────────────────────────────────────
  const { data: tenant, error: tenantErr } = await supabase
    .from('tenants')
    .select('id, name, full_legal_name, case_number')
    .eq('id', tenantId)
    .single()

  if (tenantErr || !tenant) {
    return new Response('Tenant not found', { status: 404 })
  }

  // ── Ledger rows ──────────────────────────────────────────────────────────────
  let rows: Record<string, unknown>[] = []

  if (type === 'court') {
    const { data } = await supabase
      .from('view_court_ledger')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('ledger_month')
      .order('check_date')
    rows = data ?? []
  } else {
    const { data } = await supabase
      .from('view_rent_ledger')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('month', { ascending: false })
    rows = data ?? []
  }

  // ── JSON (for client-side PDF) ───────────────────────────────────────────────
  if (format === 'json') {
    return Response.json({ tenant, rows, type })
  }

  // ── CSV ──────────────────────────────────────────────────────────────────────
  const exportDate = new Date().toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  })

  let lines: string[]

  if (type === 'court') {
    lines = [
      safeCSV(`Court Ledger — ${tenant.name} (${tenant.full_legal_name ?? ''})`),
      safeCSV(`HRA Case Number: ${tenant.case_number ?? '—'}`),
      safeCSV(`Exported: ${exportDate}`),
      '',
      'Month,Check Number,Check Date,Amount Received,Monthly Rent Due,Running Balance',
      ...rows.map((r) =>
        [
          safeCSV(r.month_label),
          safeCSV(r.check_number),
          safeCSV(r.check_date),
          safeCSV(fmt(r.amount)),
          safeCSV(fmt(r.monthly_due)),
          safeCSV(fmt(r.running_balance)),
        ].join(',')
      ),
    ]
  } else {
    lines = [
      safeCSV(`Rent Ledger — ${tenant.name}`),
      safeCSV(`Exported: ${exportDate}`),
      '',
      'Month,Due,Paid,Balance,30-Day Overdue,60-Day Overdue',
      ...rows.map((r) => {
        const month = r.month
          ? new Date(String(r.month)).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
          : ''
        return [
          safeCSV(month),
          safeCSV(fmt(r.due_amount)),
          safeCSV(fmt(r.paid_amount)),
          safeCSV(fmt(r.pending_balance)),
          safeCSV(r.flag_30_day ? 'Yes' : ''),
          safeCSV(r.flag_60_day ? 'Yes' : ''),
        ].join(',')
      }),
    ]
  }

  const csv = lines.join('\r\n')
  const slug = tenant.name.replace(/[^a-z0-9]/gi, '-').toLowerCase()
  const filename = `${type === 'court' ? 'court-ledger' : 'rent-ledger'}-${slug}.csv`

  return new Response('﻿' + csv, {   // BOM so Excel opens UTF-8 correctly
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
