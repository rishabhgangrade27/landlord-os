import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/layout/page-header'
import { Badge } from '@/components/ui/badge'
import { LinkButton } from '@/components/ui/link-button'
import { Card, CardContent } from '@/components/ui/card'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

export default async function PropertyTimelinePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: property }, { data: timeline }] = await Promise.all([
    supabase.from('properties').select('name, address').eq('id', id).single(),
    supabase
      .from('view_property_timeline')
      .select('*')
      .eq('property_id', id)
      .order('unit_number')
      .order('start_date'),
  ])

  if (!property) notFound()

  // Group by unit
  const byUnit = new Map<string, typeof timeline>()
  timeline?.forEach((row) => {
    const key = row.unit_number
    if (!byUnit.has(key)) byUnit.set(key, [])
    byUnit.get(key)!.push(row)
  })

  return (
    <div>
      <PageHeader
        title={`Timeline — ${property.name ?? property.address}`}
        description="Full unit history with occupancy gaps"
        action={
          <LinkButton variant="outline" size="sm" href={`/properties/${id}`}>
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            Back to Property
          </LinkButton>
        }
      />

      <div className="p-6 space-y-6">
        {byUnit.size === 0 ? (
          <p className="text-sm text-muted-foreground">No timeline data. Add units and leases first.</p>
        ) : (
          Array.from(byUnit.entries()).map(([unitNumber, rows]) => (
            <div key={unitNumber}>
              <h3 className="font-semibold text-sm mb-2">Unit {unitNumber}</h3>
              <Card>
                <CardContent className="p-0">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="text-left px-4 py-2 font-medium text-muted-foreground">Period</th>
                        <th className="text-left px-4 py-2 font-medium text-muted-foreground">Tenant</th>
                        <th className="text-left px-4 py-2 font-medium text-muted-foreground">Monthly Rent</th>
                        <th className="text-left px-4 py-2 font-medium text-muted-foreground">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows?.map((row, i) => (
                        <tr key={i} className="border-b last:border-0">
                          <td className="px-4 py-2 text-muted-foreground">
                            {row.start_date} → {row.end_date ?? 'Present'}
                          </td>
                          <td className="px-4 py-2 font-medium">{row.tenant_name ?? '—'}</td>
                          <td className="px-4 py-2">
                            {row.rent_amount ? `$${Number(row.rent_amount).toLocaleString()}` : '—'}
                          </td>
                          <td className="px-4 py-2">
                            <Badge
                              variant={row.status === 'Occupied' ? 'default' : 'secondary'}
                              className="text-xs"
                            >
                              {row.status}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
