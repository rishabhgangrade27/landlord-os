// Court Ledger — Print / PDF page
// Matches the rent info.pdf format Sonu uses in court.
// Open via /ledger/print?tenant_id=XXX, then Ctrl+P / Print → Save as PDF
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { PrintTrigger } from './print-trigger'

export default async function LedgerPrintPage({
  searchParams,
}: {
  searchParams: Promise<{ tenant_id?: string }>
}) {
  const { tenant_id } = await searchParams
  if (!tenant_id) notFound()

  const supabase = await createClient()

  const [
    { data: tenant },
    { data: leaseRows },
    { data: courtLedger },
    { data: rentLedger },
  ] = await Promise.all([
    supabase.from('tenants').select('*').eq('id', tenant_id).single(),
    supabase
      .from('leases')
      .select('rent_amount, start_date, end_date, properties(id, name, nickname, address)')
      .eq('tenant_id', tenant_id)
      .eq('status', 'active')
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

  if (!tenant) notFound()

  const activeLease = leaseRows?.[0] ?? null
  const property = (activeLease as any)?.properties ?? null

  // ── Build monthly pivot ───────────────────────────────────────────────────
  type CheckEntry = {
    check_number: string | null
    amount: number
    check_date: string | null
  }
  const checksByMonth = new Map<string, CheckEntry[]>()
  for (const row of courtLedger ?? []) {
    // Normalize to YYYY-MM-DD — ledger_month is a Postgres timestamp
    // ("2024-01-01T00:00:00+00:00") while view_rent_ledger.month is a date
    // ("2024-01-01"). Slice to 10 chars so the Map keys always match.
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

  type MonthRow = {
    month: string
    month_label: string
    due: number
    checks: CheckEntry[]
    balance: number
  }

  const months: MonthRow[] = (rentLedger ?? [])
    .map((row) => {
      const dateKey = (row.month as string).slice(0, 10)
      const d = new Date(dateKey + 'T12:00:00')
      const monthStr = d.toLocaleDateString('en-US', { month: 'short' })
      const yearStr = d.getFullYear().toString()
      return {
        month: dateKey,
        month_label: `${monthStr} ${yearStr}`,
        due: Number(row.due_amount ?? 0),
        checks: checksByMonth.get(dateKey) ?? [],
        balance: Number(row.pending_balance ?? 0),
      }
    })
    .sort((a, b) => a.month.localeCompare(b.month))

  const fmt = (n: number) =>
    n === 0 ? '' : n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const totalDue = months.reduce((s, m) => s + m.due, 0)
  const totalsByCol = [0, 1, 2, 3, 4].map((i) =>
    months.reduce((s, m) => s + (m.checks[i]?.amount ?? 0), 0)
  )
  const latestBalance = months.at(-1)?.balance ?? 0
  const printDate = new Date().toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  })

  return (
    <>
      {/* Print trigger — auto-opens print dialog when page loads */}
      <PrintTrigger />

      <div className="p-8 max-w-[1100px] mx-auto text-[11px] leading-tight">

        {/* Print / close buttons — hidden when actually printing */}
        <div className="print:hidden flex gap-3 mb-6">
          <button
            onClick={() => window.print()}
            className="px-4 py-2 bg-black text-white text-sm rounded-md hover:bg-neutral-800"
          >
            🖨 Print / Save as PDF
          </button>
          <button
            onClick={() => window.close()}
            className="px-4 py-2 border border-neutral-300 text-sm rounded-md hover:bg-neutral-50"
          >
            ✕ Close
          </button>
        </div>

        {/* ── COURT DOCUMENT HEADER ── */}
        <div className="text-center mb-5">
          <p className="text-sm font-bold tracking-widest uppercase">Court Document</p>
          <p className="text-[10px] text-neutral-500 mt-0.5">Prepared: {printDate}</p>
        </div>

        {/* ── TENANT INFO BLOCK ── */}
        <table className="w-full mb-5 text-[11px]">
          <tbody>
            <tr>
              <td className="font-semibold pr-2 py-0.5 whitespace-nowrap w-36">Tenant Name:</td>
              <td className="py-0.5">{tenant.name}</td>
              <td className="font-semibold pr-2 py-0.5 whitespace-nowrap w-24 pl-8">Case #:</td>
              <td className="py-0.5 font-mono">{tenant.case_number ?? '—'}</td>
            </tr>
            {(tenant as any).notes && (
              <tr>
                <td className="font-semibold pr-2 py-0.5">Other People:</td>
                <td className="py-0.5">{(tenant as any).notes}</td>
                <td className="pl-8 font-semibold pr-2 py-0.5">Unit:</td>
                <td className="py-0.5">
                  {property?.nickname ?? property?.name ?? '—'}
                </td>
              </tr>
            )}
            <tr>
              <td className="font-semibold pr-2 py-0.5">Address:</td>
              <td className="py-0.5">{property?.address ?? (tenant as any).address ?? '—'}</td>
              <td className="pl-8 font-semibold pr-2 py-0.5">Rent/Month:</td>
              <td className="py-0.5 font-semibold">
                ${Number(activeLease?.rent_amount ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </td>
            </tr>
            <tr>
              <td className="font-semibold pr-2 py-0.5">Lease Period:</td>
              <td className="py-0.5">
                {activeLease
                  ? `${activeLease.start_date} → ${activeLease.end_date ?? 'Ongoing'}`
                  : '—'}
              </td>
              <td className="pl-8 font-semibold pr-2 py-0.5">Balance:</td>
              <td className={`py-0.5 font-bold ${latestBalance > 0 ? 'text-red-700' : latestBalance < 0 ? 'text-green-700' : ''}`}>
                {latestBalance > 0
                  ? `$${latestBalance.toFixed(2)} OWED`
                  : latestBalance < 0
                  ? `($${Math.abs(latestBalance).toFixed(2)}) CREDIT`
                  : '$0.00'}
              </td>
            </tr>
          </tbody>
        </table>

        {/* ── LEDGER TABLE — matches rent info.pdf format exactly ── */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[10.5px]">
            <thead>
              {/* Row 1 — group header */}
              <tr>
                <th colSpan={3} className="border border-black bg-white" />
                <th
                  colSpan={7}
                  className="border border-black text-center py-1 font-bold bg-neutral-100 tracking-wide"
                >
                  HRA
                </th>
                <th colSpan={3} className="border border-black bg-neutral-100 text-center py-1 font-bold">
                  Balance
                </th>
              </tr>
              {/* Row 2 — column names */}
              <tr className="bg-neutral-50">
                <th className="border border-black px-2 py-1 text-left font-semibold">Month</th>
                <th className="border border-black px-2 py-1 text-left font-semibold">Year</th>
                <th className="border border-black px-2 py-1 text-right font-semibold">Due</th>
                <th className="border border-black px-2 py-1 text-right font-semibold">Check 1</th>
                <th className="border border-black px-2 py-1 text-center font-semibold">Check #</th>
                <th className="border border-black px-2 py-1 text-right font-semibold">Check 2</th>
                <th className="border border-black px-2 py-1 text-right font-semibold">Check 3</th>
                <th className="border border-black px-2 py-1 text-right font-semibold">Check 4</th>
                <th className="border border-black px-2 py-1 text-right font-semibold">Check 5</th>
                <th className="border border-black px-2 py-1 text-right font-semibold whitespace-nowrap">
                  Paid By Tenant
                </th>
                <th className="border border-black px-2 py-1 text-right font-semibold">Balance</th>
                <th className="border border-black px-2 py-1 text-left font-semibold">Comment</th>
              </tr>
            </thead>
            <tbody>
              {months.map((m, idx) => {
                const parts = m.month_label.split(' ')
                const monthStr = parts[0]
                const yearStr = parts[1] ?? ''
                const bal = m.balance
                const checks = m.checks.slice(0, 5)
                const totalReceived = checks.reduce((s, c) => s + c.amount, 0)
                // Check # column: all check numbers for this month, comma-separated
                const allCheckNums = checks
                  .map((c) => c.check_number)
                  .filter(Boolean)
                  .join(', ')

                return (
                  <tr
                    key={m.month}
                    className={idx % 2 === 0 ? 'bg-white' : 'bg-neutral-50/50'}
                  >
                    <td className="border border-black px-2 py-1">{monthStr}</td>
                    <td className="border border-black px-2 py-1">{yearStr}</td>
                    <td className="border border-black px-2 py-1 text-right">{fmt(m.due)}</td>
                    <td className="border border-black px-2 py-1 text-right">
                      {checks[0] ? fmt(checks[0].amount) : ''}
                    </td>
                    <td className="border border-black px-2 py-1 text-center font-mono text-[9px]">
                      {allCheckNums}
                    </td>
                    <td className="border border-black px-2 py-1 text-right">
                      {checks[1] ? fmt(checks[1].amount) : ''}
                    </td>
                    <td className="border border-black px-2 py-1 text-right">
                      {checks[2] ? fmt(checks[2].amount) : ''}
                    </td>
                    <td className="border border-black px-2 py-1 text-right">
                      {checks[3] ? fmt(checks[3].amount) : ''}
                    </td>
                    <td className="border border-black px-2 py-1 text-right">
                      {checks[4] ? fmt(checks[4].amount) : ''}
                    </td>
                    {/* Paid By Tenant — not yet tracked; placeholder */}
                    <td className="border border-black px-2 py-1 text-right" />
                    <td
                      className={`border border-black px-2 py-1 text-right font-semibold ${
                        bal > 0 ? 'text-red-700' : bal < 0 ? 'text-green-700' : ''
                      }`}
                    >
                      {bal > 0
                        ? fmt(bal)
                        : bal < 0
                        ? `(${fmt(Math.abs(bal))})`
                        : '—'}
                    </td>
                    <td className="border border-black px-2 py-1 text-[9px]">
                      {totalReceived === 0 && m.due > 0 ? 'No payment received' : ''}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="font-bold bg-neutral-100">
                <td colSpan={2} className="border border-black px-2 py-1.5">
                  TOTAL
                </td>
                <td className="border border-black px-2 py-1.5 text-right">{fmt(totalDue)}</td>
                <td className="border border-black px-2 py-1.5 text-right">
                  {fmt(totalsByCol[0])}
                </td>
                <td className="border border-black px-2 py-1.5" />
                {[1, 2, 3, 4].map((i) => (
                  <td key={i} className="border border-black px-2 py-1.5 text-right">
                    {fmt(totalsByCol[i])}
                  </td>
                ))}
                <td className="border border-black px-2 py-1.5" />
                <td
                  className={`border border-black px-2 py-1.5 text-right ${
                    latestBalance > 0 ? 'text-red-700' : 'text-green-700'
                  }`}
                >
                  {latestBalance > 0
                    ? fmt(latestBalance)
                    : `(${fmt(Math.abs(latestBalance))})`}
                </td>
                <td className="border border-black px-2 py-1.5" />
              </tr>
            </tfoot>
          </table>
        </div>

        {/* ── FOOTER DISCLAIMER ── */}
        <div className="mt-6 text-[9px] text-neutral-500 border-t pt-3">
          <p>
            ⚠ This document is system-generated by LandlordOS for administrative reference only.
            It does not constitute legal advice. All actions, filings, and notices remain the
            responsibility of the landlord and their attorney.
          </p>
          <p className="mt-1">Printed: {printDate} &nbsp;·&nbsp; Case: {tenant.case_number ?? '—'} &nbsp;·&nbsp; Tenant: {tenant.name}</p>
        </div>

      </div>
    </>
  )
}
