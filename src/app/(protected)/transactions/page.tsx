import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/layout/page-header'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { LinkButton } from '@/components/ui/link-button'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Suspense } from 'react'
import { DateFilter } from './date-filter'

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

  const supabase = await createClient()

  let query = supabase
    .from('transactions')
    .select(`
      id, extracted_case_number, extracted_check_number, extracted_amount,
      extracted_check_date, status, duplicate_suspected, ocr_confidence,
      matched_tenant_id, created_at,
      tenants:matched_tenant_id(id, name)
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)

  if (status) query = query.eq('status', status)
  if (tenant_id) query = query.eq('matched_tenant_id', tenant_id)
  if (date_from) query = query.gte('extracted_check_date', date_from)
  if (date_to) query = query.lte('extracted_check_date', date_to)
  if (case_number) query = query.ilike('extracted_case_number', `%${case_number}%`)
  if (amount_min) query = query.gte('extracted_amount', parseFloat(amount_min))
  if (amount_max) query = query.lte('extracted_amount', parseFloat(amount_max))

  const { data: transactions, count } = await query

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
                      {transactions.map((t) => {
                        const tenant = (t as any).tenants
                        return (
                          <tr key={t.id} className="border-b last:border-0 hover:bg-muted/20">
                            <td className="px-4 py-2.5 font-mono text-xs">
                              <Link href={`/transactions/${t.id}`} className="hover:underline text-primary">
                                {t.extracted_case_number ?? '—'}
                              </Link>
                            </td>
                            <td className="px-4 py-2.5">
                              {tenant ? (
                                <Link href={`/tenants/${tenant.id}`} className="hover:underline">
                                  {tenant.name}
                                </Link>
                              ) : (
                                <span className="text-muted-foreground">Unmatched</span>
                              )}
                            </td>
                            <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground hidden sm:table-cell">
                              {t.extracted_check_number ?? '—'}
                            </td>
                            <td className="px-4 py-2.5 text-muted-foreground hidden md:table-cell">
                              {t.extracted_check_date ?? '—'}
                            </td>
                            <td className="px-4 py-2.5 text-right font-medium">
                              {t.extracted_amount != null
                                ? `$${Number(t.extracted_amount).toFixed(2)}`
                                : '—'}
                            </td>
                            <td className="px-4 py-2.5">
                              <Badge
                                variant="outline"
                                className={`text-xs border ${STATUS_CLASS[t.status ?? ''] ?? 'bg-slate-100 text-slate-600 border-slate-200'}`}
                              >
                                {t.status ?? '—'}
                              </Badge>
                            </td>
                            <td className="px-4 py-2.5 text-right text-muted-foreground text-xs hidden lg:table-cell">
                              {t.ocr_confidence != null
                                ? `${(Number(t.ocr_confidence) * 100).toFixed(0)}%`
                                : '—'}
                            </td>
                          </tr>
                        )
                      })}
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
