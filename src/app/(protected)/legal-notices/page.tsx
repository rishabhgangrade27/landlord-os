import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/layout/page-header'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { LinkButton } from '@/components/ui/link-button'
import Link from 'next/link'
import { Scale, Plus } from 'lucide-react'

const STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  draft: 'secondary',
  generated: 'outline',
  pending_attorney: 'outline',
  attorney_reviewed: 'default',
  sent: 'default',
  cancelled: 'destructive',
}

const NOTICE_LABELS: Record<string, string> = {
  notice_5day:           '5-Day Non-Payment (Court)',
  notice_30day:          '30-Day Landlord Cure Notice',
  non_payment_30day:     '30-Day HRA Demand (to HRA)',
  non_payment_60day:     '14-Day Notice of Cure',
  notice_90day:          '90-Day Termination (Eviction)',
  notice_90day_sunrise:  '90-Day Notice (Sunrise)',
  notice_90day_willow:   '90-Day Notice (Willow)',
  court_form:            'Court — Holdover',
  court_form_nonpayment: 'Court — Non-Payment',
}

const TABS = [
  { key: 'all', label: 'All', statuses: null },
  { key: 'draft', label: 'Draft', statuses: ['draft', 'generated'] },
  { key: 'attorney', label: 'Pending Attorney', statuses: ['pending_attorney', 'attorney_reviewed'] },
  { key: 'sent', label: 'Sent', statuses: ['sent'] },
]

export default async function LegalNoticesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { tab = 'all' } = await searchParams
  const supabase = await createClient()

  const activeTab = TABS.find((t) => t.key === tab) ?? TABS[0]

  let query = supabase
    .from('legal_notices')
    .select(`
      id, notice_type, status, generated_at, sent_at, attorney_email,
      tenants(id, name, case_number)
    `)
    .order('generated_at', { ascending: false })

  if (activeTab.statuses) {
    query = query.in('status', activeTab.statuses)
  }

  const { data: notices } = await query

  // Counts for tab badges
  const { data: allNotices } = await supabase
    .from('legal_notices')
    .select('status')
  const counts = {
    all: allNotices?.length ?? 0,
    draft: allNotices?.filter((n) => n.status === 'draft' || n.status === 'generated').length ?? 0,
    attorney: allNotices?.filter((n) => n.status === 'pending_attorney' || n.status === 'attorney_reviewed').length ?? 0,
    sent: allNotices?.filter((n) => n.status === 'sent').length ?? 0,
  }

  return (
    <div>
      <PageHeader
        title="Legal Notices"
        description="System prepares notices — admin reviews and sends"
        action={
          <LinkButton href="/legal-notices/new" size="sm">
            <Plus className="w-4 h-4 mr-1.5" />
            Generate Notice
          </LinkButton>
        }
      />

      <div className="p-4 md:p-6">
        {/* Tab navigation */}
        <div className="flex gap-1 mb-5 border-b overflow-x-auto">
          {TABS.map((t) => {
            const count = counts[t.key as keyof typeof counts]
            const isActive = tab === t.key || (!tab && t.key === 'all')
            return (
              <Link
                key={t.key}
                href={`/legal-notices?tab=${t.key}`}
                className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  isActive
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {t.label}
                {count > 0 && (
                  <Badge
                    variant={isActive ? 'default' : 'secondary'}
                    className="text-xs px-1.5 py-0 h-4 min-w-4"
                  >
                    {count}
                  </Badge>
                )}
              </Link>
            )
          })}
        </div>

        {!notices?.length ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Scale className="mb-3 h-10 w-10 text-muted-foreground" />
            <h3 className="mb-1 font-semibold">No notices in this tab</h3>
            <p className="text-sm text-muted-foreground">
              {tab === 'all'
                ? 'Notices are created when you click "Generate Notice" or when the daily overdue cron runs.'
                : `No notices with status: ${activeTab.label}.`}
            </p>
            {tab === 'all' && (
              <div className="mt-4">
                <LinkButton href="/legal-notices/new" size="sm">
                  Generate First Notice
                </LinkButton>
              </div>
            )}
          </div>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Tenant</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden sm:table-cell">Notice Type</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden md:table-cell">Generated</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {notices.map((n) => {
                      const tenant = (n as any).tenants
                      return (
                        <tr key={n.id} className="border-b last:border-0 hover:bg-muted/20">
                          <td className="px-4 py-3">
                            {tenant ? (
                              <Link
                                href={`/tenants/${tenant.id}`}
                                className="font-medium text-primary hover:underline"
                              >
                                {tenant.name}
                              </Link>
                            ) : (
                              '—'
                            )}
                            <p className="text-xs text-muted-foreground sm:hidden mt-0.5">
                              {NOTICE_LABELS[n.notice_type ?? ''] ?? n.notice_type ?? '—'}
                            </p>
                          </td>
                          <td className="px-4 py-3 font-medium hidden sm:table-cell">
                            {NOTICE_LABELS[n.notice_type ?? ''] ?? n.notice_type ?? '—'}
                          </td>
                          <td className="px-4 py-3">
                            <Badge
                              variant={STATUS_VARIANTS[n.status ?? ''] ?? 'secondary'}
                              className="text-xs capitalize"
                            >
                              {n.status?.replace(/_/g, ' ') ?? '—'}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground hidden md:table-cell">
                            {n.generated_at
                              ? new Date(n.generated_at).toLocaleDateString()
                              : '—'}
                          </td>
                          <td className="px-4 py-3">
                            <Link href={`/legal-notices/${n.id}`}>
                              <Badge
                                variant="outline"
                                className="cursor-pointer text-xs hover:bg-muted"
                              >
                                View
                              </Badge>
                            </Link>
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
