import { createClient } from '@/lib/supabase/server'
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
  const supabase = await createClient()

  const [{ data: transaction }, { data: tenants }] = await Promise.all([
    supabase
      .from('transactions')
      .select('*, tenants:matched_tenant_id(id, name, case_number)')
      .eq('id', id)
      .single(),
    supabase
      .from('tenants')
      .select('id, name, case_number, status')
      .order('name'),
  ])

  if (!transaction) notFound()

  // Generate a fresh signed URL for the PDF so the iframe actually loads.
  // Falls back to the stored source_pdf_url if storage metadata is missing.
  let pdfUrl: string | null = null
  if (transaction.file_bucket && transaction.file_path) {
    const { data: signed } = await supabase.storage
      .from(transaction.file_bucket)
      .createSignedUrl(transaction.file_path, 60 * 60) // 1 hour
    pdfUrl = signed?.signedUrl ?? null
  }
  if (!pdfUrl && transaction.source_pdf_url) {
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
        matchedTenant={(transaction as any).tenants ?? null}
        allTenants={tenants ?? []}
        pdfUrl={pdfUrl}
        pageNumber={pageNumber}
      />
    </div>
  )
}
