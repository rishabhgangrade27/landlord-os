import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/layout/page-header'
import { Badge } from '@/components/ui/badge'
import { LinkButton } from '@/components/ui/link-button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { EditUnitDialog } from './edit-unit-dialog'

export default async function UnitDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: unit } = await supabase
    .from('units')
    .select(`
      *,
      properties(id, name, address, city, state)
    `)
    .eq('id', id)
    .single()

  if (!unit) notFound()

  const { data: leases } = await supabase
    .from('leases')
    .select(`
      *,
      tenants(id, name, case_number)
    `)
    .eq('unit_id', id)
    .order('start_date', { ascending: false })

  const activeLease = leases?.find((l) => l.status === 'active')
  const property = (unit as any).properties

  function statusColor(status: string) {
    const map: Record<string, string> = {
      occupied: 'default',
      vacant: 'secondary',
      under_construction: 'outline',
    }
    return (map[status] ?? 'secondary') as any
  }

  return (
    <div>
      <PageHeader
        title={`Unit ${unit.unit_number}`}
        description={property ? `${property.name ?? property.address}${property.city ? `, ${property.city}` : ''}` : ''}
        action={
          <div className="flex gap-2">
            <LinkButton variant="outline" size="sm" href={`/properties/${unit.property_id}`}>
              <ArrowLeft className="w-4 h-4 mr-1.5" />
              Property
            </LinkButton>
            <EditUnitDialog unit={unit} />
          </div>
        }
      />

      <div className="p-6 space-y-6">
        {/* Unit Info */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Unit Details
              </CardTitle>
              <Badge variant={statusColor(unit.status)} className="capitalize">
                {unit.status.replace('_', ' ')}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Unit Number', value: unit.unit_number },
              { label: 'Floor', value: unit.floor },
              { label: 'Bedrooms', value: unit.bedrooms },
              { label: 'Bathrooms', value: unit.bathrooms },
              { label: 'Notes', value: unit.notes },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-sm font-medium">{value ?? '—'}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Active Tenant */}
        {activeLease && (
          <Card className="border-green-200 bg-green-50/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Current Tenant</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Name</p>
                <Link
                  href={`/tenants/${activeLease.tenants?.id}`}
                  className="text-sm font-medium hover:underline text-primary"
                >
                  {activeLease.tenants?.name ?? '—'}
                </Link>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Case Number</p>
                <p className="text-sm font-medium">{activeLease.tenants?.case_number ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Monthly Rent</p>
                <p className="text-sm font-medium">
                  ${Number(activeLease.rent_amount).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Lease Period</p>
                <p className="text-sm font-medium">
                  {activeLease.start_date} → {activeLease.end_date ?? 'Ongoing'}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Lease History */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold">Lease History</h2>
            <LinkButton size="sm" href={`/leases/new?unit_id=${id}`}>Create Lease</LinkButton>
          </div>

          {!leases?.length ? (
            <p className="text-sm text-muted-foreground">No leases for this unit.</p>
          ) : (
            <Card>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left px-4 py-2 font-medium text-muted-foreground">Tenant</th>
                      <th className="text-left px-4 py-2 font-medium text-muted-foreground">Start</th>
                      <th className="text-left px-4 py-2 font-medium text-muted-foreground">End</th>
                      <th className="text-left px-4 py-2 font-medium text-muted-foreground">Rent</th>
                      <th className="text-left px-4 py-2 font-medium text-muted-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leases.map((lease) => (
                      <tr key={lease.id} className="border-b last:border-0 hover:bg-muted/20">
                        <td className="px-4 py-2">
                          <Link
                            href={`/tenants/${lease.tenants?.id}`}
                            className="hover:underline text-primary"
                          >
                            {lease.tenants?.name ?? '—'}
                          </Link>
                        </td>
                        <td className="px-4 py-2 text-muted-foreground">{lease.start_date}</td>
                        <td className="px-4 py-2 text-muted-foreground">{lease.end_date ?? 'Ongoing'}</td>
                        <td className="px-4 py-2">${Number(lease.rent_amount).toLocaleString()}/mo</td>
                        <td className="px-4 py-2">
                          <Badge
                            variant={lease.status === 'active' ? 'default' : 'secondary'}
                            className="text-xs capitalize"
                          >
                            {lease.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
