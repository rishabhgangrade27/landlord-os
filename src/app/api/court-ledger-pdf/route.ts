import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// ─── Request shape ────────────────────────────────────────────────────────────

type CourtLedgerPdfRequest = {
  tenant_id: string
}

// ─── DB row types ─────────────────────────────────────────────────────────────

type TenantRow = {
  id: string
  name: string
  case_number: string | null
  notes: string | null
  address: string | null
}

type PropertyRow = {
  id: string
  name: string | null
  nickname: string | null
  address: string | null
}

type LeaseRow = {
  rent_amount: number
  start_date: string
  end_date: string | null
  status: string
  properties: PropertyRow | null
}

type CourtLedgerRow = {
  tenant_id: string
  ledger_month: string | null
  check_number: string | null
  check_date: string | null
  amount: number | null
}

type RentLedgerRow = {
  tenant_id: string
  month: string
  due_amount: number | null
  paid_amount: number | null
  pending_balance: number | null
}

// ─── Internal pivot types ─────────────────────────────────────────────────────

type CheckEntry = {
  amount: number
  check_number: string | null
  check_date: string | null
}

type MonthPivot = {
  monthKey: string   // YYYY-MM-DD (first of month)
  monthLabel: string // e.g. "January"
  yearLabel: string  // e.g. "2024"
  due: number
  checks: CheckEntry[] // up to 5 HRA checks
  paidByTenant: number
  balance: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function escHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function fmt(val: number): string {
  return `$${Math.abs(val).toFixed(2)}`
}

function balanceDisplay(bal: number): { text: string; color: string } {
  if (bal > 0) return { text: fmt(bal), color: '#cc0000' }      // owed — red
  if (bal < 0) return { text: `(${fmt(bal)})`, color: '#006600' } // credit — green
  return { text: '&mdash;', color: '#000000' }
}

// ─── HTML builder ─────────────────────────────────────────────────────────────

function buildHtml(params: {
  tenant: TenantRow
  lease: LeaseRow | null
  months: MonthPivot[]
  totals: {
    due: number
    hra: [number, number, number, number, number]
    paidByTenant: number
    balance: number
  }
}): string {
  const { tenant, lease, months, totals } = params

  const property = lease?.properties ?? null
  const tenantName = escHtml(tenant.name)
  const caseNum = escHtml(tenant.case_number ?? '—')
  const address = escHtml(
    property?.address ?? tenant.address ?? '—'
  )
  const unit = escHtml(property?.nickname ?? property?.name ?? '—')
  const notes = escHtml(tenant.notes ?? '—')
  const rentPerMonth = lease
    ? `$${Number(lease.rent_amount).toFixed(2)}/mo`
    : '—'
  const leaseStart = lease ? escHtml(lease.start_date) : '—'
  const leaseEnd = lease ? escHtml(lease.end_date ?? 'Ongoing') : '—'
  const leasePeriod = lease ? `${leaseStart} – ${leaseEnd}` : '—'

  const { text: totalBalText, color: totalBalColor } = balanceDisplay(
    totals.balance
  )

  // ── Tenant info table ──────────────────────────────────────────────────────

  const infoTable = `
  <table style="width:100%;border-collapse:collapse;margin-bottom:12px;font-size:10.5px">
    <tbody>
      <tr>
        <td style="font-weight:bold;padding:3px 6px;border:1px solid #000;width:120px">Name</td>
        <td style="padding:3px 6px;border:1px solid #000">${tenantName}</td>
        <td style="font-weight:bold;padding:3px 6px;border:1px solid #000;width:100px">Case #</td>
        <td style="padding:3px 6px;border:1px solid #000;font-family:monospace">${caseNum}</td>
      </tr>
      <tr>
        <td style="font-weight:bold;padding:3px 6px;border:1px solid #000">Other People / Unit</td>
        <td style="padding:3px 6px;border:1px solid #000">${unit}</td>
        <td style="font-weight:bold;padding:3px 6px;border:1px solid #000">Notes</td>
        <td style="padding:3px 6px;border:1px solid #000">${notes}</td>
      </tr>
      <tr>
        <td style="font-weight:bold;padding:3px 6px;border:1px solid #000">Address</td>
        <td style="padding:3px 6px;border:1px solid #000">${address}</td>
        <td style="font-weight:bold;padding:3px 6px;border:1px solid #000">Rent per month</td>
        <td style="padding:3px 6px;border:1px solid #000">${escHtml(rentPerMonth)}</td>
      </tr>
      <tr>
        <td style="font-weight:bold;padding:3px 6px;border:1px solid #000">Lease Period</td>
        <td style="padding:3px 6px;border:1px solid #000">${leasePeriod}</td>
        <td style="font-weight:bold;padding:3px 6px;border:1px solid #000">Balance</td>
        <td style="padding:3px 6px;border:1px solid #000;font-weight:bold;color:${totalBalColor}">${totalBalText}</td>
      </tr>
    </tbody>
  </table>`

  // ── Ledger rows ────────────────────────────────────────────────────────────

  const rowsHtml = months
    .map((m, idx) => {
      const bg = idx % 2 === 0 ? '#ffffff' : '#f5f5f5'
      const { text: balText, color: balColor } = balanceDisplay(m.balance)

      const hraCells = [0, 1, 2, 3, 4]
        .map((i) => {
          const c = m.checks[i]
          if (!c) return `<td style="border:1px solid #000;padding:3px 5px;text-align:right"></td>`
          const checkNum = c.check_number ? escHtml(c.check_number) : ''
          return `<td style="border:1px solid #000;padding:3px 5px;text-align:right">
            <div>${fmt(c.amount)}</div>
            ${checkNum ? `<div style="font-size:8.5px;color:#555;font-family:monospace">${checkNum}</div>` : ''}
          </td>`
        })
        .join('')

      const paidStr = m.paidByTenant > 0 ? fmt(m.paidByTenant) : ''

      return `<tr style="background:${bg};page-break-inside:avoid">
        <td style="border:1px solid #000;padding:3px 5px">${escHtml(m.monthLabel)}</td>
        <td style="border:1px solid #000;padding:3px 5px">${escHtml(m.yearLabel)}</td>
        <td style="border:1px solid #000;padding:3px 5px;text-align:right">${m.due > 0 ? fmt(m.due) : ''}</td>
        ${hraCells}
        <td style="border:1px solid #000;padding:3px 5px;text-align:right">${paidStr}</td>
        <td style="border:1px solid #000;padding:3px 5px;text-align:right;font-weight:bold;color:${balColor}">${balText}</td>
        <td style="border:1px solid #000;padding:3px 5px;font-size:9px"></td>
      </tr>`
    })
    .join('\n')

  // ── Totals row ─────────────────────────────────────────────────────────────

  const totalsHraCells = totals.hra
    .map(
      (v) =>
        `<td style="border:1px solid #000;padding:3px 5px;text-align:right;font-weight:bold">${v > 0 ? fmt(v) : '$0.00'}</td>`
    )
    .join('')

  const { text: finalBalText, color: finalBalColor } = balanceDisplay(
    totals.balance
  )

  const totalsRow = `<tr style="background:#e8e8e8;font-weight:bold">
    <td colspan="2" style="border:1px solid #000;padding:3px 5px">TOTAL</td>
    <td style="border:1px solid #000;padding:3px 5px;text-align:right">${fmt(totals.due)}</td>
    ${totalsHraCells}
    <td style="border:1px solid #000;padding:3px 5px;text-align:right">${totals.paidByTenant > 0 ? fmt(totals.paidByTenant) : '$0.00'}</td>
    <td style="border:1px solid #000;padding:3px 5px;text-align:right;color:${finalBalColor}">${finalBalText}</td>
    <td style="border:1px solid #000;padding:3px 5px"></td>
  </tr>`

  // ── Full document ──────────────────────────────────────────────────────────

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: Arial, sans-serif;
      font-size: 10.5px;
      color: #000;
      background: #fff;
      padding: 20px 24px;
      margin: 0;
    }
    table { border-collapse: collapse; }
    th, td { font-family: Arial, sans-serif; font-size: 10.5px; }
  </style>
</head>
<body>

  <div style="text-align:center;margin-bottom:14px">
    <div style="font-size:14px;font-weight:bold;letter-spacing:1px;text-transform:uppercase">Court Document</div>
  </div>

  ${infoTable}

  <table style="width:100%;font-size:10.5px">
    <thead>
      <tr style="background:#d0d0d0">
        <th style="border:1px solid #000;padding:3px 5px;text-align:left;white-space:nowrap">Month</th>
        <th style="border:1px solid #000;padding:3px 5px;text-align:left">Year</th>
        <th style="border:1px solid #000;padding:3px 5px;text-align:right">Due</th>
        <th style="border:1px solid #000;padding:3px 5px;text-align:center">HRA 1</th>
        <th style="border:1px solid #000;padding:3px 5px;text-align:center">HRA 2</th>
        <th style="border:1px solid #000;padding:3px 5px;text-align:center">HRA 3</th>
        <th style="border:1px solid #000;padding:3px 5px;text-align:center">HRA 4</th>
        <th style="border:1px solid #000;padding:3px 5px;text-align:center">HRA 5</th>
        <th style="border:1px solid #000;padding:3px 5px;text-align:right;white-space:nowrap">Paid By Tenant</th>
        <th style="border:1px solid #000;padding:3px 5px;text-align:right">Balance</th>
        <th style="border:1px solid #000;padding:3px 5px;text-align:left">Comment</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
    <tfoot>
      ${totalsRow}
    </tfoot>
  </table>

</body>
</html>`
}

// ─── POST handler ─────────────────────────────────────────────────────────────

export async function POST(request: Request): Promise<NextResponse> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: CourtLedgerPdfRequest
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { tenant_id } = body
  if (!tenant_id) {
    return NextResponse.json({ error: 'tenant_id is required' }, { status: 400 })
  }

  // ── Parallel data fetch ──────────────────────────────────────────────────────

  const [
    { data: tenant },
    { data: leaseRows },
    { data: courtLedger },
    { data: rentLedger },
  ] = await Promise.all([
    supabase
      .from('tenants')
      .select('id, name, case_number, notes, address')
      .eq('id', tenant_id)
      .single(),
    supabase
      .from('leases')
      .select('rent_amount, start_date, end_date, status, properties(id, name, nickname, address)')
      .eq('tenant_id', tenant_id)
      .order('start_date', { ascending: false })
      .limit(1),
    supabase
      .from('view_court_ledger')
      .select('*')
      .eq('tenant_id', tenant_id)
      .order('ledger_month')
      .order('check_date'),
    supabase
      .from('view_rent_ledger')
      .select('*')
      .eq('tenant_id', tenant_id)
      .order('month'),
  ])

  if (!tenant) {
    return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
  }

  const tenantRow = tenant as TenantRow
  const latestLease = leaseRows && leaseRows.length > 0
    ? (leaseRows[0] as unknown as LeaseRow)
    : null

  // ── Build HRA checks-by-month map ─────────────────────────────────────────

  const checksByMonth = new Map<string, CheckEntry[]>()
  for (const row of (courtLedger ?? []) as CourtLedgerRow[]) {
    const key = (row.ledger_month ?? '').slice(0, 10)
    if (!key) continue
    const amount = Number(row.amount ?? 0)
    if (amount <= 0) continue
    if (!checksByMonth.has(key)) checksByMonth.set(key, [])
    checksByMonth.get(key)!.push({
      amount,
      check_number: row.check_number,
      check_date: row.check_date,
    })
  }

  // ── Build monthly pivot from rent ledger ──────────────────────────────────

  const months: MonthPivot[] = ((rentLedger ?? []) as RentLedgerRow[]).map(
    (row) => {
      const monthKey = (row.month as string).slice(0, 10)
      const d = new Date(monthKey + 'T12:00:00')
      const monthLabel = d.toLocaleDateString('en-US', { month: 'long' })
      const yearLabel = String(d.getFullYear())

      const checks = checksByMonth.get(monthKey) ?? []
      const paidByTenant = Number(row.paid_amount ?? 0)
      const balance = Number(row.pending_balance ?? 0)

      return {
        monthKey,
        monthLabel,
        yearLabel,
        due: Number(row.due_amount ?? 0),
        checks,
        paidByTenant,
        balance,
      }
    }
  )

  // ── Compute totals ────────────────────────────────────────────────────────

  const totalDue = months.reduce((s, m) => s + m.due, 0)
  const totalHra: [number, number, number, number, number] = [0, 0, 0, 0, 0]
  for (const m of months) {
    for (let i = 0; i < 5; i++) {
      totalHra[i] += m.checks[i]?.amount ?? 0
    }
  }
  const totalPaidByTenant = months.reduce((s, m) => s + m.paidByTenant, 0)
  const latestBalance = months.at(-1)?.balance ?? 0

  // ── Generate HTML ─────────────────────────────────────────────────────────

  const generatedHtml = buildHtml({
    tenant: tenantRow,
    lease: latestLease,
    months,
    totals: {
      due: totalDue,
      hra: totalHra,
      paidByTenant: totalPaidByTenant,
      balance: latestBalance,
    },
  })

  // ── Insert pdf_jobs row ───────────────────────────────────────────────────

  const filename =
    'court_ledger_' +
    tenantRow.name.replace(/[^a-zA-Z0-9]/g, '_') +
    '_' +
    tenant_id.slice(0, 8)

  const { data: pdfJobRow, error: insertError } = await supabase
    .from('pdf_jobs')
    .insert({
      job_type: 'court_ledger',
      reference_id: tenant_id,
      html_content: generatedHtml,
      filename,
      status: 'pending',
    })
    .select('id')
    .single()

  if (insertError || !pdfJobRow) {
    return NextResponse.json(
      { error: insertError?.message ?? 'Failed to queue PDF job' },
      { status: 500 }
    )
  }

  return NextResponse.json({ job_id: pdfJobRow.id })
}
