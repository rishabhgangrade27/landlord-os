'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Pencil } from 'lucide-react'

const STATUSES = [
  { value: 'draft', label: 'Draft' },
  { value: 'generated', label: 'Generated' },
  { value: 'pending_attorney', label: 'Pending Attorney' },
  { value: 'attorney_reviewed', label: 'Attorney Reviewed' },
  { value: 'sent', label: 'Sent' },
  { value: 'cancelled', label: 'Cancelled' },
]

export function UpdateNoticeStatusDialog({ notice }: { notice: any }) {
  const router = useRouter()
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState(notice.status ?? 'draft')
  const [notes, setNotes] = useState(notice.admin_notes ?? '')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase
      .from('legal_notices')
      .update({
        status,
        admin_notes: notes.trim() || null,
        ...(status === 'sent' ? { sent_at: new Date().toISOString() } : {}),
      })
      .eq('id', notice.id)

    if (error) { toast.error(error.message); setLoading(false) }
    else { toast.success('Notice updated.'); setOpen(false); router.refresh() }
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}><Pencil className="w-4 h-4 mr-1.5" />Update</Button>
      <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Update Notice Status</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v ?? 'draft')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Admin Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Any notes about this notice" />
          </div>
          <div className="flex gap-3">
            <Button type="submit" disabled={loading}>{loading ? 'Saving…' : 'Save'}</Button>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </form>
      </DialogContent>
      </Dialog>
    </>
  )
}
