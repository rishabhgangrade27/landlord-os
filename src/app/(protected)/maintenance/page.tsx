import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/layout/page-header'
import { Badge } from '@/components/ui/badge'
import { LinkButton } from '@/components/ui/link-button'
import { Card, CardContent } from '@/components/ui/card'
import Link from 'next/link'
import { Plus, Wrench } from 'lucide-react'

const PRIORITY_COLORS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  urgent: 'destructive',
  high: 'destructive',
  medium: 'outline',
  low: 'secondary',
}

const STATUS_COLORS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  completed: 'default',
  in_progress: 'outline',
  assigned: 'secondary',
  reported: 'secondary',
  closed: 'secondary',
}

export default async function MaintenancePage() {
  const supabase = await createClient()

  const { data: tickets } = await supabase
    .from('maintenance_tickets')
    .select(`
      id, title, category, priority, status, estimated_cost, actual_cost, created_at,
      units(unit_number, properties(name, address)),
      contractors:assigned_contractor_id(name)
    `)
    .order('created_at', { ascending: false })

  return (
    <div>
      <PageHeader
        title="Maintenance"
        description="Track and manage repair requests"
        action={
          <LinkButton size="sm" href="/maintenance/new">
            <Plus className="w-4 h-4 mr-1.5" />
            New Ticket
          </LinkButton>
        }
      />

      <div className="p-4 md:p-6">
        {!tickets?.length ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Wrench className="w-10 h-10 text-muted-foreground mb-3" />
            <h3 className="font-semibold mb-1">No tickets yet</h3>
            <p className="text-sm text-muted-foreground mb-4">Create your first maintenance ticket.</p>
            <LinkButton size="sm" href="/maintenance/new">
              <Plus className="w-4 h-4 mr-1.5" />
              New Ticket
            </LinkButton>
          </div>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Title</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">Category</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Priority</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Contractor</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tickets.map((t) => {
                      const contractor = (t as any).contractors
                      return (
                        <tr key={t.id} className="border-b last:border-0 hover:bg-muted/20">
                          <td className="px-4 py-3">
                            <Link href={`/maintenance/${t.id}`} className="font-medium hover:underline text-primary">
                              {t.title}
                            </Link>
                            <p className="text-xs text-muted-foreground sm:hidden capitalize mt-0.5">{t.category ?? '—'}</p>
                          </td>
                          <td className="px-4 py-3 capitalize text-muted-foreground hidden sm:table-cell">{t.category ?? '—'}</td>
                          <td className="px-4 py-3">
                            <Badge variant={PRIORITY_COLORS[t.priority ?? ''] ?? 'secondary'} className="text-xs capitalize">
                              {t.priority ?? '—'}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{contractor?.name ?? '—'}</td>
                          <td className="px-4 py-3">
                            <Badge variant={STATUS_COLORS[t.status ?? ''] ?? 'secondary'} className="text-xs capitalize">
                              {t.status?.replace(/_/g, ' ') ?? '—'}
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
