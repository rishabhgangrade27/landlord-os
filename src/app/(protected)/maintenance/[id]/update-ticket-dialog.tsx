'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getActiveContractors, updateMaintenanceTicket } from '../actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Pencil } from 'lucide-react'

const STATUSES = ['reported', 'reviewed', 'assigned', 'in_progress', 'completed', 'closed', 'cancelled']

export function UpdateTicketDialog({ ticket }: { ticket: any }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [contractors, setContractors] = useState<any[]>([])

  const [form, setForm] = useState({
    status: ticket.status ?? 'reported',
    priority: ticket.priority ?? 'medium',
    assigned_contractor_id: ticket.assigned_contractor_id ?? '',
    estimated_cost: ticket.estimated_cost?.toString() ?? '',
    actual_cost: ticket.actual_cost?.toString() ?? '',
    cost_approved: ticket.cost_approved?.toString() ?? '',
  })

  useEffect(() => {
    if (open) {
      getActiveContractors().then(setContractors)
    }
  }, [open])

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const { error } = await updateMaintenanceTicket(ticket.id, {
      status: form.status,
      priority: form.priority,
      assigned_contractor_id: form.assigned_contractor_id || null,
      estimated_cost: form.estimated_cost ? parseFloat(form.estimated_cost) : null,
      actual_cost: form.actual_cost ? parseFloat(form.actual_cost) : null,
      cost_approved: form.cost_approved === 'true' ? true : form.cost_approved === 'false' ? false : null,
    })

    if (error) {
      toast.error(error.message)
      setLoading(false)
    } else {
      toast.success('Ticket updated.')
      setOpen(false)
      router.refresh()
    }
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}><Pencil className="w-4 h-4 mr-1.5" />Update</Button>
      <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Update Ticket</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => set('status', v ?? '')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">{s.replace(/_/g, ' ')}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={form.priority} onValueChange={(v) => set('priority', v ?? '')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['urgent', 'high', 'medium', 'low'].map((p) => (
                    <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Assigned Contractor</Label>
            <Select value={form.assigned_contractor_id} onValueChange={(v) => set('assigned_contractor_id', v ?? '')}>
              <SelectTrigger><SelectValue placeholder="Select contractor" /></SelectTrigger>
              <SelectContent>
                {contractors.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}{c.trade ? ` — ${c.trade}` : ''}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Est. Cost ($)</Label>
              <Input type="number" step="0.01" value={form.estimated_cost} onChange={(e) => set('estimated_cost', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Actual Cost ($)</Label>
              <Input type="number" step="0.01" value={form.actual_cost} onChange={(e) => set('actual_cost', e.target.value)} />
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <Button type="submit" disabled={loading}>{loading ? 'Saving…' : 'Save'}</Button>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </form>
      </DialogContent>
      </Dialog>
    </>
  )
}
