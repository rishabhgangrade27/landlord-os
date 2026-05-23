import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/layout/page-header'
import { Badge } from '@/components/ui/badge'
import { LinkButton } from '@/components/ui/link-button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { SendToAttorneyButton } from './send-attorney-button'
import { UpdateNoticeStatusDialog } from './update-status-dialog'

const NOTICE_LABELS: Record<string, string> = {
  non_payment_30day: '30-Day Late Rent Notice',
  non_payment_60day: '60-Day Late Rent Notice',
  notice_90day: '90-Day Legal Notice',
  court_form: 'Court Filing Summary',
}

export default async function LegalNoticeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: notice } = await supabase
    .from('legal_notices')
    .select(`
      *,
      tenants(id, name, full_legal_name, case_number),
      units(unit_number, properties(name, address)),
      leases(start_date, end_date, rent_amount)
    `)
    .eq('id', id)
    .single()

  if (!notice) notFound()

  const tenant = (notice as any).tenants
  const unit = (notice as any).units
  const lease = (notice as any).leases

  return (
    <div>
      <PageHeader
        title={NOTICE_LABELS[notice.notice_type ?? ''] ?? notice.notice_type ?? 'Notice'}
        description={tenant?.name ?? ''}
        action={
          <div className="flex gap-2">
            <LinkButton variant="outline" size="sm" href="/legal-notices"><ArrowLeft className="w-4 h-4 mr-1.5" />Back</LinkButton>
            <UpdateNoticeStatusDialog notice={notice} />
          </div>
        }
      />

      <div className="p-6 space-y-5">
        {/* Notice Meta */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-muted-foreground uppercase tracking-wide">Notice Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-xs text-muted-foreground">Status</p>
                <Badge variant="outline" className="capitalize mt-0.5">
                  {notice.status?.replace(/_/g, ' ') ?? '—'}
                </Badge>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Type</p>
                <p className="text-sm font-medium">{NOTICE_LABELS[notice.notice_type ?? ''] ?? notice.notice_type}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Generated</p>
                <p className="text-sm font-medium">
                  {notice.generated_at ? new Date(notice.generated_at).toLocaleDateString() : '—'}
                </p>
              </div>
              {notice.sent_at && (
                <div>
                  <p className="text-xs text-muted-foreground">Sent</p>
                  <p className="text-sm font-medium">{new Date(notice.sent_at).toLocaleDateString()}</p>
                </div>
              )}
              {notice.attorney_email && (
                <div>
                  <p className="text-xs text-muted-foreground">Attorney Email</p>
                  <p className="text-sm font-medium">{notice.attorney_email}</p>
                </div>
              )}
              {notice.admin_notes && (
                <div>
                  <p className="text-xs text-muted-foreground">Admin Notes</p>
                  <p className="text-sm">{notice.admin_notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-muted-foreground uppercase tracking-wide">Tenant & Unit</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {tenant && (
                <>
                  <div>
                    <p className="text-xs text-muted-foreground">Tenant</p>
                    <Link href={`/tenants/${tenant.id}`} className="text-sm font-medium hover:underline text-primary">
                      {tenant.name}
                    </Link>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Full Legal Name</p>
                    <p className="text-sm font-medium">{tenant.full_legal_name ?? tenant.name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Case Number</p>
                    <p className="text-sm font-medium font-mono">{tenant.case_number ?? '—'}</p>
                  </div>
                </>
              )}
              {unit && (
                <div>
                  <p className="text-xs text-muted-foreground">Unit</p>
                  <p className="text-sm font-medium">
                    {unit.properties?.name ?? unit.properties?.address ?? '?'} / {unit.unit_number}
                  </p>
                </div>
              )}
              {lease && (
                <div>
                  <p className="text-xs text-muted-foreground">Monthly Rent</p>
                  <p className="text-sm font-medium">${Number(lease.rent_amount).toLocaleString()}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Notice Text */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Notice Document</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-sm whitespace-pre-wrap font-mono bg-muted/30 p-4 rounded-md text-muted-foreground leading-relaxed">
              {notice.rendered_text}
            </pre>
          </CardContent>
        </Card>

        {/* Actions */}
        {(notice.status === 'generated' || notice.status === 'draft') && (
          <div className="flex gap-3">
            <SendToAttorneyButton noticeId={id} currentStatus={notice.status ?? ''} />
          </div>
        )}
      </div>
    </div>
  )
}
