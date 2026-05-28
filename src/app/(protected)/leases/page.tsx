import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/layout/page-header'
import { Badge } from '@/components/ui/badge'
import { LinkButton } from '@/components/ui/link-button'
import { Card, CardContent } from '@/components/ui/card'
import Link from 'next/link'
import { Plus, AlertTriangle } from 'lucide-react'
import { EditLeaseDialog } from './edit-lease-dialog'

// Returns true if end_date has passed (DB may still say 'active' — data entry lag)
function isDateExpired(endDate: string | null): boolean {
  if (!endDate) return false
  return endDate < new Date().toISOString().slice(0, 10)
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

  return (
    <div>
      <PageHeader
        title="Leases"
        description="All tenant leases"
        action={
          <LinkButton size="sm" href="/leases/new">
            <Plus className="w-4 h-4 mr-1.5" />
            Create Lease
          </LinkButton>
        }
      />

      <div className="p-4 md:p-6">
        {!leases?.length ? (
          <p className="text-sm text-muted-foreground py-8 text-center">No leases yet.</p>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Tenant</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Unit</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">Start</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">End</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground">Rent</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {leases.map((lease) => {
                      const tenant = (lease as any).tenants
                      const property = (lease as any).properties
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
                          <td className="px-4 py-3 text-muted-foreground text-xs hidden md:table-cell">
                            {property?.nickname ?? property?.name ?? property?.address ?? '—'}
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
                            {(() => {
                              const expired = isDateExpired(lease.end_date)
                              const dbActive = lease.status === 'active'
                              // Mismatch: DB says active but dates show expired
                              const mismatch = dbActive && expired
                              return (
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
                              )
                            })()}
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
        )}
      </div>
    </div>
  )
}
