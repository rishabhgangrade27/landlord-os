import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/layout/page-header'
import { Badge } from '@/components/ui/badge'
import { LinkButton } from '@/components/ui/link-button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, User, Calendar } from 'lucide-react'
import { EditPropertyDialog } from './edit-property-dialog'

export default async function PropertyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  // In this system, each property row IS a unit — the units table is separate but empty.
  // We get tenant/lease info directly from leases joined to this property.
  const [{ data: property }, { data: leases }] = await Promise.all([
    supabase.from('properties').select('*').eq('id', id).single(),
    supabase
      .from('leases')
      .select('id, start_date, end_date, rent_amount, status, tenants(id, name, case_number)')
      .eq('property_id', id)
      .order('start_date', { ascending: false }),
  ])

  if (!property) notFound()

  const activeLease = leases?.find((l) => l.status === 'active') ?? null
  const activeTenant = (activeLease as any)?.tenants ?? null

  function statusVariant(s: string) {
    if (s === 'active') return 'default'
    if (s === 'expired') return 'secondary'
    return 'outline'
  }

  return (
    <div>
      <PageHeader
        title={property.name ?? property.address ?? 'Property Detail'}
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
              { label: 'Address', value: property.address },
              { label: 'City', value: property.city },
              { label: 'State', value: property.state },
              { label: 'ZIP', value: property.zip },
              { label: 'Type', value: property.property_type ?? 'Residential' },
              { label: 'Status', value: property.status ?? '—' },
              { label: 'Monthly Rent', value: activeLease ? `$${Number(activeLease.rent_amount).toLocaleString()}` : '—' },
              { label: 'Occupancy', value: activeTenant ? 'Occupied' : 'Vacant' },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-sm font-medium capitalize">{value ?? '—'}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Current Tenant */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Current Tenant
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activeTenant ? (
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <User className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <Link href={`/tenants/${activeTenant.id}`} className="font-semibold hover:underline text-primary">
                    {activeTenant.name}
                  </Link>
                  {activeTenant.case_number && (
                    <p className="text-xs text-muted-foreground font-mono mt-0.5">
                      Case: {activeTenant.case_number}
                    </p>
                  )}
                  {activeLease && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Lease: {activeLease.start_date} → {activeLease.end_date ?? 'Ongoing'}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No active tenant. Unit is vacant.</p>
            )}
          </CardContent>
        </Card>

        {/* Lease History */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold">Lease History</h2>
            <LinkButton size="sm" href="/leases/new">
              + New Lease
            </LinkButton>
          </div>

          {!leases?.length ? (
            <Card>
              <CardContent className="py-8 text-center">
                <Calendar className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No leases on record for this property.</p>
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
                      </tr>
                    </thead>
                    <tbody>
                      {leases.map((lease) => {
                        const tenant = (lease as any).tenants
                        return (
                          <tr key={lease.id} className="border-b last:border-0">
                            <td className="px-4 py-2.5">
                              {tenant ? (
                                <Link href={`/tenants/${tenant.id}`} className="hover:underline text-primary font-medium">
                                  {tenant.name}
                                </Link>
                              ) : '—'}
                            </td>
                            <td className="px-4 py-2.5 text-muted-foreground hidden sm:table-cell">{lease.start_date}</td>
                            <td className="px-4 py-2.5 text-muted-foreground hidden sm:table-cell">{lease.end_date ?? 'Ongoing'}</td>
                            <td className="px-4 py-2.5 text-right font-medium">
                              ${Number(lease.rent_amount).toLocaleString()}
                            </td>
                            <td className="px-4 py-2.5">
                              <Badge variant={statusVariant(lease.status) as any} className="text-xs capitalize">
                                {lease.status}
                              </Badge>
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
