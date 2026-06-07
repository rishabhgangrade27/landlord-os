import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/layout/page-header'
import { Badge } from '@/components/ui/badge'
import { LinkButton } from '@/components/ui/link-button'
import { Card, CardContent } from '@/components/ui/card'
import Link from 'next/link'
import { Users, Plus } from 'lucide-react'

export default async function TenantsPage() {
  const supabase = await createClient()

  // No units join — units table is empty (properties serve as units in this system)
  const { data: tenants } = await supabase
    .from('tenants')
    .select('id, name, full_legal_name, case_number, phone, email, status')
    .order('name')

  // Get active lease + property info per tenant separately
  const { data: activeLeases } = await supabase
    .from('leases')
    .select('tenant_id, property_id, properties(id, name, address, nickname)')
    .eq('status', 'active')

  const leaseLookup = new Map<string, any>()
  activeLeases?.forEach((l) => {
    leaseLookup.set(l.tenant_id, (l as any).properties)
  })

  return (
    <div>
      <PageHeader
        title="Tenants"
        description="All tenant records"
        action={
          <LinkButton size="sm" href="/tenants/new">
            <Plus className="w-4 h-4 mr-1.5" />
            Add Tenant
          </LinkButton>
        }
      />

      <div className="p-4 md:p-6">
        {!tenants?.length ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Users className="w-10 h-10 text-muted-foreground mb-3" />
            <h3 className="font-semibold mb-1">No tenants yet</h3>
            <p className="text-sm text-muted-foreground mb-4">Add your first tenant to get started.</p>
            <LinkButton size="sm" href="/tenants/new">
              <Plus className="w-4 h-4 mr-1.5" />
              Add Tenant
            </LinkButton>
          </div>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Tenant</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Case Number</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Property</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">Contact</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tenants.map((t) => {
                      const property = leaseLookup.get(t.id)
                      const unitLabel = property?.nickname ?? property?.name ?? null
                      const isActive = !t.status || t.status === 'active'
                      const rowBorder = isActive ? 'border-l-2 border-l-emerald-400' : 'border-l-2 border-l-slate-200'
                      const statusClass = isActive
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                        : 'bg-slate-100 text-slate-500 border-slate-200'
                      return (
                        <tr key={t.id} className={`border-b last:border-0 hover:bg-muted/20 ${rowBorder}`}>
                          <td className="px-4 py-3">
                            {unitLabel && (
                              <p className="text-[11px] font-semibold text-muted-foreground mb-0.5 uppercase tracking-wide">
                                {unitLabel}
                              </p>
                            )}
                            <Link href={`/tenants/${t.id}`} className="font-medium hover:underline text-primary">
                              {t.name}
                            </Link>
                            {t.full_legal_name && t.full_legal_name !== t.name && (
                              <p className="text-xs text-muted-foreground">{t.full_legal_name}</p>
                            )}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs">{t.case_number ?? '—'}</td>
                          <td className="px-4 py-3 text-muted-foreground text-xs hidden md:table-cell">
                            {property ? (property.address ?? property.name) : '—'}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                            {t.phone ?? t.email ?? '—'}
                          </td>
                          <td className="px-4 py-3">
                            <Badge
                              variant="outline"
                              className={`text-xs capitalize border ${statusClass}`}
                            >
                              {t.status ?? 'active'}
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
    </div>
  )
}
