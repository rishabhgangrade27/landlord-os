'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { Pencil, Eye, EyeOff } from 'lucide-react'
import type { Tenant } from '@/lib/supabase/types'

export function EditTenantDialog({ tenant }: { tenant: Tenant }) {
  const router = useRouter()
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showSsn, setShowSsn] = useState(false)
  const [showStateId, setShowStateId] = useState(false)

  const [form, setForm] = useState({
    name: tenant.name,
    full_legal_name: tenant.full_legal_name ?? '',
    email: tenant.email ?? '',
    phone: tenant.phone ?? '',
    address: tenant.address ?? '',
    ssn_encrypted: tenant.ssn_encrypted ?? '',
    state_id: tenant.state_id ?? '',
    notes: tenant.notes ?? '',
    status: tenant.status ?? 'active',
  })

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const { error } = await supabase
      .from('tenants')
      .update({
        name: form.name.trim(),
        full_legal_name: form.full_legal_name.trim() || null,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        address: form.address.trim() || null,
        ssn_encrypted: form.ssn_encrypted.trim() || null,
        state_id: form.state_id.trim() || null,
        notes: form.notes.trim() || null,
        status: form.status,
      })
      .eq('id', tenant.id)

    if (error) {
      toast.error(error.message)
      setLoading(false)
    } else {
      toast.success('Tenant updated.')
      setOpen(false)
      router.refresh()
    }
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Pencil className="w-4 h-4 mr-1.5" />
        Edit
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Tenant — {tenant.name}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Display Name *</Label>
              <Input value={form.name} onChange={(e) => set('name', e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Full Legal Name</Label>
              <Input value={form.full_legal_name} onChange={(e) => set('full_legal_name', e.target.value)} />
            </div>
          </div>

          <div className="p-3 bg-muted/30 rounded-md text-xs text-muted-foreground">
            <strong>Case Number: {tenant.case_number ?? 'not set'}</strong> — edit directly in Supabase.
          </div>

          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => set('status', v ?? '')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="moved_out">Moved Out</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={form.phone} onChange={(e) => set('phone', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Address</Label>
            <Input value={form.address} onChange={(e) => set('address', e.target.value)} />
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>SSN</Label>
              <div className="relative">
                <Input
                  type={showSsn ? 'text' : 'password'}
                  value={form.ssn_encrypted}
                  onChange={(e) => set('ssn_encrypted', e.target.value)}
                  className="pr-10"
                />
                <button type="button" onClick={() => setShowSsn(!showSsn)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {showSsn ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>State ID</Label>
              <div className="relative">
                <Input
                  type={showStateId ? 'text' : 'password'}
                  value={form.state_id}
                  onChange={(e) => set('state_id', e.target.value)}
                  className="pr-10"
                />
                <button type="button" onClick={() => setShowStateId(!showStateId)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {showStateId ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              rows={3}
            />
          </div>

          <div className="flex gap-3 pt-1">
            <Button type="submit" disabled={loading}>{loading ? 'Saving…' : 'Save Changes'}</Button>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </form>
      </DialogContent>
      </Dialog>
    </>
  )
}
