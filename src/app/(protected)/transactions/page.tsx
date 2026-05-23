import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/layout/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import Link from 'next/link'
import { Filter } from 'lucide-react'

const STATUS_COLORS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  verified: 'default',
  processing: 'secondary',
  needs_review: 'outline',
  blank_detected: 'secondary',
  duplicate_suspected: 'destructive',
  rejected: 'destructive',
}

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; tenant_id?: string }>
}) {
  const { status, tenant_id } = await searchParams
  const supabase = await createClient()

  let query = supabase
    .from('transactions')
    .select(`
      id, extracted_case_number, extracted_check_number, extracted_amount,
      extracted_check_date, status, duplicate_suspected, ocr_confidence,
      matched_tenant_id, created_at,
      tenants:matched_tenant_id(id, name)
    `)
    .order('created_at', { ascending: false })
    .limit(200)

  if (status) query = query.eq('status', status)
  if (tenant_id) query = query.eq('matched_tenant_id', tenant_id)

  const { data: transactions } = await query

  const statuses = [
    { value: '', label: 'All' },
    { value: 'needs_review', label: 'Needs Review' },
    { value: 'processing', label: 'Processing' },
    { value: 'verified', label: 'Verified' },
    { value: 'duplicate_suspected', label: 'Duplicates' },
    { value: 'blank_detected', label: 'Blank' },
  ]

  return (
    <div>
      <PageHeader
        title="Transactions"
        description="All extracted check records from uploaded PDFs"
      />

      <div className="p-6 space-y-4">
        {/* Status filter tabs */}
        <div className="flex flex-wrap gap-2">
          {statuses.map((s) => (
            <Link
              key={s.value}
              href={s.value ? `/transactions?status=${s.value}` : '/transactions'}
            >
              <Badge
                variant={status === s.value || (!status && !s.value) ? 'default' : 'outline'}
                className="cursor-pointer"
              >
                {s.label}
              </Badge>
            </Link>
          ))}
        </div>

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
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Case #</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Tenant</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Check #</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground">Amount</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground">Confidence</th>
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
                          <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                            {t.extracted_check_number ?? '—'}
                          </td>
                          <td className="px-4 py-2.5 text-muted-foreground">
                            {t.extracted_check_date ?? '—'}
                          </td>
                          <td className="px-4 py-2.5 text-right font-medium">
                            {t.extracted_amount != null
                              ? `$${Number(t.extracted_amount).toFixed(2)}`
                              : '—'}
                          </td>
                          <td className="px-4 py-2.5">
                            <Badge
                              variant={STATUS_COLORS[t.status ?? ''] ?? 'secondary'}
                              className="text-xs"
                            >
                              {t.status ?? '—'}
                            </Badge>
                          </td>
                          <td className="px-4 py-2.5 text-right text-muted-foreground text-xs">
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
        )}
      </div>
    </div>
  )
}
