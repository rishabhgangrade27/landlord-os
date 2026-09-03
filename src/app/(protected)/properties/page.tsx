import { prisma } from '@/lib/db'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { LinkButton } from '@/components/ui/link-button'
import Link from 'next/link'
import { Building2, Plus, User, MapPin } from 'lucide-react'

export default async function PropertiesPage({
  searchParams,
}: {
  searchParams: Promise<{ show_retired?: string }>
}) {
  const { show_retired } = await searchParams
  const whereClause: any = {}
  if (!show_retired) {
    whereClause.status = { notIn: ['Retired', 'Sold'] }
  }

  const properties = await prisma.property.findMany({
    where: whereClause,
    orderBy: { nickname: 'asc' },
    include: {
      leases: {
        include: {
          tenant: true
        }
      }
    }
  })

  // Group units by building name (extracted from nickname)
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

  return (
    <div>
      <PageHeader
        title="Properties"
        description="Buildings and units under management"
        action={
          <div className="flex gap-2">
            {show_retired ? (
              <LinkButton variant="outline" size="sm" href="/properties">
                Hide Retired
              </LinkButton>
            ) : (
              <LinkButton variant="outline" size="sm" href="/properties?show_retired=1">
                Show Retired
              </LinkButton>
            )}
            <LinkButton size="sm" href="/properties/new">
              <Plus className="w-4 h-4 mr-1.5" />
              Add Unit
            </LinkButton>
          </div>
        }
      />

      <div className="p-4 md:p-6 space-y-8">
        {!buildings.length ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Building2 className="w-10 h-10 text-muted-foreground mb-3" />
            <h3 className="font-semibold mb-1">No properties yet</h3>
            <p className="text-sm text-muted-foreground mb-4">Add your first property to get started.</p>
            <LinkButton size="sm" href="/properties/new">
              <Plus className="w-4 h-4 mr-1.5" />
              Add Property
            </LinkButton>
          </div>
        ) : (
          buildings.map(([bldg, units]) => {
            const sample = units[0]
            const occupiedCount = units.filter((u) => {
              const leases = (u as any).leases ?? []
              return leases.some((l: any) => l.status === 'active')
            }).length

            return (
              <div key={bldg}>
                {/* Building header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Building2 className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <h2 className="font-semibold">{bldg}</h2>
                      {sample?.city && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3" />
                          {sample.address}{sample.city ? `, ${sample.city}` : ''}{sample.state ? `, ${sample.state}` : ''}{sample.zip ? ` ${sample.zip}` : ''}
                        </p>
                      )}
                    </div>
                  </div>
                  <Badge variant={occupiedCount === units.length ? 'default' : 'secondary'} className="text-xs">
                    {occupiedCount}/{units.length} occupied
                  </Badge>
                </div>

                {/* Units grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                  {units.map((unit) => {
                    const leases = unit.leases ?? []
                    const activeLease = leases.find((l: any) => l.status === 'active') ?? null
                    const tenant = activeLease?.tenant ?? null

                    // Extract unit label
                    const unitMatch = unit.nickname?.match(/[Uu]nit\s*(.+)$/)
                    const unitLabel = unitMatch ? `Unit ${unitMatch[1]}` : (unit.nickname ?? unit.name ?? '—')

                    return (
                      <Link key={unit.id} href={`/properties/${unit.id}`}>
                        <Card className={`hover:shadow-md transition-all cursor-pointer h-full border-2 ${
                          tenant ? 'border-transparent' : 'border-dashed border-muted-foreground/20'
                        }`}>
                          <CardContent className="p-4">
                            {/* Unit label */}
                            <div className="flex items-center justify-between mb-3">
                              <p className="font-semibold text-sm">{unitLabel}</p>
                              <Badge
                                variant={tenant ? 'default' : 'secondary'}
                                className="text-[10px]"
                              >
                                {tenant ? 'Occupied' : 'Vacant'}
                              </Badge>
                            </div>

                            {/* Tenant info */}
                            {tenant ? (
                              <div className="space-y-1">
                                <div className="flex items-center gap-1.5">
                                  <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                  <p className="text-sm font-medium truncate">{tenant.name}</p>
                                </div>
                                {tenant.case_number && (
                                  <p className="text-[10px] font-mono text-muted-foreground pl-5">
                                    {tenant.case_number}
                                  </p>
                                )}
                                {activeLease && (
                                  <p className="text-xs text-muted-foreground pl-5">
                                    ${Number(activeLease.rent_amount).toLocaleString()}/mo
                                  </p>
                                )}
                              </div>
                            ) : (
                              <p className="text-xs text-muted-foreground italic">No active tenant</p>
                            )}
                          </CardContent>
                        </Card>
                      </Link>
                    )
                  })}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
