import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/layout/page-header'
import { Badge } from '@/components/ui/badge'
import { LinkButton } from '@/components/ui/link-button'
import { Card, CardContent } from '@/components/ui/card'
import Link from 'next/link'
import { Plus } from 'lucide-react'

export default async function LeasesPage() {
  const supabase = await createClient()

  const { data: leases } = await supabase
    .from('leases')
    .select(`
      *,
      tenants(id, name, case_number),
      units(id, unit_number, properties(name, address))
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

      <div className="p-6">
        {!leases?.length ? (
          <p className="text-sm text-muted-foreground py-8 text-center">No leases yet.</p>
        ) : (
          <Card>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Tenant</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Unit</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Start</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">End</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground">Rent</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {leases.map((lease) => {
                    const tenant = (lease as any).tenants
                    const unit = (lease as any).units
                    const property = unit?.properties
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
                        <td className="px-4 py-3 text-muted-foreground">
                          {property?.name ?? property?.address ?? '—'}{unit ? ` / ${unit.unit_number}` : ''}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{lease.start_date}</td>
                        <td className="px-4 py-3 text-muted-foreground">{lease.end_date ?? 'Ongoing'}</td>
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
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
