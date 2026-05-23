import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/layout/page-header'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import Link from 'next/link'
import { Home } from 'lucide-react'

export default async function UnitsPage() {
  const supabase = await createClient()

  const { data: units } = await supabase
    .from('units')
    .select(`
      *,
      properties(id, name, address),
      leases(id, rent_amount, status, tenants(name))
    `)
    .order('unit_number')

  function getActiveLease(unit: any) {
    return unit.leases?.find((l: any) => l.status === 'active') ?? null
  }

  function statusBadge(status: string): 'default' | 'secondary' | 'outline' {
    if (status === 'occupied') return 'default'
    if (status === 'vacant') return 'secondary'
    return 'outline'
  }

  return (
    <div>
      <PageHeader
        title="Units"
        description="All units across all properties"
      />

      <div className="p-6">
        {!units?.length ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Home className="w-10 h-10 text-muted-foreground mb-3" />
            <h3 className="font-semibold mb-1">No units yet</h3>
            <p className="text-sm text-muted-foreground">Units are added from the property detail page.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {units.map((unit) => {
              const activeLease = getActiveLease(unit)
              const property = (unit as any).properties
              return (
                <Link key={unit.id} href={`/units/${unit.id}`}>
                  <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-semibold text-sm">Unit {unit.unit_number}</p>
                          <p className="text-xs text-muted-foreground truncate max-w-[150px]">
                            {property?.name ?? property?.address ?? '—'}
                          </p>
                        </div>
                        <Badge variant={statusBadge(unit.status)} className="text-xs capitalize shrink-0">
                          {unit.status.replace('_', ' ')}
                        </Badge>
                      </div>
                      {activeLease ? (
                        <div className="text-xs text-muted-foreground">
                          <p className="font-medium text-foreground">{activeLease.tenants?.name ?? '—'}</p>
                          <p>${Number(activeLease.rent_amount).toLocaleString()}/mo</p>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">Vacant</p>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
