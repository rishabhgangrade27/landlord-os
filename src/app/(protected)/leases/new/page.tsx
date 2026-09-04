'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { LinkButton } from '@/components/ui/link-button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { toast } from 'sonner'
import { ArrowLeft, AlertTriangle } from 'lucide-react'

type TenantOption = { id: string; name: string; case_number: string | null; status: string }
type PropertyOption = { id: string; nickname: string; address: string | null; status: string | null }
type ActiveLeaseWarning = { tenant_name: string; start_date: string; rent_amount: number }

function NewLeasePageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [tenants, setTenants] = useState<TenantOption[]>([])
  const [properties, setProperties] = useState<PropertyOption[]>([])
  const [activeLeaseWarning, setActiveLeaseWarning] = useState<ActiveLeaseWarning | null>(null)

  const [form, setForm] = useState({
    tenant_id:   searchParams.get('tenant_id')   ?? '',
    property_id: searchParams.get('property_id') ?? '',
    start_date:  '',
    end_date:    '',
    rent_amount: '',
    notes:       '',
    status:      'active',
  })

  useEffect(() => {
    // All tenants (active + moved_out) — the landlord might renew a moved_out tenant
    supabase
      .from('tenants')
      .select('id, name, case_number, status')
      .order('name')
      .then(({ data }) => setTenants((data ?? []) as TenantOption[]))

    // Properties that aren't sold/inactive
    supabase
      .from('properties')
      .select('id, nickname, address, status')
      .not('status', 'eq', 'Inactive')
      .order('nickname')
      .then(({ data }) => setProperties((data ?? []) as PropertyOption[]))
  }, [])

  async function checkForActiveLease(propertyId: string) {
    if (!propertyId) { setActiveLeaseWarning(null); return }
    const { data } = await supabase
      .from('leases')
      .select('tenant_id, start_date, rent_amount, tenants(name)')
      .eq('property_id', propertyId)
      .eq('status', 'active')
      .limit(1)
      .single()
    if (data) {
      const tenantName = (data.tenants as unknown as { name: string } | null)?.name ?? 'Unknown tenant'
      setActiveLeaseWarning({
        tenant_name: tenantName,
        start_date: data.start_date,
        rent_amount: data.rent_amount,
      })
    } else {
      setActiveLeaseWarning(null)
    }
  }

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.tenant_id || !form.property_id || !form.start_date || !form.rent_amount) {
      toast.error('Tenant, property, start date, and rent amount are required.')
      return
    }
    setLoading(true)

    const { data, error } = await supabase
      .from('leases')
      .insert({
        tenant_id:   form.tenant_id,
        property_id: form.property_id,
        unit_id:     form.property_id,   // same UUID — properties serve as units in this system
        start_date:  form.start_date,
        end_date:    form.end_date || null,
        rent_amount: parseFloat(form.rent_amount),
        status:      form.status,
        notes:       form.notes.trim() || null,
      })
      .select()
      .single()

    if (error) {
      toast.error(error.message)
      setLoading(false)
      return
    }

    // Mark the property as Occupied
    await supabase
      .from('properties')
      .update({ status: 'Occupied' })
      .eq('id', form.property_id)

    // Update tenant's unit_id so it resolves to the right property
    await supabase
      .from('tenants')
      .update({ unit_id: form.property_id, status: 'active' })
      .eq('id', form.tenant_id)

    toast.success('Lease created.')
    router.push(`/tenants/${form.tenant_id}`)
  }

  return (
    <div>
      <PageHeader
        title="Create Lease"
        description="Add a new lease for a tenant"
        action={
          <LinkButton variant="outline" size="sm" href="/leases">
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            Back
          </LinkButton>
        }
      />

      <div className="p-6 max-w-xl">
        <Card>
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-4">

              {/* Tenant */}
              <div className="space-y-2">
                <Label>Tenant <span className="text-destructive">*</span></Label>
                <Select value={form.tenant_id} onValueChange={(v) => set('tenant_id', v ?? '')}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select tenant" />
                  </SelectTrigger>
                  <SelectContent>
                    {tenants.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                        {t.case_number ? ` (${t.case_number})` : ''}
                        {t.status === 'moved_out' ? ' — moved out' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Property / Unit */}
              <div className="space-y-2">
                <Label>Property / Unit <span className="text-destructive">*</span></Label>
                <Select
                  value={form.property_id}
                  onValueChange={(v) => {
                    set('property_id', v ?? '')
                    checkForActiveLease(v ?? '')
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select property" />
                  </SelectTrigger>
                  <SelectContent>
                    {properties.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nickname}
                        {p.status && p.status !== 'Vacant' ? ` — ${p.status}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {activeLeaseWarning && (
                  <div className="flex items-start gap-2 rounded-md border border-yellow-300 bg-yellow-50 dark:border-yellow-700 dark:bg-yellow-950 px-3 py-2 text-sm text-yellow-800 dark:text-yellow-200">
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-yellow-600 dark:text-yellow-400" />
                    <span>
                      <strong>Active lease already exists</strong> — {activeLeaseWarning.tenant_name}, $
                      {activeLeaseWarning.rent_amount.toLocaleString()}/mo, from{' '}
                      {new Date(activeLeaseWarning.start_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}.
                      Creating another will make both show as active. Set the old one to "Expired" first
                      or change the status below to "Expired" if this is a correction.
                    </span>
                  </div>
                )}
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Date <span className="text-destructive">*</span></Label>
                  <Input
                    type="date"
                    value={form.start_date}
                    onChange={(e) => set('start_date', e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Date</Label>
                  <Input
                    type="date"
                    value={form.end_date}
                    onChange={(e) => set('end_date', e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Leave blank for month-to-month</p>
                </div>
              </div>

              {/* Rent */}
              <div className="space-y-2">
                <Label>Monthly Rent ($) <span className="text-destructive">*</span></Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="1200.00"
                  value={form.rent_amount}
                  onChange={(e) => set('rent_amount', e.target.value)}
                  required
                />
              </div>

              {/* Status */}
              <div className="space-y-2">
                <Label>Lease Status</Label>
                <Select value={form.status} onValueChange={(v) => set('status', v ?? '')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="expired">Expired</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label>Notes</Label>
                <Input
                  placeholder="e.g. Month-to-month renewal, verbal agreement, etc."
                  value={form.notes}
                  onChange={(e) => set('notes', e.target.value)}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button type="submit" disabled={loading}>
                  {loading ? 'Creating…' : 'Create Lease'}
                </Button>
                <Button type="button" variant="outline" onClick={() => router.back()}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function NewLeasePage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading…</div>}>
      <NewLeasePageContent />
    </Suspense>
  )
}
