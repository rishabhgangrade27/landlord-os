import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/layout/page-header'
import Link from 'next/link'
import {
  Building2,
  Users,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Scale,
  Wrench,
} from 'lucide-react'

export default async function DashboardPage() {
  const supabase = await createClient()

  const [
    { count: propertyCount },
    { count: tenantCount },
    { count: activeLeaseCount },
    { data: overdueRows },
    { data: recentTransactions },
    { count: pendingReviewCount },
    { count: maintenanceOpen },
    { count: draftNoticeCount },
  ] = await Promise.all([
    supabase.from('properties').select('*', { count: 'exact', head: true }),
    supabase.from('tenants').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('leases').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabase
      .from('view_rent_ledger')
      .select('tenant_id, unit_id, month, pending_balance, flag_30_day, flag_60_day')
      .or('flag_30_day.eq.true,flag_60_day.eq.true')
      .order('month', { ascending: false })
      .limit(20),
    supabase
      .from('transactions')
      .select('id, extracted_amount, extracted_check_date, status, extracted_case_number')
      .in('status', ['processing', 'verified'])
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'needs_review'),
    supabase
      .from('maintenance_tickets')
      .select('*', { count: 'exact', head: true })
      .in('status', ['reported', 'reviewed', 'assigned', 'in_progress']),
    supabase
      .from('legal_notices')
      .select('*', { count: 'exact', head: true })
      .in('status', ['draft', 'generated']),
  ])

  const flag60Count = overdueRows?.filter((r) => r.flag_60_day).length ?? 0
  const flag30Count = overdueRows?.filter((r) => r.flag_30_day && !r.flag_60_day).length ?? 0

  return (
    <div>
      <PageHeader title="Dashboard" description="Overview of your properties" />

      <div className="p-6 space-y-6">
        {/* Row 1: Core counts */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">Properties</CardTitle>
              <Building2 className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{propertyCount ?? 0}</p>
              <Link href="/properties" className="text-xs text-muted-foreground hover:underline">
                View all →
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">Active Tenants</CardTitle>
              <Users className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{tenantCount ?? 0}</p>
              <Link href="/tenants" className="text-xs text-muted-foreground hover:underline">
                View all →
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">Active Leases</CardTitle>
              <CheckCircle2 className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{activeLeaseCount ?? 0}</p>
              <Link href="/leases" className="text-xs text-muted-foreground hover:underline">
                View all →
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">Needs Review</CardTitle>
              <Clock className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{pendingReviewCount ?? 0}</p>
              <Link
                href="/transactions?status=needs_review"
                className="text-xs text-muted-foreground hover:underline"
              >
                Review now →
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Row 2: Action counts */}
        <div className="grid grid-cols-2 lg:grid-cols-2 gap-4">
          <Card className={draftNoticeCount ? 'border-amber-200 bg-amber-50/30' : ''}>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Draft Legal Notices
              </CardTitle>
              <Scale className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className={`text-2xl font-bold ${draftNoticeCount ? 'text-amber-600' : ''}`}>
                {draftNoticeCount ?? 0}
              </p>
              <Link
                href="/legal-notices?tab=draft"
                className="text-xs text-muted-foreground hover:underline"
              >
                {draftNoticeCount ? 'Review drafts →' : 'View notices →'}
              </Link>
            </CardContent>
          </Card>

          <Card className={maintenanceOpen ? 'border-blue-200' : ''}>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Open Maintenance
              </CardTitle>
              <Wrench className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{maintenanceOpen ?? 0}</p>
              <Link href="/maintenance" className="text-xs text-muted-foreground hover:underline">
                View tickets →
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Overdue Alerts */}
        {(flag30Count > 0 || flag60Count > 0) && (
          <Card className="border-orange-200 bg-orange-50/50">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="w-4 h-4 text-orange-500" />
                Overdue Rent Alerts
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {flag60Count > 0 && (
                <div className="flex items-center justify-between rounded-md border border-red-200 bg-red-50 p-3">
                  <span className="text-sm font-medium text-red-700">
                    {flag60Count} tenant{flag60Count > 1 ? 's' : ''} 60+ days overdue
                  </span>
                  <Link href="/ledger?filter=60day">
                    <Badge variant="destructive" className="cursor-pointer hover:opacity-80">
                      View
                    </Badge>
                  </Link>
                </div>
              )}
              {flag30Count > 0 && (
                <div className="flex items-center justify-between rounded-md border border-orange-200 bg-orange-50 p-3">
                  <span className="text-sm font-medium text-orange-700">
                    {flag30Count} tenant{flag30Count > 1 ? 's' : ''} 30 days overdue
                  </span>
                  <Link href="/ledger?filter=30day">
                    <Badge className="cursor-pointer bg-orange-500 hover:bg-orange-600">View</Badge>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Recent Transactions + Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between text-base">
                Recent Transactions
                <Link
                  href="/transactions"
                  className="text-xs font-normal text-muted-foreground hover:underline"
                >
                  View all →
                </Link>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!recentTransactions?.length ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  No transactions yet.{' '}
                  <Link href="/upload" className="underline">
                    Upload receipts
                  </Link>{' '}
                  to get started.
                </p>
              ) : (
                <div className="space-y-2">
                  {recentTransactions.map((t) => (
                    <Link
                      key={t.id}
                      href={`/transactions/${t.id}`}
                      className="flex items-center justify-between rounded-md px-3 py-2 transition-colors hover:bg-muted/50"
                    >
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">
                          {t.extracted_case_number ?? 'Unknown case'}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {t.extracted_check_date ?? '—'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">
                          ${t.extracted_amount?.toFixed(2) ?? '0.00'}
                        </span>
                        <Badge
                          variant={t.status === 'verified' ? 'default' : 'secondary'}
                          className="text-xs"
                        >
                          {t.status}
                        </Badge>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {[
                { href: '/upload', label: 'Upload Receipt PDFs', icon: '📄', desc: 'Process new HRA checks' },
                { href: '/ledger', label: 'View Rent Ledger', icon: '📊', desc: 'Check payment status' },
                { href: '/legal-notices/new', label: 'Generate Legal Notice', icon: '⚖️', desc: 'Create 30/60/90-day notice' },
                { href: '/tenants/new', label: 'Add New Tenant', icon: '👤', desc: 'Create tenant profile' },
                { href: '/maintenance/new', label: 'New Maintenance Ticket', icon: '🔧', desc: `${maintenanceOpen ?? 0} open tickets` },
              ].map((action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  className="flex items-center gap-3 rounded-md border p-3 transition-colors hover:bg-muted/50"
                >
                  <span className="text-lg">{action.icon}</span>
                  <div>
                    <p className="text-sm font-medium">{action.label}</p>
                    <p className="text-xs text-muted-foreground">{action.desc}</p>
                  </div>
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
