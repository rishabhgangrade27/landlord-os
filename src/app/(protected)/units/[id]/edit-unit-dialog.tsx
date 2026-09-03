'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateUnit } from '../../properties/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Pencil } from 'lucide-react'
import { type Unit } from '@prisma/client'

export function EditUnitDialog({ unit }: { unit: Unit }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    unit_number: unit.unit_number,
    floor: unit.floor?.toString() ?? '',
    bedrooms: unit.bedrooms?.toString() ?? '',
    bathrooms: unit.bathrooms?.toString() ?? '',
    notes: unit.notes ?? '',
    status: unit.status,
  })

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const { error } = await updateUnit(unit.id, {
      unit_number: form.unit_number.trim(),
      floor: form.floor ? parseInt(form.floor) : null,
      bedrooms: form.bedrooms ? parseInt(form.bedrooms) : null,
      bathrooms: form.bathrooms ? parseFloat(form.bathrooms) : null,
      notes: form.notes.trim() || null,
      status: form.status,
    })

    if (error) {
      toast.error(error.message)
      setLoading(false)
    } else {
      toast.success('Unit updated.')
      setOpen(false)
      router.refresh()
    }
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Pencil className="w-4 h-4 mr-1.5" />
        Edit Unit
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Unit {unit.unit_number}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>Unit Number</Label>
            <Input value={form.unit_number} onChange={(e) => set('unit_number', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => set('status', v ?? '')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="vacant">Vacant</SelectItem>
                <SelectItem value="occupied">Occupied</SelectItem>
                <SelectItem value="under_construction">Under Construction</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>Floor</Label>
              <Input type="number" value={form.floor} onChange={(e) => set('floor', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Beds</Label>
              <Input type="number" value={form.bedrooms} onChange={(e) => set('bedrooms', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Baths</Label>
              <Input type="number" step="0.5" value={form.bathrooms} onChange={(e) => set('bathrooms', e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Notes</Label>
            <Input value={form.notes} onChange={(e) => set('notes', e.target.value)} />
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
