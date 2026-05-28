import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/layout/page-header'
import { Badge } from '@/components/ui/badge'
import { LinkButton } from '@/components/ui/link-button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, User, Calendar, AlertTriangle } from 'lucide-react'
import { EditPropertyDialog } from './edit-property-dialog'
import { EditLeaseDialog } from '@/app/(protected)/leases/edit-lease-dialog'

export default async function PropertyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: property }, { data: leases }, { data: ledgerRows }] = await Promise.all([
    supabase.from('properties').select('*').eq('id', id).single(),
    supabase
      .from('leases')
      .select('id, start_date, end_date, rent_amount, status, notes, tenants(id, name, case_number)')
      .eq('property_id', id)
      .order('start_date', { ascending: false }),
    // Latest balance per tenant for this property (ordered desc so first row = latest month)
    supabase
      .from('view_rent_ledger')
      .select('tenant_id, pending_balance')
      .eq('property_id', id)
      .order('month', { ascending: false }),
  ])

  // Build a map: tenant_id → latest pending_balance
  const balanceByTenant = new Map<string, number>()
  for (const row of ledgerRows ?? []) {
    if (row.tenant_id && !balanceByTenant.has(row.tenant_id)) {
      balanceByTenant.set(row.tenant_id, Number(row.pending_balance ?? 0))
    }
  }

  if (!property) notFound()

  const activeLease = leases?.find((l) => l.status === 'active') ?? null
  const activeTenant = (activeLease as any)?.tenants ?? null

  // Most recent lease (even if expired) — so we can show last known tenant
  const mostRecentLease = leases?.[0] ?? null
  const lastTenant = (mostRecentLease as any)?.tenants ?? null
  const isExpired = !activeLease && mostRecentLease?.status === 'expired'

  return (
    <div>
      <PageHeader
        title={property.nickname ?? property.name ?? property.address ?? 'Property Detail'}
        description={[property.address, property.city, property.state].filter(Boolean).join(', ')}
        action={
          <div className="flex gap-2">
            <LinkButton variant="outline" size="sm" href="/properties">
              <ArrowLeft className="w-4 h-4 mr-1.5" />
              Back
            </LinkButton>
            <EditPropertyDialog property={property} />
          </div>
        }
      />

      <div className="p-4 md:p-6 space-y-6">
        {/* Property Info */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Property Details
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Address',      value: property.address },
              { label: 'City',         value: property.city },
              { label: 'State',        value: property.state },
              { label: 'ZIP',          value: property.zip },
              { label: 'Type',         value: property.property_type ?? 'Residential' },
              { label: 'Status',       value: property.status ?? '—' },
              {
                label: 'Monthly Rent',
                value: activeLease
                  ? `$${Number(activeLease.rent_amount).toLocaleString()}/mo`
                  : isExpired
                  ? `$${Number(mostRecentLease!.rent_amount).toLocaleString()}/mo (expired)`
                  : '—',
              },
              { label: 'Occupancy', value: activeTenant ? 'Occupied' : 'Vacant' },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-sm font-medium">{value ?? '—'}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Current / Last Tenant */}
        <Card className={isExpired ? 'border-amber-200 bg-amber-50/30' : ''}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              {activeTenant ? 'Current Tenant' : isExpired ? 'Last Tenant (Lease Expired)' : 'Tenant'}
              {isExpired && <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activeTenant ? (
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <User className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1">
                  <Link href={`/tenants/${activeTenant.id}`} className="font-semibold hover:underline text-primary">
                    {activeTenant.name}
                  </Link>
                  {activeTenant.case_number && (
                    <p className="text-xs text-muted-foreground font-mono mt-0.5">Case: {activeTenant.case_number}</p>
                  )}
                  {activeLease && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Lease: {activeLease.start_date} → {activeLease.end_date ?? 'Ongoing'}
                    </p>
                  )}
                  {(() => {
                    const bal = balanceByTenant.get(activeTenant.id)
                    if (bal === undefined || bal === 0) return null
                    return bal > 0 ? (
                      <p className="text-xs font-semibold text-red-600 mt-1">
                        Balance owed: ${bal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </p>
                    ) : (
                      <p className="text-xs font-semibold text-green-600 mt-1">
                        Credit: ${Math.abs(bal).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </p>
                    )
                  })()}
                </div>
                <Link href={`/ledger?tenant_id=${activeTenant.id}`} className="text-xs text-primary hover:underline whitespace-nowrap">
                  View Ledger →
                </Link>
              </div>
            ) : isExpired && lastTenant ? (
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                  <User className="w-4 h-4 text-amber-600" />
                </div>
                <div className="flex-1">
                  <Link href={`/tenants/${lastTenant.id}`} className="font-semibold hover:underline text-amber-700">
                    {lastTenant.name}
                  </Link>
                  {lastTenant.case_number && (
                    <p className="text-xs text-muted-foreground font-mono mt-0.5">Case: {lastTenant.case_number}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Last lease ended: <strong>{mostRecentLease!.end_date ?? 'unknown'}</strong>
                  </p>
                  <p className="text-xs text-amber-600 font-medium mt-1">
                    ⚠ Lease expired — create a new lease to mark this unit as occupied
                  </p>
                </div>
                <LinkButton
                  size="sm"
                  href={`/leases/new?tenant_id=${lastTenant.id}&property_id=${id}`}
                  className="whitespace-nowrap"
                >
                  Renew Lease
                </LinkButton>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">No tenant on record. Unit is vacant.</p>
                <LinkButton size="sm" href={`/leases/new?property_id=${id}`}>
                  + Add Tenant
                </LinkButton>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Lease History */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold">Lease History</h2>
            {/* Pre-fill property_id in new lease form */}
            <LinkButton size="sm" href={`/leases/new?property_id=${id}`}>
              + New Lease
            </LinkButton>
          </div>

          {!leases?.length ? (
            <Card>
              <CardContent className="py-8 text-center">
                <Calendar className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No leases on record.</p>
                <LinkButton size="sm" href={`/leases/new?property_id=${id}`} className="mt-3">
                  Create First Lease
                </LinkButton>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Tenant</th>
                        <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden sm:table-cell">Start</th>
                        <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden sm:table-cell">End</th>
                        <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Rent</th>
                        <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Status</th>
                        <th className="px-4 py-2.5"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {leases.map((lease) => {
                        const tenant = (lease as any).tenants
                        return (
                          <tr key={lease.id} className="border-b last:border-0 hover:bg-muted/10">
                            <td className="px-4 py-2.5">
                              {tenant ? (
                                <Link href={`/tenants/${tenant.id}`} className="hover:underline text-primary font-medium">
                                  {tenant.name}
                                </Link>
                              ) : '—'}
                            </td>
                            <td className="px-4 py-2.5 text-muted-foreground hidden sm:table-cell">
                              {lease.start_date}
                            </td>
                            <td className="px-4 py-2.5 text-muted-foreground hidden sm:table-cell">
                              {lease.end_date ?? 'Ongoing'}
                            </td>
                            <td className="px-4 py-2.5 text-right font-medium">
                              ${Number(lease.rent_amount).toLocaleString()}
                            </td>
                            <td className="px-4 py-2.5">
                              <Badge
                                variant={lease.status === 'active' ? 'default' : 'secondary'}
                                className="text-xs capitalize"
                              >
                                {lease.status}
                              </Badge>
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              <EditLeaseDialog
                                lease={{
                                  id: lease.id,
                                  start_date: lease.start_date,
                                  end_date: lease.end_date,
                                  rent_amount: Number(lease.rent_amount),
                                  status: lease.status,
                                  notes: (lease as any).notes ?? null,
                                }}
                                tenantName={tenant?.name}
                              />
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

        {/* Timeline link */}
        <div>
          <LinkButton variant="outline" size="sm" href={`/properties/${id}/timeline`}>
            View Property Timeline
          </LinkButton>
        </div>
      </div>
    </div>
  )
}
