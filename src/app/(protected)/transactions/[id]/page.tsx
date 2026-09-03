import { prisma } from '@/lib/db'

import { PageHeader } from '@/components/layout/page-header'
import { LinkButton } from '@/components/ui/link-button'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { TransactionReviewPanel } from './transaction-review-panel'

export default async function TransactionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params


  const [transaction, tenants] = await Promise.all([
    prisma.transaction.findUnique({
      where: { id },
      include: {
        tenant: {
          select: { id: true, name: true, case_number: true }
        }
      }
    }),
    prisma.tenant.findMany({
      select: { id: true, name: true, case_number: true, status: true },
      orderBy: { name: 'asc' }
    })
  ])

  if (!transaction) notFound()

  let pdfUrl: string | null = null
  if (transaction.source_pdf_url) {
    pdfUrl = transaction.source_pdf_url
  }

  const pageNumber = transaction.page_number ?? 1

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Review Transaction"
        description={[
          transaction.extracted_case_number ? `Case: ${transaction.extracted_case_number}` : null,
          transaction.page_number != null ? `Page ${transaction.page_number}` : null,
        ]
          .filter(Boolean)
          .join(' · ')}
        action={
          <LinkButton variant="outline" size="sm" href="/transactions">
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            Back
          </LinkButton>
        }
      />

      <TransactionReviewPanel
        transaction={transaction as any}
        matchedTenant={(transaction as any).tenant ?? null}
        allTenants={tenants ?? []}
        pdfUrl={pdfUrl}
        pageNumber={pageNumber}
      />
    </div>
  )
}
