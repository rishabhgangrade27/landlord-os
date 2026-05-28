import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/layout/page-header'
import { Badge } from '@/components/ui/badge'
import { LinkButton } from '@/components/ui/link-button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import { Building2, ArrowLeft } from 'lucide-react'
import { LedgerExportButton, type LedgerMonthRow } from './ledger-export-button'

// ─── Per-tenant court ledger ──────────────────────────────────────────────────
async function TenantLedger({ tenantId }: { tenantId: string }) {
  const supabase = await createClient()

  const [
    { data: tenant },
    { data: leaseRows },
    { data: courtLedger },
    { data: rentLedger },
  ] = await Promise.all([
    supabase.from('tenants').select('*').eq('id', tenantId).single(),
    supabase
      .from('leases')
      .select('rent_amount, start_date, end_date, status, properties(id, name, nickname, address)')
      .eq('tenant_id', tenantId)
      .order('start_date', { ascending: false }),
    supabase
      .from('view_court_ledger')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('ledger_month')
      .order('check_date'),
    supabase
      .from('view_rent_ledger')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('month'),
  ])

  if (!tenant) {
    return <p className="text-sm text-muted-foreground p-6">Tenant not found.</p>
  }

  // Most recent active lease for info card; fall back to most recent of any status
  const activeLease = (leaseRows ?? []).find((l: any) => l.status === 'active') ?? leaseRows?.[0] ?? null
  const property = (activeLease as any)?.properties ?? null
  const allLeases = leaseRows ?? []

  // ── Build monthly pivot ───────────────────────────────────────────────────
  type CheckEntry = { check_number: string | null; amount: number; check_date: string | null }
  const checksByMonth = new Map<string, CheckEntry[]>()

  for (const row of courtLedger ?? []) {
    // Normalize to YYYY-MM-DD — ledger_month comes back as a timestamp string
    // ("2024-01-01T00:00:00+00:00") while view_rent_ledger.month is a date
    // ("2024-01-01"). Slice to first 10 chars so they always match.
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

  type MonthRow = LedgerMonthRow

  const months: MonthRow[] = (rentLedger ?? [])
    .map((row) => {
      const dateKey = (row.month as string).slice(0, 10)
      const d = new Date(dateKey + 'T12:00:00')
      const label = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
      return {
        month: dateKey,
        month_label: label,
        due: Number(row.due_amount ?? 0),
        checks: checksByMonth.get(dateKey) ?? [],
        balance: Number(row.pending_balance ?? 0),
      }
    })
    .sort((a, b) => a.month.localeCompare(b.month))

  const latestBalance = months.at(-1)?.balance ?? 0
  const totalDue     = months.reduce((s, m) => s + m.due, 0)
  const totalsByCol  = [0,1,2,3,4].map((i) => months.reduce((s,m) => s + (m.checks[i]?.amount ?? 0), 0))
  const printDate    = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

  // ── Shared table body rows (used in both screen + print) ──────────────────
  const tableRows = months.map((m) => {
    const parts        = m.month_label.split(' ')
    const monthStr     = parts[0]
    const yearStr      = parts[1] ?? ''
    const bal          = m.balance
    const checks       = m.checks.slice(0, 5)
    const totalReceived = checks.reduce((s, c) => s + c.amount, 0)
    const allCheckNums  = checks.map((c) => c.check_number).filter(Boolean).join(', ')
    return { m, monthStr, yearStr, bal, checks, totalReceived, allCheckNums }
  })

  return (
    <>
      {/* ════════════════════════════════════════════════════════════
          SCREEN VIEW — hidden when printing
      ════════════════════════════════════════════════════════════ */}
      <div className="print:hidden">
        <PageHeader
          title="Court Ledger"
          description={tenant.name}
          action={
            <div className="flex gap-2">
              <LinkButton variant="outline" size="sm" href="/ledger">
                <ArrowLeft className="w-4 h-4 mr-1.5" />
                All Units
              </LinkButton>
              <LedgerExportButton
                tenantId={tenantId}
                tenantName={tenant.name}
                caseNumber={tenant.case_number ?? undefined}
                months={months}
              />
            </div>
          }
        />

        <div className="p-4 md:p-6 space-y-5">
          {/* Info card */}
          <Card>
            <CardContent className="p-5">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-y-4 gap-x-6 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Unit</p>
                  <p className="font-semibold">{property?.nickname ?? property?.name ?? property?.address ?? '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Tenant</p>
                  <p className="font-semibold">{tenant.name}</p>
                  {tenant.full_legal_name && tenant.full_legal_name !== tenant.name && (
                    <p className="text-xs text-muted-foreground">{tenant.full_legal_name}</p>
                  )}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Case Number</p>
                  <p className="font-mono font-semibold">{tenant.case_number ?? '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Address</p>
                  <p className="font-medium">{property?.address ?? (tenant as any).address ?? '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Monthly Rent</p>
                  <p className="font-semibold">${Number(activeLease?.rent_amount ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Current Balance</p>
                  <p className={`font-bold text-base ${latestBalance > 0 ? 'text-destructive' : latestBalance < 0 ? 'text-green-600' : 'text-muted-foreground'}`}>
                    {latestBalance > 0 ? `$${latestBalance.toFixed(2)} owed` : latestBalance < 0 ? `$${Math.abs(latestBalance).toFixed(2)} credit` : '$0.00 — paid up'}
                  </p>
                </div>
                {(tenant as any).notes && (
                  <div className="col-span-2 md:col-span-3">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Household / Notes</p>
                    <p className="text-sm">{(tenant as any).notes}</p>
                  </div>
                )}
                {allLeases.length > 1 && (
                  <div className="col-span-2 md:col-span-3">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Lease History ({allLeases.length} leases)</p>
                    <div className="flex flex-wrap gap-2">
                      {allLeases.map((l: any, i: number) => (
                        <span key={i} className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${l.status === 'active' ? 'bg-green-50 border-green-300 text-green-800' : 'bg-muted border-muted-foreground/20 text-muted-foreground'}`}>
                          <span className="font-mono">${Number(l.rent_amount).toLocaleString()}/mo</span>
                          <span>·</span>
                          <span>{l.start_date} – {l.end_date ?? 'ongoing'}</span>
                          {l.status === 'active' && <span className="font-semibold">✓</span>}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Quick nav */}
          <div className="flex flex-wrap gap-3 text-sm">
            <Link href={`/tenants/${tenantId}`} className="text-primary hover:underline">→ Tenant Profile</Link>
            <Link href={`/transactions?tenant_id=${tenantId}`} className="text-primary hover:underline">→ Transactions</Link>
          </div>

          {/* Screen table */}
          {!months.length ? (
            <Card>
              <CardContent className="py-10 text-center">
                <p className="text-sm text-muted-foreground">No ledger data yet. Upload HRA receipts to see the monthly breakdown.</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                  Monthly Breakdown — {months.length} months
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="border-b bg-muted/40">
                        <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground">Month</th>
                        <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground">Year</th>
                        <th className="text-right px-3 py-2.5 font-semibold text-muted-foreground">Due</th>
                        <th className="text-right px-3 py-2.5 font-semibold text-muted-foreground">HRA 1</th>
                        <th className="text-right px-3 py-2.5 font-semibold text-muted-foreground">HRA 2</th>
                        <th className="text-right px-3 py-2.5 font-semibold text-muted-foreground">HRA 3</th>
                        <th className="text-right px-3 py-2.5 font-semibold text-muted-foreground">HRA 4</th>
                        <th className="text-right px-3 py-2.5 font-semibold text-muted-foreground">HRA 5</th>
                        <th className="text-right px-3 py-2.5 font-semibold text-muted-foreground whitespace-nowrap">Paid By Tenant</th>
                        <th className="text-right px-3 py-2.5 font-semibold text-foreground bg-muted/60">Balance</th>
                        <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground">Comment</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tableRows.map(({ m, monthStr, yearStr, bal, checks, totalReceived }) => (
                        <tr key={m.month} className={`border-b last:border-0 ${bal > 500 ? 'bg-red-50/40' : bal < -50 ? 'bg-green-50/30' : ''}`}>
                          <td className="px-3 py-2 font-medium">{monthStr}</td>
                          <td className="px-3 py-2 text-muted-foreground">{yearStr}</td>
                          <td className="px-3 py-2 text-right">${m.due.toFixed(2)}</td>
                          {[0,1,2,3,4].map((i) => {
                            const chk = checks[i]
                            return (
                              <td key={i} className="px-3 py-2 text-right">
                                {chk ? (
                                  <div className="inline-block text-right">
                                    <p className="font-medium">${chk.amount.toFixed(2)}</p>
                                    {chk.check_number && <p className="text-muted-foreground text-[10px] font-mono">#{chk.check_number}</p>}
                                  </div>
                                ) : <span className="text-muted-foreground/30">—</span>}
                              </td>
                            )
                          })}
                          <td className="px-3 py-2 text-right text-muted-foreground/30">—</td>
                          <td className={`px-3 py-2 text-right font-bold bg-muted/10 ${bal > 0 ? 'text-destructive' : bal < 0 ? 'text-green-700' : 'text-muted-foreground'}`}>
                            {bal > 0 ? `$${bal.toFixed(2)}` : bal < 0 ? `($${Math.abs(bal).toFixed(2)})` : '$0.00'}
                          </td>
                          <td className="px-3 py-2 text-[10px]">
                            {totalReceived === 0 && m.due > 0 ? <span className="text-orange-500 font-medium">No payment</span> : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 bg-muted/30 font-semibold text-xs">
                        <td className="px-3 py-2.5" colSpan={2}>Total</td>
                        <td className="px-3 py-2.5 text-right">${totalDue.toFixed(2)}</td>
                        {totalsByCol.map((t, i) => <td key={i} className="px-3 py-2.5 text-right">${t.toFixed(2)}</td>)}
                        <td className="px-3 py-2.5 text-right">$0.00</td>
                        <td className={`px-3 py-2.5 text-right bg-muted/20 ${latestBalance > 0 ? 'text-destructive' : 'text-green-700'}`}>
                          {latestBalance > 0 ? `$${latestBalance.toFixed(2)}` : `($${Math.abs(latestBalance).toFixed(2)})`}
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════
          PRINT / PDF VIEW — only visible when printing
          Clean black & white court document. No app chrome.
      ════════════════════════════════════════════════════════════ */}
      <div className="hidden print:block" style={{ fontFamily: 'Arial, sans-serif', fontSize: '10pt', color: '#000', background: '#fff', padding: '18pt 22pt' }}>

        {/* Title */}
        <div style={{ textAlign: 'center', marginBottom: '10pt' }}>
          <div style={{ fontSize: '13pt', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>Rent Ledger</div>
          <div style={{ fontSize: '8pt', color: '#555', marginTop: '2pt' }}>Printed: {printDate}</div>
        </div>

        {/* Tenant info block */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '10pt', fontSize: '9pt' }}>
          <tbody>
            <tr>
              <td style={{ fontWeight: 'bold', paddingRight: '6pt', paddingBottom: '3pt', whiteSpace: 'nowrap', width: '90pt' }}>Tenant Name:</td>
              <td style={{ paddingBottom: '3pt' }}>{tenant.name}{tenant.full_legal_name && tenant.full_legal_name !== tenant.name ? ` / ${tenant.full_legal_name}` : ''}</td>
              <td style={{ fontWeight: 'bold', paddingLeft: '18pt', paddingRight: '6pt', paddingBottom: '3pt', whiteSpace: 'nowrap', width: '60pt' }}>Case #:</td>
              <td style={{ paddingBottom: '3pt', fontFamily: 'monospace' }}>{tenant.case_number ?? '—'}</td>
            </tr>
            <tr>
              <td style={{ fontWeight: 'bold', paddingRight: '6pt', paddingBottom: '3pt' }}>Address:</td>
              <td style={{ paddingBottom: '3pt' }}>{property?.address ?? (tenant as any).address ?? '—'}</td>
              <td style={{ fontWeight: 'bold', paddingLeft: '18pt', paddingRight: '6pt', paddingBottom: '3pt' }}>Unit:</td>
              <td style={{ paddingBottom: '3pt' }}>{property?.nickname ?? property?.name ?? '—'}</td>
            </tr>
            <tr>
              <td style={{ fontWeight: 'bold', paddingRight: '6pt', paddingBottom: '3pt' }}>Monthly Rent:</td>
              <td style={{ paddingBottom: '3pt', fontWeight: 'bold' }}>${Number(activeLease?.rent_amount ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
              <td style={{ fontWeight: 'bold', paddingLeft: '18pt', paddingRight: '6pt', paddingBottom: '3pt' }}>Balance:</td>
              <td style={{ paddingBottom: '3pt', fontWeight: 'bold' }}>
                {latestBalance > 0 ? `$${latestBalance.toFixed(2)} OWED` : latestBalance < 0 ? `($${Math.abs(latestBalance).toFixed(2)}) CREDIT` : '$0.00'}
              </td>
            </tr>
            {allLeases.length > 0 && (
              <tr>
                <td style={{ fontWeight: 'bold', paddingRight: '6pt' }}>Lease Period{allLeases.length > 1 ? 's' : ''}:</td>
                <td colSpan={3}>
                  {allLeases.map((l: any, i: number) =>
                    `${l.start_date} – ${l.end_date ?? 'Ongoing'} ($${Number(l.rent_amount).toLocaleString()}/mo)${i < allLeases.length - 1 ? ' | ' : ''}`
                  ).join('')}
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Ledger table */}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8.5pt' }}>
          <thead>
            <tr>
              <th colSpan={3} style={{ border: '1px solid #000', padding: '3pt 4pt' }} />
              <th colSpan={6} style={{ border: '1px solid #000', padding: '3pt 4pt', textAlign: 'center', fontWeight: 'bold', background: '#e8e8e8' }}>HRA</th>
              <th colSpan={3} style={{ border: '1px solid #000', padding: '3pt 4pt', textAlign: 'center', fontWeight: 'bold', background: '#e8e8e8' }}>Balance</th>
            </tr>
            <tr style={{ background: '#f2f2f2' }}>
              <th style={{ border: '1px solid #000', padding: '3pt 4pt', textAlign: 'left'  }}>Month</th>
              <th style={{ border: '1px solid #000', padding: '3pt 4pt', textAlign: 'left'  }}>Year</th>
              <th style={{ border: '1px solid #000', padding: '3pt 4pt', textAlign: 'right' }}>Due</th>
              <th style={{ border: '1px solid #000', padding: '3pt 4pt', textAlign: 'right' }}>Check 1</th>
              <th style={{ border: '1px solid #000', padding: '3pt 4pt', textAlign: 'center', whiteSpace: 'nowrap' }}>Check #</th>
              <th style={{ border: '1px solid #000', padding: '3pt 4pt', textAlign: 'right' }}>Check 2</th>
              <th style={{ border: '1px solid #000', padding: '3pt 4pt', textAlign: 'right' }}>Check 3</th>
              <th style={{ border: '1px solid #000', padding: '3pt 4pt', textAlign: 'right' }}>Check 4</th>
              <th style={{ border: '1px solid #000', padding: '3pt 4pt', textAlign: 'right' }}>Check 5</th>
              <th style={{ border: '1px solid #000', padding: '3pt 4pt', textAlign: 'right', whiteSpace: 'nowrap' }}>Paid By Tenant</th>
              <th style={{ border: '1px solid #000', padding: '3pt 4pt', textAlign: 'right' }}>Balance</th>
              <th style={{ border: '1px solid #000', padding: '3pt 4pt', textAlign: 'left'  }}>Comment</th>
            </tr>
          </thead>
          <tbody>
            {tableRows.map(({ m, monthStr, yearStr, bal, checks, totalReceived, allCheckNums }, idx) => (
              <tr key={m.month} style={{ background: idx % 2 === 0 ? '#fff' : '#fafafa', pageBreakInside: 'avoid' }}>
                <td style={{ border: '1px solid #000', padding: '2pt 4pt' }}>{monthStr}</td>
                <td style={{ border: '1px solid #000', padding: '2pt 4pt' }}>{yearStr}</td>
                <td style={{ border: '1px solid #000', padding: '2pt 4pt', textAlign: 'right' }}>{m.due > 0 ? `$${m.due.toFixed(2)}` : ''}</td>
                <td style={{ border: '1px solid #000', padding: '2pt 4pt', textAlign: 'right' }}>{checks[0] ? `$${checks[0].amount.toFixed(2)}` : ''}</td>
                <td style={{ border: '1px solid #000', padding: '2pt 4pt', textAlign: 'center', fontFamily: 'monospace', fontSize: '7.5pt' }}>{allCheckNums}</td>
                <td style={{ border: '1px solid #000', padding: '2pt 4pt', textAlign: 'right' }}>{checks[1] ? `$${checks[1].amount.toFixed(2)}` : ''}</td>
                <td style={{ border: '1px solid #000', padding: '2pt 4pt', textAlign: 'right' }}>{checks[2] ? `$${checks[2].amount.toFixed(2)}` : ''}</td>
                <td style={{ border: '1px solid #000', padding: '2pt 4pt', textAlign: 'right' }}>{checks[3] ? `$${checks[3].amount.toFixed(2)}` : ''}</td>
                <td style={{ border: '1px solid #000', padding: '2pt 4pt', textAlign: 'right' }}>{checks[4] ? `$${checks[4].amount.toFixed(2)}` : ''}</td>
                <td style={{ border: '1px solid #000', padding: '2pt 4pt' }} />
                <td style={{ border: '1px solid #000', padding: '2pt 4pt', textAlign: 'right', fontWeight: 'bold' }}>
                  {bal > 0 ? `$${bal.toFixed(2)}` : bal < 0 ? `($${Math.abs(bal).toFixed(2)})` : '—'}
                </td>
                <td style={{ border: '1px solid #000', padding: '2pt 4pt', fontSize: '7.5pt' }}>
                  {totalReceived === 0 && m.due > 0 ? 'No payment received' : ''}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ background: '#e8e8e8', fontWeight: 'bold' }}>
              <td colSpan={2} style={{ border: '1px solid #000', padding: '3pt 4pt' }}>TOTAL</td>
              <td style={{ border: '1px solid #000', padding: '3pt 4pt', textAlign: 'right' }}>${totalDue.toFixed(2)}</td>
              <td style={{ border: '1px solid #000', padding: '3pt 4pt', textAlign: 'right' }}>{totalsByCol[0] > 0 ? `$${totalsByCol[0].toFixed(2)}` : '$0.00'}</td>
              <td style={{ border: '1px solid #000', padding: '3pt 4pt' }} />
              {[1,2,3,4].map((i) => (
                <td key={i} style={{ border: '1px solid #000', padding: '3pt 4pt', textAlign: 'right' }}>{totalsByCol[i] > 0 ? `$${totalsByCol[i].toFixed(2)}` : '$0.00'}</td>
              ))}
              <td style={{ border: '1px solid #000', padding: '3pt 4pt' }} />
              <td style={{ border: '1px solid #000', padding: '3pt 4pt', textAlign: 'right' }}>
                {latestBalance > 0 ? `$${latestBalance.toFixed(2)}` : latestBalance < 0 ? `($${Math.abs(latestBalance).toFixed(2)})` : '$0.00'}
              </td>
              <td style={{ border: '1px solid #000', padding: '3pt 4pt' }} />
            </tr>
          </tfoot>
        </table>

        {/* Footer */}
        <div style={{ marginTop: '14pt', fontSize: '7.5pt', color: '#444', borderTop: '1px solid #ccc', paddingTop: '6pt' }}>
          <p>This document is system-generated by LandlordOS for administrative reference only. It does not constitute legal advice.</p>
          <p style={{ marginTop: '3pt' }}>Printed: {printDate} &nbsp;·&nbsp; Case: {tenant.case_number ?? '—'} &nbsp;·&nbsp; Tenant: {tenant.name}</p>
        </div>
      </div>
    </>
  )
}

// ─── Main ledger page — unit/building list ────────────────────────────────────
export default async function LedgerPage({
  searchParams,
}: {
  searchParams: Promise<{ tenant_id?: string }>
}) {
  const { tenant_id } = await searchParams

  if (tenant_id) {
    return <TenantLedger tenantId={tenant_id} />
  }

  const supabase = await createClient()

  const { data: properties } = await supabase
    .from('properties')
    .select(`
      id, name, nickname, address, city, state, status,
      leases(
        id, rent_amount, status,
        tenants(id, name, case_number, status)
      )
    `)
    .order('nickname')

  // Latest balance per tenant (most recent month)
  const { data: allLedger } = await supabase
    .from('view_rent_ledger')
    .select('tenant_id, pending_balance, month')
    .order('month', { ascending: false })

  const balanceMap = new Map<string, number>()
  for (const row of allLedger ?? []) {
    if (!balanceMap.has(row.tenant_id)) {
      balanceMap.set(row.tenant_id, Number(row.pending_balance ?? 0))
    }
  }

  // Group by building name (extracted from nickname)
  function getBuildingName(nickname: string | null, address: string | null): string {
    if (nickname) {
      const m = nickname.match(/^(.*?)\s*[-–]\s*[Uu]nit/i)
      if (m) return m[1].trim()
    }
    return address ?? 'Unknown Building'
  }

  type PropRow = NonNullable<typeof properties>[number]
  const buildingMap = new Map<string, PropRow[]>()
  for (const p of properties ?? []) {
    const bldg = getBuildingName(p.nickname, p.address)
    if (!buildingMap.has(bldg)) buildingMap.set(bldg, [])
    buildingMap.get(bldg)!.push(p)
  }
  const buildings = Array.from(buildingMap.entries()).sort(([a], [b]) => a.localeCompare(b))

  const totalOwed = Array.from(balanceMap.values()).filter((b) => b > 0).reduce((s, b) => s + b, 0)

  return (
    <div>
      <PageHeader
        title="Rent Ledger"
        description="Click a tenant to view their full court ledger"
      />

      <div className="p-4 md:p-6 space-y-6">
        {totalOwed > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm flex items-center gap-3">
            <span className="text-red-700 font-medium">Total outstanding:</span>
            <span className="font-bold text-destructive text-base">
              ${totalOwed.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          </div>
        )}

        {!buildings.length ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No properties found.
            </CardContent>
          </Card>
        ) : (
          buildings.map(([bldg, units]) => {
            const sample = units[0]
            return (
              <div key={bldg}>
                <div className="flex items-center gap-2 mb-3">
                  <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
                  <h2 className="font-semibold text-sm">{bldg}</h2>
                  {sample?.city && (
                    <span className="text-xs text-muted-foreground">
                      {sample.city}, {sample.state}
                    </span>
                  )}
                </div>

                <Card>
                  <CardContent className="p-0">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/30">
                          <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Unit</th>
                          <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Tenant</th>
                          <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden sm:table-cell">Case #</th>
                          <th className="text-right px-4 py-2.5 font-medium text-muted-foreground hidden md:table-cell">Rent/mo</th>
                          <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Balance</th>
                          <th className="px-4 py-2.5 w-28"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {units.map((unit) => {
                          const leases = (unit as any).leases ?? []
                          const activeLease = leases.find((l: any) => l.status === 'active') ?? null
                          const tenant = activeLease?.tenants ?? null
                          const balance = tenant ? (balanceMap.get(tenant.id) ?? null) : null

                          // Extract the "Unit X" part from nickname for display
                          const unitMatch = unit.nickname?.match(/[Uu]nit\s*(.+)$/)
                          const unitLabel = unitMatch
                            ? `Unit ${unitMatch[1]}`
                            : (unit.nickname ?? unit.name ?? '—')

                          return (
                            <tr key={unit.id} className="border-b last:border-0 hover:bg-muted/10">
                              <td className="px-4 py-3 font-medium">{unitLabel}</td>
                              <td className="px-4 py-3">
                                {tenant ? (
                                  <Link
                                    href={`/tenants/${tenant.id}`}
                                    className="font-medium text-primary hover:underline"
                                  >
                                    {tenant.name}
                                  </Link>
                                ) : (
                                  <span className="text-muted-foreground italic text-sm">Vacant</span>
                                )}
                              </td>
                              <td className="px-4 py-3 font-mono text-xs text-muted-foreground hidden sm:table-cell">
                                {tenant?.case_number ?? '—'}
                              </td>
                              <td className="px-4 py-3 text-right text-muted-foreground hidden md:table-cell">
                                {activeLease ? `$${Number(activeLease.rent_amount).toLocaleString()}` : '—'}
                              </td>
                              <td className="px-4 py-3 text-right">
                                {balance !== null ? (
                                  <span className={`font-semibold ${balance > 0 ? 'text-destructive' : balance < 0 ? 'text-green-700' : 'text-muted-foreground'}`}>
                                    {balance > 0
                                      ? `$${balance.toFixed(2)}`
                                      : balance < 0
                                      ? `($${Math.abs(balance).toFixed(2)})`
                                      : '$0.00'}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground/40 text-xs">—</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-right">
                                {tenant && (
                                  <Link
                                    href={`/ledger?tenant_id=${tenant.id}`}
                                    className="text-xs font-medium text-primary hover:underline whitespace-nowrap"
                                  >
                                    View Ledger →
                                  </Link>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
