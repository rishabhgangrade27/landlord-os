'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { LinkButton } from '@/components/ui/link-button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { toast } from 'sonner'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'

type TenantOption = { id: string; name: string; case_number: string | null; status: string | null }

type CheckLine = { check_number: string; amount: string }

function ManualEntryContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const [loading, setLoading] = useState(false)
  const [tenants, setTenants] = useState<TenantOption[]>([])

  const [tenantId, setTenantId] = useState(searchParams.get('tenant_id') ?? '')
  const [paymentDate, setPaymentDate] = useState('')
  const [rentFrom, setRentFrom] = useState('')
  const [rentTo, setRentTo] = useState('')
  const [notes, setNotes] = useState('')
  const [checks, setChecks] = useState<CheckLine[]>([{ check_number: '', amount: '' }])

  useEffect(() => {
    supabase
      .from('tenants')
      .select('id, name, case_number, status')
      .order('name')
      .then(({ data }) => setTenants((data ?? []) as TenantOption[]))
  }, [])

  function addCheck() {
    setChecks((prev) => [...prev, { check_number: '', amount: '' }])
  }

  function removeCheck(idx: number) {
    setChecks((prev) => prev.filter((_, i) => i !== idx))
  }

  function updateCheck(idx: number, field: keyof CheckLine, value: string) {
    setChecks((prev) => prev.map((c, i) => i === idx ? { ...c, [field]: value } : c))
  }

  const totalAmount = checks.reduce((sum, c) => sum + (parseFloat(c.amount) || 0), 0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!tenantId) { toast.error('Select a tenant.'); return }
    if (!paymentDate) { toast.error('Payment date is required.'); return }

    const validChecks = checks.filter((c) => parseFloat(c.amount) > 0)
    if (!validChecks.length) { toast.error('Enter at least one amount.'); return }

    setLoading(true)

    const insertRows = validChecks.map((c) => ({
      matched_tenant_id: tenantId,
      extracted_amount: parseFloat(c.amount),
      extracted_check_number: c.check_number.trim() || null,
      extracted_check_date: paymentDate,
      extracted_rent_from: rentFrom || null,
      extracted_rent_to: rentTo || null,
      status: 'verified' as const,
      source: 'manual_entry' as const,
      file_bucket: 'receipts',
      created_by: 'admin',
      updated_by: 'admin',
      processed_by: 'admin',
      review_notes: notes.trim()
        ? `Manual entry: ${notes.trim()}`
        : 'Manual entry by admin — no PDF.',
    }))

    const { error } = await supabase.from('transactions').insert(insertRows)

    if (error) {
      toast.error(error.message)
      setLoading(false)
      return
    }

    const plural = validChecks.length > 1 ? `${validChecks.length} payments` : '1 payment'
    toast.success(`${plural} added — $${totalAmount.toFixed(2)} total.`)
    router.push(tenantId ? `/ledger?tenant_id=${tenantId}` : '/transactions')
  }

  return (
    <div>
      <PageHeader
        title="Add Manual Payment"
        description="Enter a payment that has no PDF — lost check, catch-up, etc."
        action={
          <LinkButton variant="outline" size="sm" href="/transactions">
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            Back
          </LinkButton>
        }
      />

      <div className="p-6 max-w-xl">
        <Card>
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-5">

              {/* Tenant */}
              <div className="space-y-2">
                <Label>Tenant <span className="text-destructive">*</span></Label>
                <Select value={tenantId} onValueChange={(v) => setTenantId(v ?? '')}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select tenant" />
                  </SelectTrigger>
                  <SelectContent>
                    {tenants.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                        {t.status === 'moved_out' ? ' (moved out)' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Payment date */}
              <div className="space-y-2">
                <Label>Payment Date <span className="text-destructive">*</span></Label>
                <Input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  required
                />
              </div>

              {/* Rent period */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Rent Period — From</Label>
                  <Input
                    type="date"
                    value={rentFrom}
                    onChange={(e) => setRentFrom(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Rent Period — To</Label>
                  <Input
                    type="date"
                    value={rentTo}
                    onChange={(e) => setRentTo(e.target.value)}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground -mt-3">
                Optional. Used to assign checks to the correct month in the ledger.
              </p>

              {/* Check lines */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Checks / Amounts</Label>
                  <button
                    type="button"
                    onClick={addCheck}
                    className="text-xs text-primary hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    Add check
                  </button>
                </div>

                {checks.map((c, idx) => (
                  <div key={idx} className="flex gap-2 items-start">
                    <div className="flex-1 space-y-1">
                      <Input
                        placeholder="Check # (optional)"
                        value={c.check_number}
                        onChange={(e) => updateCheck(idx, 'check_number', e.target.value)}
                      />
                    </div>
                    <div className="w-36 space-y-1">
                      <Input
                        type="number"
                        step="0.01"
                        min="0.01"
                        placeholder="Amount $"
                        value={c.amount}
                        onChange={(e) => updateCheck(idx, 'amount', e.target.value)}
                      />
                    </div>
                    {checks.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeCheck(idx)}
                        className="mt-2 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}

                {totalAmount > 0 && (
                  <p className="text-sm font-semibold text-right">
                    Total: ${totalAmount.toFixed(2)}
                  </p>
                )}
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  placeholder="e.g. Oct 2023 catch-up payment — 5 checks, PDF not available"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="flex gap-3 pt-1">
                <Button type="submit" disabled={loading}>
                  {loading ? 'Saving…' : 'Save Payment'}
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

export default function ManualEntryPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading…</div>}>
      <ManualEntryContent />
    </Suspense>
  )
}
