import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

type QueueCourtPdfRequest = {
  tenant_id: string
}

type CheckEntry = {
  check_number: string | null
  amount: number
  check_date: string | null
}

type MonthRow = {
  month: string
  month_label: string
  due: number
  checks: CheckEntry[]
  balance: number
  isVacant?: boolean
}

type LeaseRow = {
  rent_amount: number
  start_date: string
  end_date: string | null
  status: string
  properties: {
    id: string
    name: string | null
    nickname: string | null
    address: string | null
  } | null
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

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function fmt(val: number): string {
  return `$${val.toFixed(2)}`
}

function buildHtml(params: {
  tenant: { name: string; full_legal_name: string | null; case_number: string | null }
  property: { address: string | null; nickname: string | null; name: string | null } | null
  activeLease: LeaseRow | null
  allLeases: LeaseRow[]
  months: MonthRow[]
  latestBalance: number
  totalDue: number
  totalsByCol: number[]
  printDate: string
}): string {
  const {
    tenant,
    property,
    activeLease,
    allLeases,
    months,
    latestBalance,
    totalDue,
    totalsByCol,
    printDate,
  } = params

  const tenantDisplay = escapeHtml(
    tenant.name +
      (tenant.full_legal_name && tenant.full_legal_name !== tenant.name
        ? ` / ${tenant.full_legal_name}`
        : '')
  )
  const caseNum = escapeHtml(tenant.case_number ?? '—')
  const address = escapeHtml(property?.address ?? '—')
  const unit = escapeHtml(property?.nickname ?? property?.name ?? '—')
  const monthlyRent = `$${Number(activeLease?.rent_amount ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
  const balanceDisplay =
    latestBalance > 0
      ? `${fmt(latestBalance)} OWED`
      : latestBalance < 0
      ? `(${fmt(Math.abs(latestBalance))}) CREDIT`
      : '$0.00'

  const leasePeriods = allLeases
    .map(
      (l) =>
        `${escapeHtml(l.start_date)} &ndash; ${escapeHtml(l.end_date ?? 'Ongoing')} ($${Number(l.rent_amount).toLocaleString()}/mo)`
    )
    .join(' | ')

  // Build table rows HTML
  const rowsHtml = months
    .map((m, idx) => {
      const parts = m.month_label.split(' ')
      const monthStr = escapeHtml(parts[0] ?? '')
      const yearStr = escapeHtml(parts[1] ?? '')
      const checks = m.checks.slice(0, 5)
      const totalReceived = checks.reduce((s, c) => s + c.amount, 0)
      const allCheckNums = checks
        .map((c) => c.check_number)
        .filter(Boolean)
        .join(', ')
      const bal = m.balance

      if (m.isVacant) {
        return `<tr style="background:#f5f5f5;page-break-inside:avoid">
          <td style="border:1px solid #000;padding:2pt 4pt;color:#888;font-size:7.5pt">${monthStr}</td>
          <td style="border:1px solid #000;padding:2pt 4pt;color:#888;font-size:7.5pt">${yearStr}</td>
          <td colspan="10" style="border:1px solid #000;padding:2pt 4pt;color:#888;font-style:italic;font-size:7.5pt">&mdash; Vacant &mdash;</td>
        </tr>`
      }

      const rowBg = idx % 2 === 0 ? '#fff' : '#fafafa'
      const balStr =
        bal > 0 ? fmt(bal) : bal < 0 ? `(${fmt(Math.abs(bal))})` : '&mdash;'

      return `<tr style="background:${rowBg};page-break-inside:avoid">
        <td style="border:1px solid #000;padding:2pt 4pt">${monthStr}</td>
        <td style="border:1px solid #000;padding:2pt 4pt">${yearStr}</td>
        <td style="border:1px solid #000;padding:2pt 4pt;text-align:right">${m.due > 0 ? fmt(m.due) : ''}</td>
        <td style="border:1px solid #000;padding:2pt 4pt;text-align:right">${checks[0] ? fmt(checks[0].amount) : ''}</td>
        <td style="border:1px solid #000;padding:2pt 4pt;text-align:center;font-family:monospace;font-size:7.5pt">${escapeHtml(allCheckNums)}</td>
        <td style="border:1px solid #000;padding:2pt 4pt;text-align:right">${checks[1] ? fmt(checks[1].amount) : ''}</td>
        <td style="border:1px solid #000;padding:2pt 4pt;text-align:right">${checks[2] ? fmt(checks[2].amount) : ''}</td>
        <td style="border:1px solid #000;padding:2pt 4pt;text-align:right">${checks[3] ? fmt(checks[3].amount) : ''}</td>
        <td style="border:1px solid #000;padding:2pt 4pt;text-align:right">${checks[4] ? fmt(checks[4].amount) : ''}</td>
        <td style="border:1px solid #000;padding:2pt 4pt"></td>
        <td style="border:1px solid #000;padding:2pt 4pt;text-align:right;font-weight:bold">${balStr}</td>
        <td style="border:1px solid #000;padding:2pt 4pt;font-size:7.5pt">${totalReceived === 0 && m.due > 0 ? 'No payment received' : ''}</td>
      </tr>`
    })
    .join('\n')

  const totalBalStr =
    latestBalance > 0
      ? fmt(latestBalance)
      : latestBalance < 0
      ? `(${fmt(Math.abs(latestBalance))})`
      : '$0.00'

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; font-size: 10pt; color: #000; background: #fff; padding: 18pt 22pt; margin: 0; }
    table { border-collapse: collapse; }
    th, td { font-family: Arial, sans-serif; }
  </style>
</head>
<body>

  <div style="text-align:center;margin-bottom:10pt">
    <div style="font-size:13pt;font-weight:bold;letter-spacing:1px;text-transform:uppercase">Rent Ledger</div>
    <div style="font-size:8pt;color:#555;margin-top:2pt">Printed: ${escapeHtml(printDate)}</div>
  </div>

  <table style="width:100%;margin-bottom:10pt;font-size:9pt">
    <tbody>
      <tr>
        <td style="font-weight:bold;padding-right:6pt;padding-bottom:3pt;white-space:nowrap;width:90pt">Tenant Name:</td>
        <td style="padding-bottom:3pt">${tenantDisplay}</td>
        <td style="font-weight:bold;padding-left:18pt;padding-right:6pt;padding-bottom:3pt;white-space:nowrap;width:60pt">Case #:</td>
        <td style="padding-bottom:3pt;font-family:monospace">${caseNum}</td>
      </tr>
      <tr>
        <td style="font-weight:bold;padding-right:6pt;padding-bottom:3pt">Address:</td>
        <td style="padding-bottom:3pt">${address}</td>
        <td style="font-weight:bold;padding-left:18pt;padding-right:6pt;padding-bottom:3pt">Unit:</td>
        <td style="padding-bottom:3pt">${unit}</td>
      </tr>
      <tr>
        <td style="font-weight:bold;padding-right:6pt;padding-bottom:3pt">Monthly Rent:</td>
        <td style="padding-bottom:3pt;font-weight:bold">${escapeHtml(monthlyRent)}</td>
        <td style="font-weight:bold;padding-left:18pt;padding-right:6pt;padding-bottom:3pt">Balance:</td>
        <td style="padding-bottom:3pt;font-weight:bold">${escapeHtml(balanceDisplay)}</td>
      </tr>
      ${
        allLeases.length > 0
          ? `<tr>
        <td style="font-weight:bold;padding-right:6pt">Lease Period${allLeases.length > 1 ? 's' : ''}:</td>
        <td colspan="3">${leasePeriods}</td>
      </tr>`
          : ''
      }
    </tbody>
  </table>

  <table style="width:100%;font-size:8.5pt">
    <thead>
      <tr>
        <th colspan="3" style="border:1px solid #000;padding:3pt 4pt"></th>
        <th colspan="6" style="border:1px solid #000;padding:3pt 4pt;text-align:center;font-weight:bold;background:#e8e8e8">HRA</th>
        <th colspan="3" style="border:1px solid #000;padding:3pt 4pt;text-align:center;font-weight:bold;background:#e8e8e8">Balance</th>
      </tr>
      <tr style="background:#f2f2f2">
        <th style="border:1px solid #000;padding:3pt 4pt;text-align:left">Month</th>
        <th style="border:1px solid #000;padding:3pt 4pt;text-align:left">Year</th>
        <th style="border:1px solid #000;padding:3pt 4pt;text-align:right">Due</th>
        <th style="border:1px solid #000;padding:3pt 4pt;text-align:right">Check 1</th>
        <th style="border:1px solid #000;padding:3pt 4pt;text-align:center;white-space:nowrap">Check #</th>
        <th style="border:1px solid #000;padding:3pt 4pt;text-align:right">Check 2</th>
        <th style="border:1px solid #000;padding:3pt 4pt;text-align:right">Check 3</th>
        <th style="border:1px solid #000;padding:3pt 4pt;text-align:right">Check 4</th>
        <th style="border:1px solid #000;padding:3pt 4pt;text-align:right">Check 5</th>
        <th style="border:1px solid #000;padding:3pt 4pt;text-align:right;white-space:nowrap">Paid By Tenant</th>
        <th style="border:1px solid #000;padding:3pt 4pt;text-align:right">Balance</th>
        <th style="border:1px solid #000;padding:3pt 4pt;text-align:left">Comment</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
    <tfoot>
      <tr style="background:#e8e8e8;font-weight:bold">
        <td colspan="2" style="border:1px solid #000;padding:3pt 4pt">TOTAL</td>
        <td style="border:1px solid #000;padding:3pt 4pt;text-align:right">${fmt(totalDue)}</td>
        <td style="border:1px solid #000;padding:3pt 4pt;text-align:right">${totalsByCol[0] > 0 ? fmt(totalsByCol[0]) : '$0.00'}</td>
        <td style="border:1px solid #000;padding:3pt 4pt"></td>
        <td style="border:1px solid #000;padding:3pt 4pt;text-align:right">${totalsByCol[1] > 0 ? fmt(totalsByCol[1]) : '$0.00'}</td>
        <td style="border:1px solid #000;padding:3pt 4pt;text-align:right">${totalsByCol[2] > 0 ? fmt(totalsByCol[2]) : '$0.00'}</td>
        <td style="border:1px solid #000;padding:3pt 4pt;text-align:right">${totalsByCol[3] > 0 ? fmt(totalsByCol[3]) : '$0.00'}</td>
        <td style="border:1px solid #000;padding:3pt 4pt;text-align:right">${totalsByCol[4] > 0 ? fmt(totalsByCol[4]) : '$0.00'}</td>
        <td style="border:1px solid #000;padding:3pt 4pt"></td>
        <td style="border:1px solid #000;padding:3pt 4pt;text-align:right">${totalBalStr}</td>
        <td style="border:1px solid #000;padding:3pt 4pt"></td>
      </tr>
    </tfoot>
  </table>

</body>
</html>`
}

export async function POST(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: QueueCourtPdfRequest
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { tenant_id } = body
  if (!tenant_id) {
    return NextResponse.json({ error: 'tenant_id is required' }, { status: 400 })
  }

  // Fetch all data in parallel
  const [
    { data: tenant },
    { data: leaseRows },
    { data: courtLedger },
    { data: rentLedger },
  ] = await Promise.all([
    supabase
      .from('tenants')
      .select('id, name, full_legal_name, case_number')
      .eq('id', tenant_id)
      .single(),
    supabase
      .from('leases')
      .select('rent_amount, start_date, end_date, status, properties(id, name, nickname, address)')
      .eq('tenant_id', tenant_id)
      .order('start_date', { ascending: false }),
    supabase
      .from('view_court_ledger')
      .select('tenant_id, ledger_month, check_number, check_date, amount')
      .eq('tenant_id', tenant_id)
      .order('ledger_month')
      .order('check_date'),
    supabase
      .from('view_rent_ledger')
      .select('tenant_id, month, due_amount, paid_amount, pending_balance')
      .eq('tenant_id', tenant_id)
      .order('month'),
  ])

  if (!tenant) {
    return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
  }

  const allLeases = (leaseRows ?? []) as unknown as LeaseRow[]
  const activeLease =
    allLeases.find((l) => l.status === 'active') ?? allLeases[0] ?? null
  const property = activeLease?.properties ?? null

  // Build checks-by-month map
  const checksByMonth = new Map<string, CheckEntry[]>()
  for (const row of (courtLedger ?? []) as CourtLedgerRow[]) {
    const key = (row.ledger_month ?? '').slice(0, 10)
    if (!key) continue
    if (!checksByMonth.has(key)) checksByMonth.set(key, [])
    if (row.amount !== null && Number(row.amount) > 0) {
      checksByMonth.get(key)!.push({
        check_number: row.check_number,
        amount: Number(row.amount),
        check_date: row.check_date,
      })
    }
  }

  // Build lease months from rent ledger
  const leaseMonths: MonthRow[] = ((rentLedger ?? []) as RentLedgerRow[]).map(
    (row) => {
      const dateKey = (row.month as string).slice(0, 10)
      const d = new Date(dateKey + 'T12:00:00')
      const label = d.toLocaleDateString('en-US', {
        month: 'short',
        year: 'numeric',
      })
      return {
        month: dateKey,
        month_label: label,
        due: Number(row.due_amount ?? 0),
        checks: checksByMonth.get(dateKey) ?? [],
        balance: Number(row.pending_balance ?? 0),
      }
    }
  )

  // Generate vacant placeholder rows for gaps between consecutive leases
  const sortedLeases = [...allLeases]
    .filter((l) => l.start_date && l.end_date)
    .sort((a, b) => a.start_date.localeCompare(b.start_date))

  const vacantMonths: (MonthRow & { isVacant: true })[] = []
  for (let i = 0; i < sortedLeases.length - 1; i++) {
    const gapStart = new Date(sortedLeases[i].end_date! + 'T00:00:00')
    const gapEnd = new Date(sortedLeases[i + 1].start_date + 'T00:00:00')
    gapStart.setDate(1)
    gapStart.setMonth(gapStart.getMonth() + 1)
    while (gapStart < gapEnd) {
      const dateKey = gapStart.toISOString().slice(0, 10)
      const label = gapStart.toLocaleDateString('en-US', {
        month: 'short',
        year: 'numeric',
      })
      vacantMonths.push({
        month: dateKey,
        month_label: label,
        due: 0,
        checks: [],
        balance: 0,
        isVacant: true,
      })
      gapStart.setMonth(gapStart.getMonth() + 1)
    }
  }

  const months: MonthRow[] = [...leaseMonths, ...vacantMonths].sort((a, b) =>
    a.month.localeCompare(b.month)
  )

  const latestBalance = months.at(-1)?.balance ?? 0
  const totalDue = months.reduce((s, m) => s + m.due, 0)
  const totalsByCol = [0, 1, 2, 3, 4].map((i) =>
    months.reduce((s, m) => s + (m.checks[i]?.amount ?? 0), 0)
  )
  const printDate = new Date().toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  const html = buildHtml({
    tenant,
    property,
    activeLease,
    allLeases,
    months,
    latestBalance,
    totalDue,
    totalsByCol,
    printDate,
  })

  const sanitizedName = tenant.name.replace(/[^a-zA-Z0-9]/g, '_')
  const filename = `court_ledger_${sanitizedName}_${tenant_id.slice(0, 8)}`

  const { data: job, error: insertError } = await supabase
    .from('pdf_jobs')
    .insert({
      job_type: 'court_ledger',
      reference_id: tenant_id,
      html_content: html,
      filename,
      status: 'pending',
    })
    .select('id')
    .single()

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json({
    job_id: job.id,
    message: 'PDF job queued — run WF5 in n8n to generate',
  })
}
