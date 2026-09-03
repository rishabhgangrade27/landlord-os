'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createUnit } from '../actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'

export function AddUnitDialog({ propertyId }: { propertyId: string }) {
  const router = useRouter()

  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    unit_number: '',
    floor: '',
    bedrooms: '',
    bathrooms: '',
    notes: '',
  })

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.unit_number.trim()) {
      toast.error('Unit number is required.')
      return
    }
    setLoading(true)

    const { error } = await createUnit({
      property_id: propertyId,
      unit_number: form.unit_number.trim(),
      floor: form.floor ? parseInt(form.floor) : null,
      bedrooms: form.bedrooms ? parseInt(form.bedrooms) : null,
      bathrooms: form.bathrooms ? parseFloat(form.bathrooms) : null,
      notes: form.notes.trim() || null,
    })

    if (error) {
      toast.error(error.message)
      setLoading(false)
    } else {
      toast.success(`Unit ${form.unit_number} added.`)
      setOpen(false)
      setForm({ unit_number: '', floor: '', bedrooms: '', bathrooms: '', notes: '' })
      router.refresh()
    }
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="w-4 h-4 mr-1.5" />
        Add Unit
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Unit</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="unit_number">Unit Number <span className="text-destructive">*</span></Label>
            <Input
              id="unit_number"
              placeholder="e.g. 1R, 2F, Ground Floor"
              value={form.unit_number}
              onChange={(e) => set('unit_number', e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="floor">Floor</Label>
              <Input
                id="floor"
                type="number"
                placeholder="1"
                value={form.floor}
                onChange={(e) => set('floor', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bedrooms">Beds</Label>
              <Input
                id="bedrooms"
                type="number"
                placeholder="2"
                value={form.bedrooms}
                onChange={(e) => set('bedrooms', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bathrooms">Baths</Label>
              <Input
                id="bathrooms"
                type="number"
                step="0.5"
                placeholder="1"
                value={form.bathrooms}
                onChange={(e) => set('bathrooms', e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Input
              id="notes"
              placeholder="Any notes about this unit"
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
            />
          </div>

          <div className="flex gap-3 pt-1">
            <Button type="submit" disabled={loading}>
              {loading ? 'Adding…' : 'Add Unit'}
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
