import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/layout/page-header'
import { Badge } from '@/components/ui/badge'
import { LinkButton } from '@/components/ui/link-button'
import { Card, CardContent } from '@/components/ui/card'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { EditLeaseDialog } from './edit-lease-dialog'

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
                            <Badge
                              variant={lease.status === 'active' ? 'default' : 'secondary'}
                              className="text-xs capitalize"
                            >
                              {lease.status}
                            </Badge>
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
