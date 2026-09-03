import { prisma } from '@/lib/db'
import { PageHeader } from '@/components/layout/page-header'
import { Badge } from '@/components/ui/badge'
import { LinkButton } from '@/components/ui/link-button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { UpdateTicketDialog } from './update-ticket-dialog'

export default async function MaintenanceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const ticket = await prisma.maintenanceTicket.findUnique({
    where: { id },
    include: {
      property: {
        select: { id: true, name: true, nickname: true, address: true }
      },
      contractor: {
        select: { id: true, name: true, phone: true, email: true, trade: true }
      }
    }
  })

  if (!ticket) notFound()

  const property = ticket.property
  const contractor = ticket.contractor

  const PRIORITY_COLORS: Record<string, string> = {
    urgent: 'destructive',
    high: 'destructive',
    medium: 'outline',
    low: 'secondary',
  }

  return (
    <div>
      <PageHeader
        title={ticket.title}
        description={`${ticket.category ?? 'General'} — ${ticket.priority ?? 'Medium'} priority`}
        action={
          <div className="flex gap-2">
            <LinkButton variant="outline" size="sm" href="/maintenance"><ArrowLeft className="w-4 h-4 mr-1.5" />Back</LinkButton>
            <UpdateTicketDialog ticket={ticket} />
          </div>
        }
      />

      <div className="p-6 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-muted-foreground uppercase tracking-wide">
                Ticket Info
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { label: 'Status', value: ticket.status?.replace(/_/g, ' '), badge: true },
                { label: 'Priority', value: ticket.priority, badge: true },
                { label: 'Category', value: ticket.category, capitalize: true },
                { label: 'Unit', value: property ? (property.nickname ?? property.name ?? property.address) : null },
                { label: 'Estimated Cost', value: ticket.estimated_cost ? `$${ticket.estimated_cost}` : null },
                { label: 'Actual Cost', value: ticket.actual_cost ? `$${ticket.actual_cost}` : null },
                { label: 'Cost Approved', value: ticket.cost_approved ? 'Yes' : ticket.cost_approved === false ? 'No' : null },
              ].map(({ label, value, badge, capitalize }) => (
                <div key={label}>
                  <p className="text-xs text-muted-foreground">{label}</p>
                  {badge ? (
                    <Badge
                      variant={(PRIORITY_COLORS[value?.toLowerCase() ?? ''] ?? 'secondary') as any}
                      className="text-xs capitalize mt-0.5"
                    >
                      {value ?? '—'}
                    </Badge>
                  ) : (
                    <p className={`text-sm font-medium ${capitalize ? 'capitalize' : ''}`}>
                      {value ?? '—'}
                    </p>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-muted-foreground uppercase tracking-wide">
                Contractor
              </CardTitle>
            </CardHeader>
            <CardContent>
              {contractor ? (
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Name</p>
                    <Link href={`/contractors/${contractor.id}`} className="font-medium hover:underline text-primary">
                      {contractor.name}
                    </Link>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Trade</p>
                    <p className="text-sm font-medium capitalize">{contractor.trade ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Phone</p>
                    <p className="text-sm font-medium">{contractor.phone ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Email</p>
                    <p className="text-sm font-medium">{contractor.email ?? '—'}</p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No contractor assigned.</p>
              )}
            </CardContent>
          </Card>
        </div>

        {ticket.description && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">{ticket.description}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
