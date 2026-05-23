import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/layout/page-header'
import { Badge } from '@/components/ui/badge'
import { LinkButton } from '@/components/ui/link-button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import Link from 'next/link'
import { Users, Plus } from 'lucide-react'

export default async function TenantsPage() {
  const supabase = await createClient()

  const { data: tenants } = await supabase
    .from('tenants')
    .select(`
      id, name, full_legal_name, case_number, phone, email, status,
      units(id, unit_number, properties(name, address))
    `)
    .order('name')

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

      <div className="p-6">
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
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Tenant</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Case Number</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Unit</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Contact</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {tenants.map((t) => {
                    const unit = (t as any).units
                    const property = unit?.properties
                    return (
                      <tr key={t.id} className="border-b last:border-0 hover:bg-muted/20">
                        <td className="px-4 py-3">
                          <Link href={`/tenants/${t.id}`} className="font-medium hover:underline text-primary">
                            {t.name}
                          </Link>
                          {t.full_legal_name && t.full_legal_name !== t.name && (
                            <p className="text-xs text-muted-foreground">{t.full_legal_name}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs">{t.case_number ?? '—'}</td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {unit ? (
                            <Link href={`/units/${unit.id}`} className="hover:underline">
                              {property?.name ?? property?.address ?? '—'} / {unit.unit_number}
                            </Link>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {t.phone ?? t.email ?? '—'}
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant={t.status === 'active' ? 'default' : 'secondary'}
                            className="text-xs capitalize"
                          >
                            {t.status ?? 'active'}
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
