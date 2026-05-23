import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/layout/page-header'
import { Badge } from '@/components/ui/badge'
import { LinkButton } from '@/components/ui/link-button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Building2, Home, MapPin, Plus } from 'lucide-react'
import { AddUnitDialog } from './add-unit-dialog'
import { EditPropertyDialog } from './edit-property-dialog'

export default async function PropertyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: property }, { data: units }] = await Promise.all([
    supabase.from('properties').select('*').eq('id', id).single(),
    supabase
      .from('units')
      .select(`
        *,
        leases(
          id, rent_amount, status,
          tenants(id, name)
        )
      `)
      .eq('property_id', id)
      .order('unit_number'),
  ])

  if (!property) notFound()

  function getActiveLease(unit: any) {
    return unit.leases?.find((l: any) => l.status === 'active') ?? null
  }

  function statusBadge(status: string) {
    const map: Record<string, string> = {
      occupied: 'default',
      vacant: 'secondary',
      under_construction: 'outline',
    }
    return map[status] ?? 'secondary'
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

      <div className="p-6 space-y-6">
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
              { label: 'Type', value: property.property_type ?? 'residential' },
              { label: 'Total Units', value: units?.length ?? 0 },
              {
                label: 'Occupied',
                value: units?.filter((u) => u.status === 'occupied').length ?? 0,
              },
              {
                label: 'Vacant',
                value: units?.filter((u) => u.status === 'vacant').length ?? 0,
              },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-sm font-medium capitalize">{value ?? '—'}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Units */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold">Units</h2>
            <AddUnitDialog propertyId={id} />
          </div>

          {!units?.length ? (
            <Card>
              <CardContent className="py-10 text-center">
                <Home className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No units yet. Add the first unit above.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {units.map((unit) => {
                const activeLease = getActiveLease(unit)
                const tenant = activeLease?.tenants
                return (
                  <Link key={unit.id} href={`/units/${unit.id}`}>
                    <Card className="hover:shadow-md transition-shadow cursor-pointer">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className="font-semibold text-sm">Unit {unit.unit_number}</p>
                            {unit.floor && (
                              <p className="text-xs text-muted-foreground">Floor {unit.floor}</p>
                            )}
                          </div>
                          <Badge variant={statusBadge(unit.status) as any} className="text-xs capitalize">
                            {unit.status.replace('_', ' ')}
                          </Badge>
                        </div>

                        {tenant ? (
                          <div className="text-xs text-muted-foreground space-y-0.5">
                            <p className="font-medium text-foreground">{tenant.name}</p>
                            <p>${activeLease.rent_amount?.toLocaleString()}/mo</p>
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">No active tenant</p>
                        )}
                      </CardContent>
                    </Card>
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        {/* Timeline Link */}
        <div className="pt-2">
          <LinkButton variant="outline" size="sm" href={`/properties/${id}/timeline`}>
            View Unit History Timeline
          </LinkButton>
        </div>
      </div>
    </div>
  )
}
