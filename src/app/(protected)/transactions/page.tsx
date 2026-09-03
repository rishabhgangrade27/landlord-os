import { prisma } from '@/lib/db'
import { PageHeader } from '@/components/layout/page-header'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { LinkButton } from '@/components/ui/link-button'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Suspense } from 'react'
import { DateFilter } from './date-filter'
import { TransactionRow } from './transaction-row'

const PAGE_SIZE = 50

const STATUS_CLASS: Record<string, string> = {
  verified:            'bg-emerald-100 text-emerald-800 border-emerald-200',
  processing:          'bg-blue-100 text-blue-800 border-blue-200',
  needs_review:        'bg-amber-100 text-amber-800 border-amber-200',
  duplicate_suspected: 'bg-purple-100 text-purple-800 border-purple-200',
  rejected:            'bg-red-100 text-red-800 border-red-200',
  blank_detected:      'bg-slate-100 text-slate-600 border-slate-200',
  deleted_blank:       'bg-slate-100 text-slate-500 border-slate-200',
}

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; tenant_id?: string; page?: string; date_from?: string; date_to?: string; case_number?: string; amount_min?: string; amount_max?: string }>
}) {
  const { status, tenant_id, page: pageParam, date_from, date_to, case_number, amount_min, amount_max } = await searchParams
  const page = Math.max(1, parseInt(pageParam ?? '1'))
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  // Soft-deleted duplicates (186 of them, see SCRATCHPAD.md) should never
  // show up in the main list — they were deliberately hidden from balance
  // math for exactly this reason, showing them here just reintroduces the
  // confusion (5 of them even carry status: 'verified').
  const where: any = { deleted_at: null }
  if (status) where.status = status
  if (tenant_id) where.matched_tenant_id = tenant_id
  if (date_from) where.extracted_check_date = { gte: date_from }
  if (date_to) where.extracted_check_date = { ...where.extracted_check_date, lte: date_to }
  if (case_number) where.extracted_case_number = { contains: case_number }
  if (amount_min) where.extracted_amount = { gte: parseFloat(amount_min) }
  if (amount_max) where.extracted_amount = { ...where.extracted_amount, lte: parseFloat(amount_max) }

  const [transactions, count] = await Promise.all([
    prisma.transaction.findMany({
      where,
      orderBy: { created_at: 'desc' },
      skip: from,
      take: PAGE_SIZE,
      select: {
        id: true,
        extracted_case_number: true,
        extracted_check_number: true,
        extracted_amount: true,
        extracted_check_date: true,
        status: true,
        duplicate_suspected: true,
        ocr_confidence: true,
        matched_tenant_id: true,
        created_at: true,
        tenant: {
          select: { id: true, name: true }
        }
      }
    }),
    prisma.transaction.count({ where })
  ])

  const totalPages = Math.ceil((count ?? 0) / PAGE_SIZE)

  function pageUrl(p: number) {
    const params = new URLSearchParams()
    if (status) params.set('status', status)
    if (tenant_id) params.set('tenant_id', tenant_id)
    if (date_from) params.set('date_from', date_from)
    if (date_to) params.set('date_to', date_to)
    if (case_number) params.set('case_number', case_number)
    if (amount_min) params.set('amount_min', amount_min)
    if (amount_max) params.set('amount_max', amount_max)
    params.set('page', String(p))
    return `/transactions?${params.toString()}`
  }

  const statuses = [
    { value: '', label: 'All' },
    { value: 'needs_review', label: 'Needs Review' },
    { value: 'processing', label: 'Processing' },
    { value: 'verified', label: 'Verified' },
    { value: 'duplicate_suspected', label: 'Duplicates' },
    { value: 'blank_detected', label: 'Blank' },
    { value: 'rejected', label: 'Rejected' },
  ]

  return (
    <div>
      <PageHeader
        title="Transactions"
        description={count != null ? `${count.toLocaleString()} total records` : 'All extracted check records'}
        action={
          <LinkButton size="sm" href="/transactions/manual-entry">
            + Add Manual Payment
          </LinkButton>
        }
      />

      <div className="p-4 md:p-6 space-y-4">
        {/* Status filter tabs */}
        <div className="flex flex-wrap gap-2">
          {statuses.map((s) => {

            const active = status === s.value || (!status && !s.value)
            const colorClass = s.value ? STATUS_CLASS[s.value] : ''
            return (
              <Link
                key={s.value}
                href={s.value ? `/transactions?status=${s.value}` : '/transactions'}
              >
                <Badge
                  variant="outline"
                  className={`cursor-pointer border ${
                    active
                      ? colorClass || 'bg-foreground text-background border-foreground'
                      : 'text-muted-foreground'
                  }`}
                >
                  {s.label}
                </Badge>
              </Link>
            )
          })}
        </div>

        {/* Date range filter */}
        <Suspense>
          <DateFilter />
        </Suspense>

        {!transactions?.length ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No transactions found.{' '}
              {!status && (
                <Link href="/upload" className="underline">
                  Upload PDFs to get started.
                </Link>
              )}
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Pagination info */}
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                Showing {from + 1}–{Math.min(to + 1, count ?? 0)} of {(count ?? 0).toLocaleString()}
              </span>
              <div className="flex items-center gap-2">
                {page > 1 && (
                  <LinkButton variant="outline" size="sm" href={pageUrl(page - 1)}>
                    <ChevronLeft className="w-4 h-4" />
                    Prev
                  </LinkButton>
                )}
                <span className="px-2">Page {page} of {totalPages}</span>
                {page < totalPages && (
                  <LinkButton variant="outline" size="sm" href={pageUrl(page + 1)}>
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </LinkButton>
                )}
              </div>
            </div>

            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Case #</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Tenant</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">Check #</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Date</th>
                        <th className="text-right px-4 py-3 font-medium text-muted-foreground">Amount</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                        <th className="text-right px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Confidence</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map((t) => (
                        <TransactionRow key={t.id} t={t} />
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Bottom pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-end gap-2">
                {page > 1 && (
                  <LinkButton variant="outline" size="sm" href={pageUrl(page - 1)}>
                    <ChevronLeft className="w-4 h-4" />
                    Prev
                  </LinkButton>
                )}
                <span className="text-sm text-muted-foreground px-2">Page {page} of {totalPages}</span>
                {page < totalPages && (
                  <LinkButton variant="outline" size="sm" href={pageUrl(page + 1)}>
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </LinkButton>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
