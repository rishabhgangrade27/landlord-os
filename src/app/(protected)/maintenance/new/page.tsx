'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
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
import { ArrowLeft } from 'lucide-react'

export default function NewMaintenancePage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [units, setUnits] = useState<any[]>([])
  const [contractors, setContractors] = useState<any[]>([])

  const [form, setForm] = useState({
    title: '',
    description: '',
    category: 'general',
    priority: 'medium',
    unit_id: '',
    assigned_contractor_id: '',
    estimated_cost: '',
  })

  useEffect(() => {
    supabase.from('units').select('id, unit_number, properties(name, address)').order('unit_number')
      .then(({ data }) => setUnits(data ?? []))
    supabase.from('contractors').select('id, name, trade').eq('status', 'active').order('name')
      .then(({ data }) => setContractors(data ?? []))
  }, [])

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) {
      toast.error('Title is required.')
      return
    }
    setLoading(true)

    const { data, error } = await supabase
      .from('maintenance_tickets')
      .insert({
        title: form.title.trim(),
        description: form.description.trim() || null,
        category: form.category,
        priority: form.priority,
        status: 'reported',
        unit_id: form.unit_id || null,
        assigned_contractor_id: form.assigned_contractor_id || null,
        estimated_cost: form.estimated_cost ? parseFloat(form.estimated_cost) : null,
      })
      .select()
      .single()

    if (error) {
      toast.error(error.message)
      setLoading(false)
    } else {
      toast.success('Ticket created.')
      router.push(`/maintenance/${data.id}`)
    }
  }

  return (
    <div>
      <PageHeader
        title="New Maintenance Ticket"
        description="Report a repair or maintenance issue"
        action={
          <LinkButton variant="outline" size="sm" href="/maintenance"><ArrowLeft className="w-4 h-4 mr-1.5" />Back</LinkButton>
        }
      />
      <div className="p-6 max-w-xl">
        <Card>
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Title <span className="text-destructive">*</span></Label>
                <Input placeholder="e.g. Leaking pipe under sink" value={form.title} onChange={(e) => set('title', e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea placeholder="Details about the issue" value={form.description} onChange={(e) => set('description', e.target.value)} rows={3} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={form.category} onValueChange={(v) => set('category', v ?? '')}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="plumbing">Plumbing</SelectItem>
                      <SelectItem value="electrical">Electrical</SelectItem>
                      <SelectItem value="general">General</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Select value={form.priority} onValueChange={(v) => set('priority', v ?? '')}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="urgent">Urgent</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Unit</Label>
                <Select value={form.unit_id} onValueChange={(v) => set('unit_id', v ?? '')}>
                  <SelectTrigger><SelectValue placeholder="Select unit (optional)" /></SelectTrigger>
                  <SelectContent>
                    {units.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.properties?.name ?? u.properties?.address ?? '?'} / {u.unit_number}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Assign Contractor</Label>
                <Select value={form.assigned_contractor_id} onValueChange={(v) => set('assigned_contractor_id', v ?? '')}>
                  <SelectTrigger><SelectValue placeholder="Assign to contractor (optional)" /></SelectTrigger>
                  <SelectContent>
                    {contractors.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}{c.trade ? ` — ${c.trade}` : ''}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Estimated Cost ($)</Label>
                <Input type="number" step="0.01" placeholder="500.00" value={form.estimated_cost} onChange={(e) => set('estimated_cost', e.target.value)} className="w-40" />
              </div>
              <div className="flex gap-3 pt-2">
                <Button type="submit" disabled={loading}>{loading ? 'Creating…' : 'Create Ticket'}</Button>
                <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
