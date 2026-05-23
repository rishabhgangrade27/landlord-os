import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { LinkButton } from '@/components/ui/link-button'
import Link from 'next/link'
import { Building2, Plus, MapPin } from 'lucide-react'

export default async function PropertiesPage() {
  const supabase = await createClient()

  const { data: properties } = await supabase
    .from('properties')
    .select(`
      *,
      units(id, status)
    `)
    .order('created_at', { ascending: true })

  return (
    <div>
      <PageHeader
        title="Properties"
        description="All properties and buildings"
        action={
          <LinkButton size="sm" href="/properties/new">
            <Plus className="w-4 h-4 mr-1.5" />
            Add Property
          </LinkButton>
        }
      />

      <div className="p-4 md:p-6">
        {!properties?.length ? (
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
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {properties.map((p) => {
              const units = (p as any).units ?? []
              const occupied = units.filter((u: any) => u.status === 'occupied').length
              const total = units.length

              return (
                <Link key={p.id} href={`/properties/${p.id}`}>
                  <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Building2 className="w-4 h-4 text-primary" />
                          </div>
                          <div>
                            <p className="font-semibold text-sm leading-tight">
                              {p.name ?? p.address ?? 'Unnamed Property'}
                            </p>
                            <p className="text-xs text-muted-foreground capitalize">
                              {p.property_type ?? 'residential'}
                            </p>
                          </div>
                        </div>
                        <Badge variant={occupied === total && total > 0 ? 'default' : 'secondary'} className="text-xs">
                          {occupied}/{total} units
                        </Badge>
                      </div>

                      {p.address && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <MapPin className="w-3 h-3 shrink-0" />
                          <span className="truncate">
                            {p.address}{p.city ? `, ${p.city}` : ''}{p.state ? `, ${p.state}` : ''}
                          </span>
                        </div>
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
