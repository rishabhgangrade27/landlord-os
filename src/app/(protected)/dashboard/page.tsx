import { prisma } from '@/lib/db'

// Plain Prisma reads in a Server Component don't trigger a Request-time API,
// so Next.js would otherwise statically prerender this at build time and
// never refresh it in production (`next start`) — a live business dashboard
// showing frozen build-day counts. Force it dynamic on every request.
export const dynamic = 'force-dynamic'
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
  const [
    propertyCount,
    tenantCount,
    activeLeaseCount,
    recentTransactions,
    pendingReviewCount,
    maintenanceOpen,
    draftNoticeCount,
  ] = await Promise.all([
    prisma.property.count(),
    prisma.tenant.count({ where: { status: 'active' } }),
    prisma.lease.count({ where: { status: 'active' } }),
    prisma.transaction.findMany({
      where: { status: { in: ['processing', 'verified'] }, deleted_at: null },
      select: { id: true, extracted_amount: true, extracted_check_date: true, status: true, extracted_case_number: true },
      orderBy: { created_at: 'desc' },
      take: 5
    }),
    prisma.transaction.count({ where: { status: 'needs_review', deleted_at: null } }),
    prisma.maintenanceTicket.count({ where: { status: { in: ['reported', 'reviewed', 'assigned', 'in_progress'] } } }),
    prisma.legalNotice.count({ where: { status: { in: ['draft', 'generated'] } } }),
  ])

  // Same "one row per tenant, their latest month" pattern as
  // src/lib/overdue-check.ts — never sum/count across months, that's the
  // Flemister $108,852 bug from before the Postgres migration.
  const latestLedgerRows = await prisma.$queryRaw<{ flag_30_day: boolean; flag_60_day: boolean }[]>`
    SELECT DISTINCT ON (tenant_id) flag_30_day, flag_60_day
    FROM view_rent_ledger
    ORDER BY tenant_id, month DESC
  `
  const flag60Count = latestLedgerRows.filter((r) => r.flag_60_day).length
  const flag30Count = latestLedgerRows.filter((r) => r.flag_30_day && !r.flag_60_day).length

  return (
    <div>
      <PageHeader title="Dashboard" description="Overview of your properties" />

      <div className="p-4 md:p-6 space-y-6">
        {/* Row 1: Core counts */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-l-4 border-l-indigo-400">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">Properties</CardTitle>
              <Building2 className="w-4 h-4 text-indigo-500" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{propertyCount ?? 0}</p>
              <Link href="/properties" className="text-xs text-muted-foreground hover:underline">
                View all →
              </Link>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-emerald-400">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">Active Tenants</CardTitle>
              <Users className="w-4 h-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{tenantCount ?? 0}</p>
              <Link href="/tenants" className="text-xs text-muted-foreground hover:underline">
                View all →
              </Link>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-sky-400">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">Active Leases</CardTitle>
              <CheckCircle2 className="w-4 h-4 text-sky-500" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{activeLeaseCount ?? 0}</p>
              <Link href="/leases" className="text-xs text-muted-foreground hover:underline">
                View all →
              </Link>
            </CardContent>
          </Card>

          <Card className={`border-l-4 ${(pendingReviewCount ?? 0) > 0 ? 'border-l-amber-400 bg-amber-50/30' : 'border-l-slate-200'}`}>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">Needs Review</CardTitle>
              <Clock className={`w-4 h-4 ${(pendingReviewCount ?? 0) > 0 ? 'text-amber-500' : 'text-muted-foreground'}`} />
            </CardHeader>
            <CardContent>
              <p className={`text-2xl font-bold ${(pendingReviewCount ?? 0) > 0 ? 'text-amber-600' : ''}`}>
                {pendingReviewCount ?? 0}
              </p>
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
          <Card className={`border-l-4 ${draftNoticeCount ? 'border-l-amber-400 border-amber-200 bg-amber-50/30' : 'border-l-slate-200'}`}>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Draft Legal Notices
              </CardTitle>
              <Scale className={`w-4 h-4 ${draftNoticeCount ? 'text-amber-500' : 'text-muted-foreground'}`} />
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

          <Card className={`border-l-4 ${maintenanceOpen ? 'border-l-blue-400 border-blue-200' : 'border-l-slate-200'}`}>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Open Maintenance
              </CardTitle>
              <Wrench className={`w-4 h-4 ${maintenanceOpen ? 'text-blue-500' : 'text-muted-foreground'}`} />
            </CardHeader>
            <CardContent>
              <p className={`text-2xl font-bold ${maintenanceOpen ? 'text-blue-600' : ''}`}>
                {maintenanceOpen ?? 0}
              </p>
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
                          variant="outline"
                          className={`text-xs border ${
                            t.status === 'verified'
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                              : 'bg-blue-100 text-blue-800 border-blue-200'
                          }`}
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
