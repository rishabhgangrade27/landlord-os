'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { Pencil } from 'lucide-react'

type LeaseData = {
  id: string
  start_date: string
  end_date: string | null
  rent_amount: number
  status: string
  notes: string | null
}

export function EditLeaseDialog({
  lease,
  tenantName,
}: {
  lease: LeaseData
  tenantName?: string
}) {
  const router = useRouter()
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const [form, setForm] = useState({
    start_date:  lease.start_date ?? '',
    end_date:    lease.end_date ?? '',
    rent_amount: String(lease.rent_amount ?? ''),
    status:      lease.status ?? 'active',
    notes:       lease.notes ?? '',
  })

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.start_date || !form.rent_amount) {
      toast.error('Start date and rent amount are required.')
      return
    }
    const rent = parseFloat(form.rent_amount)
    if (isNaN(rent) || rent <= 0) {
      toast.error('Enter a valid rent amount.')
      return
    }
    setLoading(true)

    const { error } = await supabase
      .from('leases')
      .update({
        start_date:  form.start_date,
        end_date:    form.end_date || null,
        rent_amount: rent,
        status:      form.status,
        notes:       form.notes.trim() || null,
      })
      .eq('id', lease.id)

    if (error) {
      toast.error(error.message)
      setLoading(false)
    } else {
      toast.success('Lease updated.')
      setOpen(false)
      router.refresh()
    }
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Pencil className="w-3.5 h-3.5 mr-1" />
        Edit
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Edit Lease{tenantName ? ` — ${tenantName}` : ''}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
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
                <p className="text-xs text-muted-foreground">Leave blank = month-to-month</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Monthly Rent ($) <span className="text-destructive">*</span></Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={form.rent_amount}
                onChange={(e) => set('rent_amount', e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => set('status', v ?? '')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => set('notes', e.target.value)}
                placeholder="e.g. Renewal, verbal agreement, month-to-month…"
                rows={2}
              />
            </div>

            <div className="flex gap-3 pt-1">
              <Button type="submit" disabled={loading}>
                {loading ? 'Saving…' : 'Save Changes'}
              </Button>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
