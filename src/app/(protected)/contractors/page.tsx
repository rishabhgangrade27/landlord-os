import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/layout/page-header'
import { Badge } from '@/components/ui/badge'
import { LinkButton } from '@/components/ui/link-button'
import { Card, CardContent } from '@/components/ui/card'
import Link from 'next/link'
import { Plus, HardHat } from 'lucide-react'

export default async function ContractorsPage() {
  const supabase = await createClient()

  const { data: contractors } = await supabase
    .from('contractors')
    .select('*')
    .order('name')

  return (
    <div>
      <PageHeader
        title="Contractors"
        description="Manage repair and maintenance contractors"
        action={
          <LinkButton size="sm" href="/contractors/new">
            <Plus className="w-4 h-4 mr-1.5" />
            Add Contractor
          </LinkButton>
        }
      />

      <div className="p-6">
        {!contractors?.length ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <HardHat className="w-10 h-10 text-muted-foreground mb-3" />
            <h3 className="font-semibold mb-1">No contractors yet</h3>
            <p className="text-sm text-muted-foreground mb-4">Add your contractors to assign them to tickets.</p>
            <LinkButton size="sm" href="/contractors/new"><Plus className="w-4 h-4 mr-1.5" />Add Contractor</LinkButton>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {contractors.map((c) => (
              <Link key={c.id} href={`/contractors/${c.id}`}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-semibold text-sm">{c.name}</p>
                        <p className="text-xs text-muted-foreground capitalize">{c.trade ?? 'General'}</p>
                      </div>
                      <Badge
                        variant={c.status === 'active' ? 'default' : 'secondary'}
                        className="text-xs capitalize"
                      >
                        {c.status ?? 'active'}
                      </Badge>
                    </div>
                    {c.phone && <p className="text-xs text-muted-foreground">{c.phone}</p>}
                    {c.email && <p className="text-xs text-muted-foreground">{c.email}</p>}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
