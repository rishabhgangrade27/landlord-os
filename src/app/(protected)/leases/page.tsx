import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/layout/page-header'
import { Badge } from '@/components/ui/badge'
import { LinkButton } from '@/components/ui/link-button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import { Plus, AlertTriangle, Building2 } from 'lucide-react'
import { EditLeaseDialog } from './edit-lease-dialog'

function isDateExpired(endDate: string | null): boolean {
  if (!endDate) return false
  return endDate < new Date().toISOString().slice(0, 10)
}

function getBuildingName(propertyName: string | null, propertyAddress: string | null): string {
  if (propertyName) {
    const m = propertyName.match(/^(.*?)\s*[-–]\s*[Uu]nit/i)
    if (m) return m[1].trim()
  }
  return propertyAddress ?? propertyName ?? 'Unknown Building'
}

function getUnitLabel(propertyNickname: string | null, propertyName: string | null): string {
  const source = propertyNickname ?? propertyName ?? ''
  const m = source.match(/[Uu]nit\s*(.+)$/)
  return m ? `Unit ${m[1]}` : source
}

export default async function LeasesPage() {
  const supabase = await createClient()

  const { data: leases } = await supabase
    .from('leases')
    .select(`
      id, start_date, end_date, rent_amount, status, notes, property_id,
      tenants(id, name, case_number),
      properties(id, name, nickname, address)
    `)
    .order('start_date', { ascending: false })

  // Group: building → unit → leases[]
  type Lease = NonNullable<typeof leases>[number]
  const buildingMap = new Map<string, Map<string, Lease[]>>()

  for (const lease of leases ?? []) {
    const prop = (lease as any).properties
    const building = getBuildingName(prop?.name ?? null, prop?.address ?? null)
    const unit = getUnitLabel(prop?.nickname ?? null, prop?.name ?? null)

    if (!buildingMap.has(building)) buildingMap.set(building, new Map())
    const unitMap = buildingMap.get(building)!
    if (!unitMap.has(unit)) unitMap.set(unit, [])
    unitMap.get(unit)!.push(lease)
  }

  const buildings = Array.from(buildingMap.entries()).sort(([a], [b]) => a.localeCompare(b))

  return (
    <div>
      <PageHeader
        title="Leases"
        description="All tenant leases by property and unit"
        action={
          <LinkButton size="sm" href="/leases/new">
            <Plus className="w-4 h-4 mr-1.5" />
            Create Lease
          </LinkButton>
        }
      />

      <div className="p-4 md:p-6 space-y-8">
        {!leases?.length ? (
          <p className="text-sm text-muted-foreground py-8 text-center">No leases yet.</p>
        ) : (
          buildings.map(([building, unitMap]) => (
            <div key={building}>
              {/* Building header */}
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                  <Building2 className="w-4 h-4 text-primary" />
                </div>
                <h2 className="font-semibold text-base">{building}</h2>
              </div>

              <div className="space-y-4 pl-9">
                {Array.from(unitMap.entries()).map(([unit, unitLeases]) => (
                  <div key={unit}>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      {unit}
                    </p>
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
                              {unitLeases.map((lease) => {
                                const tenant = (lease as any).tenants
                                const expired = isDateExpired(lease.end_date)
                                const dbActive = lease.status === 'active'
                                const mismatch = dbActive && expired
                                return (
                                  <tr key={lease.id} className="border-b last:border-0 hover:bg-muted/20">
                                    <td className="px-4 py-3">
                                      <Link href={`/tenants/${tenant?.id}`} className="font-medium hover:underline text-primary">
                                        {tenant?.name ?? '—'}
                                      </Link>
                                      {tenant?.case_number && (
                                        <p className="text-xs text-muted-foreground font-mono">{tenant.case_number}</p>
                                      )}
                                    </td>
                                    <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                                      {lease.start_date}
                                    </td>
                                    <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                                      {lease.end_date ?? 'Ongoing'}
                                    </td>
                                    <td className="px-4 py-3 text-right font-medium">
                                      ${Number(lease.rent_amount).toLocaleString()}
                                    </td>
                                    <td className="px-4 py-3">
                                      <div className="flex items-center gap-1.5">
                                        <Badge
                                          variant={dbActive && !expired ? 'default' : 'secondary'}
                                          className="text-xs capitalize"
                                        >
                                          {expired ? 'expired' : lease.status}
                                        </Badge>
                                        {mismatch && (
                                          <span title="DB status still says 'active' — update lease status">
                                            <AlertTriangle className="w-3 h-3 text-orange-500" />
                                          </span>
                                        )}
                                      </div>
                                    </td>
                                    <td className="px-4 py-3 text-right">
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
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
