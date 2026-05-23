import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/layout/page-header'
import { Badge } from '@/components/ui/badge'
import { LinkButton } from '@/components/ui/link-button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import Link from 'next/link'
import { LedgerExportButton } from './ledger-export-button'

export default async function LedgerPage({
  searchParams,
}: {
  searchParams: Promise<{ tenant_id?: string; filter?: string }>
}) {
  const { tenant_id, filter } = await searchParams
  const supabase = await createClient()

  // Fetch tenants for the filter dropdown
  const { data: tenants } = await supabase
    .from('tenants')
    .select('id, name')
    .eq('status', 'active')
    .order('name')

  // Build ledger query
  let query = supabase
    .from('view_rent_ledger')
    .select('*')
    .order('tenant_id')
    .order('month', { ascending: false })

  if (tenant_id) {
    query = query.eq('tenant_id', tenant_id)
  }

  if (filter === '60day') {
    query = query.eq('flag_60_day', true)
  } else if (filter === '30day') {
    query = query.eq('flag_30_day', true)
  }

  const { data: ledger } = await query.limit(200)

  // Get tenant names for display
  const tenantMap = new Map(tenants?.map((t) => [t.id, t.name]) ?? [])

  // Summary stats
  const totalBalance = ledger?.reduce((sum, r) => sum + (Number(r.pending_balance) || 0), 0) ?? 0
  const flag30 = ledger?.filter((r) => r.flag_30_day && !r.flag_60_day).length ?? 0
  const flag60 = ledger?.filter((r) => r.flag_60_day).length ?? 0

  return (
    <div>
      <PageHeader
        title="Rent Ledger"
        description="Running balance per tenant per month"
        action={
          <div className="flex gap-2">
            {tenant_id && (
              <LedgerExportButton tenantId={tenant_id} />
            )}
            <LinkButton variant="outline" size="sm" href="/ledger">All Tenants</LinkButton>
          </div>
        }
      />

      <div className="p-4 md:p-6 space-y-5">
        {/* Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Total Outstanding</p>
              <p className={`text-2xl font-bold ${totalBalance > 0 ? 'text-destructive' : 'text-green-600'}`}>
                ${totalBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
            </CardContent>
          </Card>
          <Card className={flag60 > 0 ? 'border-red-200' : ''}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">60-Day Overdue</p>
              <p className={`text-2xl font-bold ${flag60 > 0 ? 'text-destructive' : ''}`}>{flag60}</p>
              {flag60 > 0 && (
                <Link href="/ledger?filter=60day" className="text-xs text-destructive hover:underline">
                  View →
                </Link>
              )}
            </CardContent>
          </Card>
          <Card className={flag30 > 0 ? 'border-orange-200' : ''}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">30-Day Overdue</p>
              <p className={`text-2xl font-bold ${flag30 > 0 ? 'text-orange-600' : ''}`}>{flag30}</p>
              {flag30 > 0 && (
                <Link href="/ledger?filter=30day" className="text-xs text-orange-600 hover:underline">
                  View →
                </Link>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Tenant Filter */}
        <div className="flex flex-wrap gap-2">
          <Link href="/ledger">
            <Badge variant={!tenant_id ? 'default' : 'outline'} className="cursor-pointer">
              All Tenants
            </Badge>
          </Link>
          {tenants?.map((t) => (
            <Link key={t.id} href={`/ledger?tenant_id=${t.id}`}>
              <Badge
                variant={tenant_id === t.id ? 'default' : 'outline'}
                className="cursor-pointer"
              >
                {t.name}
              </Badge>
            </Link>
          ))}
        </div>

        {/* Ledger Table */}
        {!ledger?.length ? (
          <Card>
            <CardContent className="py-10 text-center">
              <p className="text-sm text-muted-foreground">
                No ledger data.{' '}
                <Link href="/upload" className="underline">Upload receipts</Link> and ensure leases are active.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Tenant</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">Month</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Due</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Paid</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground">Balance</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Flags</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledger.map((row, i) => {
                      const balance = Number(row.pending_balance ?? 0)
                      return (
                        <tr
                          key={i}
                          className={`border-b last:border-0 ${row.flag_60_day ? 'bg-red-50/50' : row.flag_30_day ? 'bg-orange-50/30' : 'hover:bg-muted/10'}`}
                        >
                          <td className="px-4 py-2.5">
                            <Link href={`/tenants/${row.tenant_id}`} className="font-medium hover:underline text-primary">
                              {tenantMap.get(row.tenant_id ?? '') ?? row.tenant_id?.slice(0, 8) ?? '—'}
                            </Link>
                            <p className="text-xs text-muted-foreground sm:hidden">
                              {row.month ? new Date(row.month).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '—'}
                            </p>
                          </td>
                          <td className="px-4 py-2.5 text-muted-foreground hidden sm:table-cell">
                            {row.month ? new Date(row.month).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '—'}
                          </td>
                          <td className="px-4 py-2.5 text-right hidden md:table-cell">
                            ${Number(row.due_amount ?? 0).toFixed(2)}
                          </td>
                          <td className="px-4 py-2.5 text-right text-green-700 hidden md:table-cell">
                            ${Number(row.paid_amount ?? 0).toFixed(2)}
                          </td>
                          <td className={`px-4 py-2.5 text-right font-semibold ${balance > 0 ? 'text-destructive' : 'text-green-700'}`}>
                            ${balance.toFixed(2)}
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="flex gap-1">
                              {row.flag_60_day && (
                                <Badge variant="destructive" className="text-xs py-0">60d</Badge>
                              )}
                              {row.flag_30_day && !row.flag_60_day && (
                                <Badge className="text-xs py-0 bg-orange-500">30d</Badge>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
