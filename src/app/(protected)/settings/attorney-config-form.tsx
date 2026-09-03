'use client'

import { useState } from 'react'
import { updateAttorneySettings } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

type Props = {
  current: {
    attorney_name: string | null
    attorney_address: string | null
    attorney_phone: string | null
    attorney_email: string | null
  }
}

export function AttorneyConfigForm({ current }: Props) {
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    attorney_name:    current.attorney_name    ?? '',
    attorney_address: current.attorney_address ?? '',
    attorney_phone:   current.attorney_phone   ?? '',
    attorney_email:   current.attorney_email   ?? '',
  })

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSave() {
    setLoading(true)
    const result = await updateAttorneySettings({
      attorney_name:    form.attorney_name.trim()    || null,
      attorney_address: form.attorney_address.trim() || null,
      attorney_phone:   form.attorney_phone.trim()   || null,
      attorney_email:   form.attorney_email.trim()   || null,
    })
    setLoading(false)
    if (!result.success) {
      toast.error('Failed to save: ' + result.error)
    } else {
      toast.success('Attorney details saved.')
    }
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label>Attorney Name / Firm</Label>
        <Input
          value={form.attorney_name}
          onChange={(e) => set('attorney_name', e.target.value)}
          placeholder="e.g. Demo Law Offices, P.C."
        />
      </div>
      <div className="space-y-1.5">
        <Label>Address</Label>
        <Input
          value={form.attorney_address}
          onChange={(e) => set('attorney_address', e.target.value)}
          placeholder="e.g. 300 Example Blvd., Sample City, NY 10001"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Phone</Label>
          <Input
            value={form.attorney_phone}
            onChange={(e) => set('attorney_phone', e.target.value)}
            placeholder="(555) 010-0300"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Email</Label>
          <Input
            type="email"
            value={form.attorney_email}
            onChange={(e) => set('attorney_email', e.target.value)}
            placeholder="attorney@example.com"
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        These details are used in all generated legal notices. Update here if your attorney changes.
      </p>
      <Button onClick={handleSave} disabled={loading} size="sm">
        {loading ? 'Saving…' : 'Save Attorney Details'}
      </Button>
    </div>
  )
}
