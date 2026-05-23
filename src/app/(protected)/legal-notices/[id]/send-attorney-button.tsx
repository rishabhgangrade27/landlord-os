'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Send } from 'lucide-react'

export function SendToAttorneyButton({
  noticeId,
  currentStatus,
}: {
  noticeId: string
  currentStatus: string
}) {
  const router = useRouter()
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [attorneyEmail, setAttorneyEmail] = useState('')

  async function handleSend() {
    if (!attorneyEmail.trim()) {
      toast.error('Attorney email is required.')
      return
    }
    setLoading(true)

    const { error } = await supabase
      .from('legal_notices')
      .update({
        status: 'pending_attorney',
        attorney_email: attorneyEmail.trim(),
        send_method: 'attorney',
      })
      .eq('id', noticeId)

    if (error) {
      toast.error(error.message)
      setLoading(false)
    } else {
      toast.success('Notice marked as pending attorney review. Send the PDF to attorney manually.')
      setOpen(false)
      router.refresh()
    }
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Send className="w-4 h-4 mr-1.5" />
        Send to Attorney
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Send to Attorney</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <p className="text-sm text-muted-foreground">
            This marks the notice as "Pending Attorney Review." Print or email the notice document below to your attorney.
          </p>
          <div className="space-y-2">
            <Label>Attorney Email (for your records)</Label>
            <Input
              type="email"
              placeholder="attorney@lawfirm.com"
              value={attorneyEmail}
              onChange={(e) => setAttorneyEmail(e.target.value)}
            />
          </div>
          <div className="flex gap-3">
            <Button onClick={handleSend} disabled={loading}>
              {loading ? 'Saving…' : 'Confirm'}
            </Button>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </div>
      </DialogContent>
      </Dialog>
    </>
  )
}
