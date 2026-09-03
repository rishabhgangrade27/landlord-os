import { prisma } from '@/lib/db'

import { PageHeader } from '@/components/layout/page-header'
import { Badge } from '@/components/ui/badge'
import { LinkButton } from '@/components/ui/link-button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Download } from 'lucide-react'
import { SendToAttorneyButton } from './send-attorney-button'
import { UpdateNoticeStatusDialog } from './update-status-dialog'
import { PrintButton } from './print-button'
import { GeneratePdfButton } from './generate-pdf-button'
import { DownloadWordButton } from './download-word-button'

const NOTICE_LABELS: Record<string, string> = {
  notice_5day:           '5-Day Non-Payment Notice (Court)',
  notice_7day:           '7-Day Non-Payment Notice (Court)',
  notice_14day:          '14-Day Notice of Cure/Quit (Court)',
  notice_30day:          '30-Day Landlord Cure Notice (to Tenant)',
  non_payment_30day:     '30-Day HRA Rent Demand Letter (to HRA) — superseded, see notice_30day',
  non_payment_60day:     '14-Day Notice of Cure (Non-Payment) — superseded, see notice_14day',
  notice_90day:          '90-Day Termination Notice (Eviction)',
  notice_90day_b84:      '90-Day Termination Notice (B84 — Beach 84th St)',
  notice_90day_8607:     '90-Day Termination Notice (8607 — 101st St)',
  court_form:            'Court — Holdover Petition',
  court_form_nonpayment: 'Court — Non-Payment Petition',
}

// Only these have a real .docx template built from the client's actual documents
// (see /templates/legal-notices and SCRATCHPAD.md) — everything else still
// uses the HTML-wrapper .doc download until a real source document exists.
const HAS_REAL_DOCX_TEMPLATE: Record<string, boolean> = {
  notice_90day:      true,
  notice_90day_8607: true,
  notice_90day_b84:  true,
  notice_14day:      true,
  court_form:        true,
}

export default async function LegalNoticeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const notice = await prisma.legalNotice.findUnique({
    where: { id },
    include: {
      tenant: { select: { id: true, name: true, full_legal_name: true, case_number: true } },
      property: { select: { id: true, name: true, address: true, nickname: true } },
      lease: { select: { start_date: true, end_date: true, rent_amount: true } }
    }
  })

  if (!notice) notFound()

  // Get PDF status (Stub)
  let pdfJob: any = null

  const tenant = (notice as any).tenant
  const property = (notice as any).property
  const lease = (notice as any).lease

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
              {property && (
                <div>
                  <p className="text-xs text-muted-foreground">Property / Unit</p>
                  <p className="text-sm font-medium">
                    {property.nickname ?? property.name ?? property.address ?? '—'}
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
        <div className="flex gap-3 flex-wrap print:hidden">
          {(notice.status === 'generated' || notice.status === 'draft') && (
            <SendToAttorneyButton noticeId={id} currentStatus={notice.status ?? ''} />
          )}
          
          {HAS_REAL_DOCX_TEMPLATE[notice.notice_type ?? ''] ? (
            <a
              href={`/api/generate-notice-docx/${id}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-md hover:bg-muted/30"
            >
              <Download className="w-3.5 h-3.5" />
              Download .docx
            </a>
          ) : (
            <DownloadWordButton
              title={NOTICE_LABELS[notice.notice_type ?? ''] ?? 'Legal Notice'}
              content={notice.rendered_text ?? ''}
            />
          )}

          {pdfJob?.status === 'done' && pdfJob.pdf_url ? (
            <a href={pdfJob.pdf_url} target="_blank" rel="noreferrer"
               className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-md hover:bg-muted/30">
              <Download className="w-3.5 h-3.5" />
              Download PDF
            </a>
          ) : pdfJob ? (
            <GeneratePdfButton noticeId={id} />
          ) : null}
          <PrintButton />
        </div>

        {/* Print styles — hides nav/header, shows only notice text */}
        <style>{`
          @media print {
            nav, header, [data-sidebar], .print\\:hidden { display: none !important; }
            body { background: white !important; }
          }
        `}</style>
      </div>
    </div>
  )
}
