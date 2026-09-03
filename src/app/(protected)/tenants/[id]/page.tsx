import { prisma } from '@/lib/db'
import { PageHeader } from '@/components/layout/page-header'
import { Badge } from '@/components/ui/badge'
import { LinkButton } from '@/components/ui/link-button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { EditTenantDialog } from './edit-tenant-dialog'
import { MaskedField } from './masked-field'
import { EditLeaseDialog } from '@/app/(protected)/leases/edit-lease-dialog'

export default async function TenantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const tenant = await prisma.tenant.findUnique({
    where: { id }
  })

  const leases = await prisma.lease.findMany({
    where: { tenant_id: id },
    include: {
      property: { select: { id: true, name: true, address: true, nickname: true } }
    },
    orderBy: { start_date: 'desc' }
  })

  let courtLedger: any[] = []
  try {
    courtLedger = await prisma.$queryRaw`SELECT * FROM view_court_ledger WHERE tenant_id = ${id} ORDER BY ledger_month, check_date`
  } catch (e) {}

  const legalNotices = await prisma.legalNotice.findMany({
    where: { tenant_id: id },
    select: { id: true, notice_type: true, status: true, generated_at: true, sent_at: true },
    orderBy: { generated_at: 'desc' },
    take: 10
  })

  if (!tenant) notFound()

  const activeLease = leases?.find((l: any) => l.status === 'active')
  const activeProperty = activeLease?.property ?? null

  const last4 = (v: string | null) => (v && v.length >= 4 ? v.slice(-4) : null)
  // Strip the real values before this object ever reaches a client component —
  // the edit dialog re-fetches/re-sends these fields only on explicit user action.
  const { ssn_encrypted: _ssn, state_id: _stateId, ...tenantSafe } = tenant

  return (
    <div>
      <PageHeader
        title={tenant.name}
        description={tenant.full_legal_name ?? tenant.case_number ?? ''}
        action={
          <div className="flex gap-2">
            <LinkButton variant="outline" size="sm" href="/tenants">
              <ArrowLeft className="w-4 h-4 mr-1.5" />
              Back
            </LinkButton>
            <EditTenantDialog
              tenant={tenantSafe}
              hasSsn={!!tenant.ssn_encrypted}
              hasStateId={!!tenant.state_id}
            />
          </div>
        }
      />

      <div className="p-4 md:p-6">
        <Tabs defaultValue="profile">
          {/* Scrollable tab bar on mobile */}
          <div className="overflow-x-auto pb-0.5 mb-6">
            <TabsList className="w-max">
              <TabsTrigger value="profile">Profile</TabsTrigger>
              <TabsTrigger value="leases">Leases ({leases?.length ?? 0})</TabsTrigger>
              <TabsTrigger value="court-ledger">Court Ledger</TabsTrigger>
              <TabsTrigger value="legal">Notices ({legalNotices?.length ?? 0})</TabsTrigger>
            </TabsList>
          </div>

          {/* Profile Tab */}
          <TabsContent value="profile" className="space-y-5">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                    Tenant Information
                  </CardTitle>
                  <Badge
                    variant={tenant.status === 'active' ? 'default' : 'secondary'}
                    className="capitalize"
                  >
                    {tenant.status ?? 'active'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-5">
                <div>
                  <p className="text-xs text-muted-foreground">Display Name</p>
                  <p className="text-sm font-medium">{tenant.name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Full Legal Name</p>
                  <p className="text-sm font-medium">{tenant.full_legal_name ?? '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">HRA Case Number</p>
                  <p className="text-sm font-medium font-mono">{tenant.case_number ?? '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Phone</p>
                  <p className="text-sm font-medium">{tenant.phone ?? '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="text-sm font-medium">{tenant.email ?? '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Address</p>
                  <p className="text-sm font-medium">{tenant.address ?? '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Household Size</p>
                  <p className="text-sm font-medium">{tenant.household_size ?? '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">SSN</p>
                  <MaskedField
                    tenantId={tenant.id}
                    field="ssn_encrypted"
                    last4={last4(tenant.ssn_encrypted)}
                    hasValue={!!tenant.ssn_encrypted}
                  />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">State ID</p>
                  <MaskedField
                    tenantId={tenant.id}
                    field="state_id"
                    last4={last4(tenant.state_id)}
                    hasValue={!!tenant.state_id}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Current Lease */}
            {activeLease && (
              <Card className="border-green-200 bg-green-50/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Current Lease</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Property</p>
                    {activeProperty ? (
                      <Link
                        href={`/properties/${activeProperty.id}`}
                        className="text-sm font-medium hover:underline text-primary"
                      >
                        {activeProperty.name ?? activeProperty.address ?? '—'}
                      </Link>
                    ) : (
                      <p className="text-sm font-medium">—</p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Monthly Rent</p>
                    <p className="text-sm font-medium">
                      ${Number(activeLease.rent_amount).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Lease Period</p>
                    <p className="text-sm font-medium">
                      {activeLease.start_date.toISOString().split('T')[0]} → {activeLease.end_date ? activeLease.end_date.toISOString().split('T')[0] : 'Ongoing'}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Quick links */}
            <div className="flex flex-wrap gap-3">
              <LinkButton variant="outline" size="sm" href={`/ledger?tenant_id=${id}`}>
                View Rent Ledger
              </LinkButton>
              <LinkButton variant="outline" size="sm" href={`/transactions?tenant_id=${id}`}>
                View Transactions
              </LinkButton>
            </div>
          </TabsContent>

          {/* Leases Tab */}
          <TabsContent value="leases">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold">Lease History</h3>
              <LinkButton size="sm" href={`/leases/new?tenant_id=${id}`}>+ Create Lease</LinkButton>
            </div>
            {!leases?.length ? (
              <p className="text-sm text-muted-foreground">No leases yet.</p>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/30">
                          <th className="text-left px-4 py-2 font-medium text-muted-foreground">Unit</th>
                          <th className="text-left px-4 py-2 font-medium text-muted-foreground hidden sm:table-cell">Start</th>
                          <th className="text-left px-4 py-2 font-medium text-muted-foreground hidden sm:table-cell">End</th>
                          <th className="text-left px-4 py-2 font-medium text-muted-foreground">Rent</th>
                          <th className="text-left px-4 py-2 font-medium text-muted-foreground">Status</th>
                          <th className="px-4 py-2"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {leases.map((l: any) => {
                          const prop = l.property
                          return (
                            <tr key={l.id} className="border-b last:border-0 hover:bg-muted/20">
                              <td className="px-4 py-2">
                                {prop ? (
                                  <Link href={`/properties/${prop.id}`} className="hover:underline text-primary">
                                    {prop.nickname ?? prop.name ?? prop.address ?? '—'}
                                  </Link>
                                ) : '—'}
                                <p className="text-xs text-muted-foreground sm:hidden mt-0.5">
                                  {l.start_date.toISOString().split('T')[0]} → {l.end_date ? l.end_date.toISOString().split('T')[0] : 'Ongoing'}
                                </p>
                              </td>
                              <td className="px-4 py-2 text-muted-foreground hidden sm:table-cell">
                                {l.start_date.toISOString().split('T')[0]}
                              </td>
                              <td className="px-4 py-2 text-muted-foreground hidden sm:table-cell">
                                {l.end_date ? l.end_date.toISOString().split('T')[0] : 'Ongoing'}
                              </td>
                              <td className="px-4 py-2">${Number(l.rent_amount).toLocaleString()}/mo</td>
                              <td className="px-4 py-2">
                                <Badge
                                  variant={l.status === 'active' ? 'default' : 'secondary'}
                                  className="text-xs capitalize"
                                >
                                  {l.status}
                                </Badge>
                              </td>
                              <td className="px-4 py-2 text-right">
                                <EditLeaseDialog
                                  lease={{
                                    id: l.id,
                                    property_id: prop?.id ?? null,
                                    start_date: l.start_date.toISOString().split('T')[0],
                                    end_date: l.end_date ? l.end_date.toISOString().split('T')[0] : null,
                                    rent_amount: Number(l.rent_amount),
                                    status: l.status,
                                    notes: l.notes ?? null,
                                  }}
                                  tenantName={tenant.name}
                                />
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
          </TabsContent>

          {/* Court Ledger Tab */}
          <TabsContent value="court-ledger">
            <div className="flex flex-wrap justify-between items-center mb-4 gap-2">
              <h3 className="font-semibold">Court Ledger — Per-Check Detail</h3>
            </div>
            {!courtLedger?.length ? (
              <p className="text-sm text-muted-foreground">
                No transactions linked to this tenant. Upload receipts and run matching first.
              </p>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/30">
                          <th className="text-left px-4 py-2 font-medium text-muted-foreground">Month</th>
                          <th className="text-left px-4 py-2 font-medium text-muted-foreground">Check #</th>
                          <th className="text-left px-4 py-2 font-medium text-muted-foreground hidden sm:table-cell">Date</th>
                          <th className="text-right px-4 py-2 font-medium text-muted-foreground">Amount</th>
                          <th className="text-right px-4 py-2 font-medium text-muted-foreground hidden md:table-cell">Rent Due</th>
                          <th className="text-right px-4 py-2 font-medium text-muted-foreground">Balance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {courtLedger.map((row: any, i: number) => (
                          <tr key={i} className="border-b last:border-0">
                            <td className="px-4 py-2 text-muted-foreground">{row.month_label}</td>
                            <td className="px-4 py-2 font-mono text-xs">{row.check_number ?? '—'}</td>
                            <td className="px-4 py-2 text-muted-foreground hidden sm:table-cell">
                              {row.check_date ?? '—'}
                            </td>
                            <td className="px-4 py-2 text-right font-medium">
                              ${Number(row.amount ?? 0).toFixed(2)}
                            </td>
                            <td className="px-4 py-2 text-right text-muted-foreground hidden md:table-cell">
                              ${Number(row.monthly_due ?? 0).toFixed(2)}
                            </td>
                            <td className={`px-4 py-2 text-right font-medium ${Number(row.running_balance ?? 0) > 0 ? 'text-destructive' : 'text-green-600'}`}>
                              ${Number(row.running_balance ?? 0).toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Legal Notices Tab */}
          <TabsContent value="legal">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold">Legal Notices</h3>
              <LinkButton size="sm" href="/legal-notices">Go to Legal Notices</LinkButton>
            </div>
            {!legalNotices?.length ? (
              <p className="text-sm text-muted-foreground">No legal notices for this tenant.</p>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/30">
                          <th className="text-left px-4 py-2 font-medium text-muted-foreground">Type</th>
                          <th className="text-left px-4 py-2 font-medium text-muted-foreground">Status</th>
                          <th className="text-left px-4 py-2 font-medium text-muted-foreground hidden sm:table-cell">Generated</th>
                          <th className="text-left px-4 py-2 font-medium text-muted-foreground hidden sm:table-cell">Sent</th>
                        </tr>
                      </thead>
                      <tbody>
                        {legalNotices.map((n: any) => (
                          <tr key={n.id} className="border-b last:border-0 hover:bg-muted/20">
                            <td className="px-4 py-2">
                              <Link
                                href={`/legal-notices/${n.id}`}
                                className="hover:underline text-primary capitalize"
                              >
                                {n.notice_type?.replace(/_/g, ' ')}
                              </Link>
                            </td>
                            <td className="px-4 py-2">
                              <Badge variant="secondary" className="text-xs capitalize">
                                {n.status}
                              </Badge>
                            </td>
                            <td className="px-4 py-2 text-muted-foreground hidden sm:table-cell">
                              {n.generated_at ? new Date(n.generated_at).toLocaleDateString() : '—'}
                            </td>
                            <td className="px-4 py-2 text-muted-foreground hidden sm:table-cell">
                              {n.sent_at ? new Date(n.sent_at).toLocaleDateString() : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
