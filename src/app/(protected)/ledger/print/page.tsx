// Court Ledger — Print / PDF page
// Matches the rent info.pdf format the client uses in court.
// Open via /ledger/print?tenant_id=XXX, then Ctrl+P / Print → Save as PDF
import { prisma } from '@/lib/db'
import { notFound } from 'next/navigation'
import { PrintTrigger } from './print-trigger'

// Prisma's $queryRaw returns date/timestamp columns as JS Date objects (not
// the ISO strings Supabase's PostgREST used to hand back), so normalize both
// shapes to a plain YYYY-MM-DD key.
function toDateKey(value: unknown): string {
  if (!value) return ''
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  return String(value).slice(0, 10)
}

export default async function LedgerPrintPage({
  searchParams,
}: {
  searchParams: Promise<{ tenant_id?: string }>
}) {
  const { tenant_id } = await searchParams
  if (!tenant_id) notFound()

  const [
    tenant,
    leaseRows,
    courtLedger,
    rentLedger,
  ] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: tenant_id } }),
    prisma.lease.findMany({
      where: { tenant_id },
      orderBy: { start_date: 'desc' },
      take: 1,
      select: {
        rent_amount: true, start_date: true, end_date: true, status: true,
        property: { select: { id: true, name: true, nickname: true, address: true } }
      }
    }),
    prisma.$queryRaw<any[]>`SELECT * FROM view_court_ledger WHERE tenant_id = ${tenant_id} ORDER BY ledger_month, check_date`,
    prisma.$queryRaw<any[]>`SELECT * FROM view_rent_ledger WHERE tenant_id = ${tenant_id} ORDER BY month`
  ])

  if (!tenant) notFound()

  const activeLease = leaseRows?.[0] ?? null
  const property = (activeLease as any)?.property ?? null

  // ── Build monthly pivot ───────────────────────────────────────────────────
  type CheckEntry = {
    check_number: string | null
    amount: number
    check_date: string | null
  }
  const checksByMonth = new Map<string, CheckEntry[]>()
  for (const row of courtLedger ?? []) {
    const key = toDateKey(row.ledger_month)
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
      const dateKey = toDateKey(row.month)
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
  const fmtChk = (n: number) =>
    n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const latestBalance = months.at(-1)?.balance ?? 0
  const printDate = new Date().toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  })

  return (
    <>
      <div className="p-8 max-w-[1100px] mx-auto text-[11px] leading-tight bg-white text-black min-h-screen">

        {/* Print / close buttons — hidden when actually printing */}
        <PrintTrigger />

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
                  ? `${activeLease.start_date.toISOString().slice(0, 10)} → ${activeLease.end_date ? activeLease.end_date.toISOString().slice(0, 10) : 'Ongoing'}`
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
                  colSpan={6}
                  className="border border-black text-center py-1 font-bold bg-neutral-100 tracking-wide"
                >
                  HRA
                </th>
                <th colSpan={2} className="border border-black bg-neutral-100 text-center py-1 font-bold">
                  Balance
                </th>
              </tr>
              {/* Row 2 — column names (check # shown inside each HRA cell, no separate column) */}
              <tr className="bg-neutral-50">
                <th className="border border-black px-2 py-1 text-left font-semibold">Month</th>
                <th className="border border-black px-2 py-1 text-left font-semibold">Year</th>
                <th className="border border-black px-2 py-1 text-right font-semibold">Due</th>
                <th className="border border-black px-2 py-1 text-right font-semibold">HRA 1</th>
                <th className="border border-black px-2 py-1 text-right font-semibold">HRA 2</th>
                <th className="border border-black px-2 py-1 text-right font-semibold">HRA 3</th>
                <th className="border border-black px-2 py-1 text-right font-semibold">HRA 4</th>
                <th className="border border-black px-2 py-1 text-right font-semibold">HRA 5</th>
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
                const overflowChecks = m.checks.slice(5)
                const overflowTotal  = overflowChecks.reduce((s, c) => s + c.amount, 0)
                const totalReceived = m.checks.reduce((s, c) => s + c.amount, 0)

                return (
                  <tr
                    key={m.month}
                    className={idx % 2 === 0 ? 'bg-white' : 'bg-neutral-50/50'}
                  >
                    <td className="border border-black px-2 py-1">{monthStr}</td>
                    <td className="border border-black px-2 py-1">{yearStr}</td>
                    <td className="border border-black px-2 py-1 text-right">{fmt(m.due)}</td>
                    {/* Each HRA cell: amount on top, check # below in same cell */}
                    {[0, 1, 2, 3, 4].map((i) => (
                      <td key={i} className="border border-black px-2 py-1 text-right">
                        {checks[i] ? (
                          <div>
                            <div>{fmtChk(checks[i].amount)}</div>
                            {checks[i].check_number && (
                              <div className="font-mono text-[8px] text-neutral-500">
                                #{checks[i].check_number}
                              </div>
                            )}
                          </div>
                        ) : ''}
                      </td>
                    ))}
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
                      {overflowChecks.length > 0 && (
                        <span>{totalReceived === 0 && m.due > 0 ? ' · ' : ''}+{overflowChecks.length} more · ${overflowTotal.toFixed(2)}</span>
                      )}
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
                {[0, 1, 2, 3, 4].map((i) => (
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


      </div>
    </>
  )
}
