import { createClient } from '@/lib/supabase/server'
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

export default async function TenantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: tenant }, { data: leases }, { data: courtLedger }, { data: legalNotices }] =
    await Promise.all([
      supabase.from('tenants').select('*').eq('id', id).single(),
      supabase
        .from('leases')
        .select('*, units(unit_number, properties(name, address))')
        .eq('tenant_id', id)
        .order('start_date', { ascending: false }),
      supabase
        .from('view_court_ledger')
        .select('*')
        .eq('tenant_id', id)
        .order('ledger_month')
        .order('check_date'),
      supabase
        .from('legal_notices')
        .select('id, notice_type, status, generated_at, sent_at')
        .eq('tenant_id', id)
        .order('generated_at', { ascending: false })
        .limit(10),
    ])

  if (!tenant) notFound()

  const activeLease = leases?.find((l) => l.status === 'active')

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
            <EditTenantDialog tenant={tenant} />
          </div>
        }
      />

      <div className="p-6">
        <Tabs defaultValue="profile">
          <TabsList className="mb-6">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="leases">Leases ({leases?.length ?? 0})</TabsTrigger>
            <TabsTrigger value="court-ledger">Court Ledger</TabsTrigger>
            <TabsTrigger value="legal">Legal Notices ({legalNotices?.length ?? 0})</TabsTrigger>
          </TabsList>

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
                  <MaskedField value={tenant.ssn_encrypted} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">State ID</p>
                  <MaskedField value={tenant.state_id} />
                </div>
              </CardContent>
            </Card>

            {/* Current Unit */}
            {activeLease && (
              <Card className="border-green-200 bg-green-50/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Current Unit & Lease</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Property</p>
                    <p className="text-sm font-medium">
                      {(activeLease as any).units?.properties?.name ??
                        (activeLease as any).units?.properties?.address ?? '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Unit</p>
                    <Link
                      href={`/units/${activeLease.unit_id}`}
                      className="text-sm font-medium hover:underline text-primary"
                    >
                      {(activeLease as any).units?.unit_number ?? '—'}
                    </Link>
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
                      {activeLease.start_date} → {activeLease.end_date ?? 'Ongoing'}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Rent Ledger Link */}
            <div className="flex gap-3">
              <LinkButton variant="outline" size="sm" href={`/ledger?tenant_id=${id}`}>View Rent Ledger</LinkButton>
              <LinkButton variant="outline" size="sm" href={`/transactions?tenant_id=${id}`}>View Transactions</LinkButton>
            </div>
          </TabsContent>

          {/* Leases Tab */}
          <TabsContent value="leases">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold">Lease History</h3>
              <LinkButton size="sm" href={`/leases/new?tenant_id=${id}`}>Create Lease</LinkButton>
            </div>
            {!leases?.length ? (
              <p className="text-sm text-muted-foreground">No leases yet.</p>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="text-left px-4 py-2 font-medium text-muted-foreground">Unit</th>
                        <th className="text-left px-4 py-2 font-medium text-muted-foreground">Start</th>
                        <th className="text-left px-4 py-2 font-medium text-muted-foreground">End</th>
                        <th className="text-left px-4 py-2 font-medium text-muted-foreground">Rent</th>
                        <th className="text-left px-4 py-2 font-medium text-muted-foreground">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leases.map((l) => (
                        <tr key={l.id} className="border-b last:border-0 hover:bg-muted/20">
                          <td className="px-4 py-2">
                            <Link href={`/units/${l.unit_id}`} className="hover:underline text-primary">
                              {(l as any).units?.unit_number ?? '—'}
                            </Link>
                          </td>
                          <td className="px-4 py-2 text-muted-foreground">{l.start_date}</td>
                          <td className="px-4 py-2 text-muted-foreground">{l.end_date ?? 'Ongoing'}</td>
                          <td className="px-4 py-2">${Number(l.rent_amount).toLocaleString()}/mo</td>
                          <td className="px-4 py-2">
                            <Badge
                              variant={l.status === 'active' ? 'default' : 'secondary'}
                              className="text-xs capitalize"
                            >
                              {l.status}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Court Ledger Tab */}
          <TabsContent value="court-ledger">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold">Court Ledger — Per-Check Detail</h3>
              <LinkButton size="sm" variant="outline" href={`/ledger?tenant_id=${id}&export=court`}>Export PDF</LinkButton>
            </div>
            {!courtLedger?.length ? (
              <p className="text-sm text-muted-foreground">
                No transactions linked to this tenant. Upload receipts and run matching first.
              </p>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="text-left px-4 py-2 font-medium text-muted-foreground">Month</th>
                        <th className="text-left px-4 py-2 font-medium text-muted-foreground">Check #</th>
                        <th className="text-left px-4 py-2 font-medium text-muted-foreground">Date</th>
                        <th className="text-right px-4 py-2 font-medium text-muted-foreground">Amount</th>
                        <th className="text-right px-4 py-2 font-medium text-muted-foreground">Rent Due</th>
                        <th className="text-right px-4 py-2 font-medium text-muted-foreground">Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {courtLedger.map((row, i) => (
                        <tr key={i} className="border-b last:border-0">
                          <td className="px-4 py-2 text-muted-foreground">{row.month_label}</td>
                          <td className="px-4 py-2 font-mono text-xs">{row.check_number ?? '—'}</td>
                          <td className="px-4 py-2 text-muted-foreground">{row.check_date ?? '—'}</td>
                          <td className="px-4 py-2 text-right font-medium">
                            ${Number(row.amount ?? 0).toFixed(2)}
                          </td>
                          <td className="px-4 py-2 text-right text-muted-foreground">
                            ${Number(row.monthly_due ?? 0).toFixed(2)}
                          </td>
                          <td className={`px-4 py-2 text-right font-medium ${Number(row.running_balance ?? 0) > 0 ? 'text-destructive' : 'text-green-600'}`}>
                            ${Number(row.running_balance ?? 0).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="text-left px-4 py-2 font-medium text-muted-foreground">Type</th>
                        <th className="text-left px-4 py-2 font-medium text-muted-foreground">Status</th>
                        <th className="text-left px-4 py-2 font-medium text-muted-foreground">Generated</th>
                        <th className="text-left px-4 py-2 font-medium text-muted-foreground">Sent</th>
                      </tr>
                    </thead>
                    <tbody>
                      {legalNotices.map((n) => (
                        <tr key={n.id} className="border-b last:border-0 hover:bg-muted/20">
                          <td className="px-4 py-2">
                            <Link href={`/legal-notices/${n.id}`} className="hover:underline text-primary capitalize">
                              {n.notice_type?.replace(/_/g, ' ')}
                            </Link>
                          </td>
                          <td className="px-4 py-2">
                            <Badge variant="secondary" className="text-xs capitalize">
                              {n.status}
                            </Badge>
                          </td>
                          <td className="px-4 py-2 text-muted-foreground">
                            {n.generated_at ? new Date(n.generated_at).toLocaleDateString() : '—'}
                          </td>
                          <td className="px-4 py-2 text-muted-foreground">
                            {n.sent_at ? new Date(n.sent_at).toLocaleDateString() : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
