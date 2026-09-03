'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createExpense } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'

const EXPENSE_CATEGORIES = [
  { value: 'electric', label: 'Electric' },
  { value: 'water', label: 'Water' },
  { value: 'gas', label: 'Gas' },
  { value: 'oil', label: 'Oil (Heating)' },
  { value: 'taxes', label: 'Property Taxes' },
  { value: 'mortgage', label: 'Mortgage' },
  { value: 'contractor', label: 'Contractor' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'other', label: 'Other' },
]

type PropertyOption = {
  id: string
  name: string | null
  nickname?: string | null
  address: string | null
}

type UnitOption = {
  id: string
  unit_number: string
  property_id: string
}

export function AddExpenseForm({
  properties,
  units,
}: {
  properties: PropertyOption[]
  units: UnitOption[]
}) {
  const router = useRouter()

  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    property_id: '',
    unit_id: '',
    category: '',
    description: '',
    amount: '',
    expense_date: new Date().toISOString().split('T')[0],
  })

  function set(field: string, value: string) {
    setForm((prev) => {
      const next = { ...prev, [field]: value }
      if (field === 'property_id') next.unit_id = ''
      return next
    })
  }

  const filteredUnits = form.property_id
    ? units.filter((u) => u.property_id === form.property_id)
    : []

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.property_id || !form.category || !form.amount || !form.expense_date) {
      toast.error('Property, category, amount, and date are required.')
      return
    }
    setLoading(true)

    const result = await createExpense({
      property_id: form.property_id,
      unit_id: form.unit_id || null,
      category: form.category,
      description: form.description.trim() || null,
      amount: parseFloat(form.amount),
      expense_date: form.expense_date,
    })

    if (!result.success) {
      toast.error(result.error)
    } else {
      toast.success('Expense logged.')
      setForm({
        property_id: '',
        unit_id: '',
        category: '',
        description: '',
        amount: '',
        expense_date: new Date().toISOString().split('T')[0],
      })
      router.refresh()
    }
    setLoading(false)
  }

  function propLabel(p: PropertyOption) {
    return (p as any).nickname ?? p.name ?? p.address ?? '—'
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-lg space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>
            Property <span className="text-destructive">*</span>
          </Label>
          <Select value={form.property_id} onValueChange={(v) => set('property_id', v ?? '')}>
            <SelectTrigger>
              <SelectValue placeholder="Select property" />
            </SelectTrigger>
            <SelectContent>
              {properties.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {propLabel(p)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Unit (optional)</Label>
          <Select
            value={form.unit_id}
            onValueChange={(v) => set('unit_id', v ?? '')}
            disabled={!form.property_id || filteredUnits.length === 0}
          >
            <SelectTrigger>
              <SelectValue
                placeholder={!form.property_id ? 'Select property first' : 'All units'}
              />
            </SelectTrigger>
            <SelectContent>
              {filteredUnits.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  Unit {u.unit_number}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>
            Category <span className="text-destructive">*</span>
          </Label>
          <Select value={form.category} onValueChange={(v) => set('category', v ?? '')}>
            <SelectTrigger>
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              {EXPENSE_CATEGORIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>
            Amount ($) <span className="text-destructive">*</span>
          </Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            value={form.amount}
            onChange={(e) => set('amount', e.target.value)}
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>
            Date <span className="text-destructive">*</span>
          </Label>
          <Input
            type="date"
            value={form.expense_date}
            onChange={(e) => set('expense_date', e.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <Label>Description</Label>
          <Input
            placeholder="Optional note"
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
          />
        </div>
      </div>

      <Button type="submit" disabled={loading}>
        {loading ? 'Saving…' : 'Log Expense'}
      </Button>
    </form>
  )
}
