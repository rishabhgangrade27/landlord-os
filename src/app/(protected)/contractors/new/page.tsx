'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createContractor } from '../actions'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { LinkButton } from '@/components/ui/link-button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { toast } from 'sonner'
import { ArrowLeft } from 'lucide-react'

export default function NewContractorPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name: '', trade: '', phone: '', email: '', address: '', payment_method: '', notes: '',
  })

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { toast.error('Name is required.'); return }
    setLoading(true)

    const { data, error } = await createContractor({
      name: form.name.trim(),
      trade: form.trade.trim() || null,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      address: form.address.trim() || null,
      payment_method: form.payment_method.trim() || null,
      notes: form.notes.trim() || null,
    })

    if (error) { toast.error(error.message); setLoading(false) }
    else { toast.success('Contractor added.'); router.push(`/contractors/${data!.id}`) }
  }

  return (
    <div>
      <PageHeader title="Add Contractor" description="Add a new contractor to your network"
        action={<LinkButton variant="outline" size="sm" href="/contractors"><ArrowLeft className="w-4 h-4 mr-1.5" />Back</LinkButton>} />
      <div className="p-6 max-w-xl">
        <Card><CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Name <span className="text-destructive">*</span></Label>
                <Input value={form.name} onChange={(e) => set('name', e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Trade / Specialty</Label>
                <Input placeholder="e.g. Plumbing, Electrical" value={form.trade} onChange={(e) => set('trade', e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
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
            <div className="space-y-2">
              <Label>Payment Method</Label>
              <Input placeholder="e.g. Check, Zelle, Cash" value={form.payment_method} onChange={(e) => set('payment_method', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={3} />
            </div>
            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={loading}>{loading ? 'Saving…' : 'Add Contractor'}</Button>
              <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
            </div>
          </form>
        </CardContent></Card>
      </div>
    </div>
  )
}
