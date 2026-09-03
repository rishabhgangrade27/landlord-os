'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateContractor } from '../actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Pencil } from 'lucide-react'

export function EditContractorDialog({ contractor }: { contractor: any }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name: contractor.name ?? '',
    trade: contractor.trade ?? '',
    phone: contractor.phone ?? '',
    email: contractor.email ?? '',
    address: contractor.address ?? '',
    payment_method: contractor.payment_method ?? '',
    notes: contractor.notes ?? '',
    status: contractor.status ?? 'active',
  })

  function set(field: string, value: string) { setForm((prev) => ({ ...prev, [field]: value })) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { error } = await updateContractor(contractor.id, {
      name: form.name.trim(),
      trade: form.trade.trim() || null,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      address: form.address.trim() || null,
      payment_method: form.payment_method.trim() || null,
      notes: form.notes.trim() || null,
      status: form.status,
    })

    if (error) { toast.error(error.message); setLoading(false) }
    else { toast.success('Contractor updated.'); setOpen(false); router.refresh() }
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}><Pencil className="w-4 h-4 mr-1.5" />Edit</Button>
      <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Edit Contractor</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>Name</Label><Input value={form.name} onChange={(e) => set('name', e.target.value)} /></div>
            <div className="space-y-2"><Label>Trade</Label><Input value={form.trade} onChange={(e) => set('trade', e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>Phone</Label><Input value={form.phone} onChange={(e) => set('phone', e.target.value)} /></div>
            <div className="space-y-2"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} /></div>
          </div>
          <div className="space-y-2"><Label>Payment Method</Label><Input value={form.payment_method} onChange={(e) => set('payment_method', e.target.value)} /></div>
          <div className="space-y-2"><Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => set('status', v ?? '')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem></SelectContent>
            </Select>
          </div>
          <div className="space-y-2"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={2} /></div>
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
