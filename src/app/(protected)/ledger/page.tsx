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
      .select('rent_amount, start_date, end_date, properties(id, name, nickname, address)')
      .eq('tenant_id', tenantId)
      .eq('status', 'active')
      .order('start_date', { ascending: false })
      .limit(1),
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

  const activeLease = leaseRows?.[0] ?? null
  const property = (activeLease as any)?.properties ?? null

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

  return (
    <>
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
        {/* Court document header */}
        <Card>
          <CardContent className="p-5">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-y-4 gap-x-6 text-sm">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Unit</p>
                <p className="font-semibold">
                  {property?.nickname ?? property?.name ?? property?.address ?? '—'}
                </p>
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
                <p className="font-medium">{property?.address ?? tenant.address ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Monthly Rent</p>
                <p className="font-semibold">
                  ${Number(activeLease?.rent_amount ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Current Balance</p>
                <p className={`font-bold text-base ${latestBalance > 0 ? 'text-destructive' : latestBalance < 0 ? 'text-green-600' : 'text-muted-foreground'}`}>
                  {latestBalance > 0
                    ? `$${latestBalance.toFixed(2)} owed`
                    : latestBalance < 0
                    ? `$${Math.abs(latestBalance).toFixed(2)} credit`
                    : '$0.00 — paid up'}
                </p>
              </div>
              {tenant.notes && (
                <div className="col-span-2 md:col-span-3">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Household / Notes</p>
                  <p className="text-sm">{tenant.notes}</p>
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

        {/* Monthly table */}
        {!months.length ? (
          <Card>
            <CardContent className="py-10 text-center">
              <p className="text-sm text-muted-foreground">
                No ledger data yet. Upload receipts and ensure the lease is active.
              </p>
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
                    {months.map((m) => {
                      const parts = m.month_label.split(' ')
                      const monthStr = parts[0]
                      const yearStr = parts[1] ?? ''
                      const bal = m.balance
                      const totalReceived = m.checks.reduce((s, c) => s + c.amount, 0)
                      return (
                        <tr
                          key={m.month}
                          className={`border-b last:border-0 ${bal > 500 ? 'bg-red-50/40' : bal < -50 ? 'bg-green-50/30' : ''}`}
                        >
                          <td className="px-3 py-2 font-medium">{monthStr}</td>
                          <td className="px-3 py-2 text-muted-foreground">{yearStr}</td>
                          <td className="px-3 py-2 text-right">${m.due.toFixed(2)}</td>
                          {[0, 1, 2, 3, 4].map((i) => {
                            const chk = m.checks[i]
                            return (
                              <td key={i} className="px-3 py-2 text-right">
                                {chk ? (
                                  <div className="inline-block text-right">
                                    <p className="font-medium">${chk.amount.toFixed(2)}</p>
                                    {chk.check_number && (
                                      <p className="text-muted-foreground text-[10px] font-mono">#{chk.check_number}</p>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground/30">—</span>
                                )}
                              </td>
                            )
                          })}
                          <td className="px-3 py-2 text-right text-muted-foreground/30">—</td>
                          <td className={`px-3 py-2 text-right font-bold bg-muted/10 ${bal > 0 ? 'text-destructive' : bal < 0 ? 'text-green-700' : 'text-muted-foreground'}`}>
                            {bal > 0 ? `$${bal.toFixed(2)}` : bal < 0 ? `($${Math.abs(bal).toFixed(2)})` : '$0.00'}
                          </td>
                          <td className="px-3 py-2 text-[10px]">
                            {totalReceived === 0 && m.due > 0 ? (
                              <span className="text-orange-500 font-medium">No payment</span>
                            ) : null}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 bg-muted/30 font-semibold text-xs">
                      <td className="px-3 py-2.5" colSpan={2}>Total</td>
                      <td className="px-3 py-2.5 text-right">
                        ${months.reduce((s, m) => s + m.due, 0).toFixed(2)}
                      </td>
                      {[0, 1, 2, 3, 4].map((i) => (
                        <td key={i} className="px-3 py-2.5 text-right">
                          ${months.reduce((s, m) => s + (m.checks[i]?.amount ?? 0), 0).toFixed(2)}
                        </td>
                      ))}
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
