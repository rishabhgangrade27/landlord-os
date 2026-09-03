import { prisma } from '@/lib/db'
import { PageHeader } from '@/components/layout/page-header'
import { Badge } from '@/components/ui/badge'
import { LinkButton } from '@/components/ui/link-button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { EditContractorDialog } from './edit-contractor-dialog'

export default async function ContractorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [contractor, tickets] = await Promise.all([
    prisma.contractor.findUnique({ where: { id } }),
    prisma.maintenanceTicket.findMany({
      where: { assigned_contractor_id: id },
      select: { id: true, title: true, status: true, priority: true, created_at: true },
      orderBy: { created_at: 'desc' },
      take: 20
    })
  ])

  if (!contractor) notFound()

  return (
    <div>
      <PageHeader
        title={contractor.name}
        description={contractor.trade ?? 'General Contractor'}
        action={
          <div className="flex gap-2">
            <LinkButton variant="outline" size="sm" href="/contractors"><ArrowLeft className="w-4 h-4 mr-1.5" />Back</LinkButton>
            <EditContractorDialog contractor={contractor} />
          </div>
        }
      />

      <div className="p-6 space-y-5">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm text-muted-foreground uppercase tracking-wide">Contractor Details</CardTitle>
              <Badge variant={contractor.status === 'active' ? 'default' : 'secondary'} className="capitalize">
                {contractor.status ?? 'active'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { label: 'Trade', value: contractor.trade },
              { label: 'Phone', value: contractor.phone },
              { label: 'Email', value: contractor.email },
              { label: 'Address', value: contractor.address },
              { label: 'Payment Method', value: contractor.payment_method },
              { label: 'Notes', value: contractor.notes },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-sm font-medium">{value ?? '—'}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <div>
          <h2 className="font-semibold mb-3 text-base">Assigned Tickets ({tickets?.length ?? 0})</h2>
          {!tickets?.length ? (
            <p className="text-sm text-muted-foreground">No tickets assigned to this contractor.</p>
          ) : (
            <Card>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left px-4 py-2 font-medium text-muted-foreground">Title</th>
                      <th className="text-left px-4 py-2 font-medium text-muted-foreground">Status</th>
                      <th className="text-left px-4 py-2 font-medium text-muted-foreground">Priority</th>
                      <th className="text-left px-4 py-2 font-medium text-muted-foreground">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tickets.map((t) => (
                      <tr key={t.id} className="border-b last:border-0 hover:bg-muted/20">
                        <td className="px-4 py-2">
                          <Link href={`/maintenance/${t.id}`} className="hover:underline text-primary">{t.title}</Link>
                        </td>
                        <td className="px-4 py-2">
                          <Badge variant="secondary" className="text-xs capitalize">{t.status?.replace(/_/g, ' ')}</Badge>
                        </td>
                        <td className="px-4 py-2">
                          <Badge variant="outline" className="text-xs capitalize">{t.priority}</Badge>
                        </td>
                        <td className="px-4 py-2 text-muted-foreground text-xs">
                          {t.created_at ? new Date(t.created_at).toLocaleDateString() : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
