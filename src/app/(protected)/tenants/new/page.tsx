'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { LinkButton } from '@/components/ui/link-button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { ArrowLeft, Eye, EyeOff } from 'lucide-react'

export default function NewTenantPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [showSsn, setShowSsn] = useState(false)
  const [showStateId, setShowStateId] = useState(false)

  const [form, setForm] = useState({
    name: '',
    full_legal_name: '',
    case_number: '',
    email: '',
    phone: '',
    address: '',
    household_size: '',
    ssn_encrypted: '',
    state_id: '',
    notes: '',
  })

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) {
      toast.error('Tenant name is required.')
      return
    }
    setLoading(true)

    const { data, error } = await supabase
      .from('tenants')
      .insert({
        name: form.name.trim(),
        full_legal_name: form.full_legal_name.trim() || null,
        case_number: form.case_number.trim() || null,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        address: form.address.trim() || null,
        household_size: form.household_size ? parseInt(form.household_size) : null,
        ssn_encrypted: form.ssn_encrypted.trim() || null,
        state_id: form.state_id.trim() || null,
        notes: form.notes.trim() || null,
        status: 'active',
      })
      .select()
      .single()

    if (error) {
      toast.error(error.message)
      setLoading(false)
    } else {
      toast.success('Tenant added successfully.')
      router.push(`/tenants/${data.id}`)
    }
  }

  return (
    <div>
      <PageHeader
        title="Add Tenant"
        description="Create a new tenant record"
        action={
          <LinkButton variant="outline" size="sm" href="/tenants">
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            Back
          </LinkButton>
        }
      />

      <div className="p-6 max-w-2xl">
        <form onSubmit={handleSubmit}>
          <Card>
            <CardContent className="p-6 space-y-5">
              {/* Basic Info */}
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
                  Basic Information
                </h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Display Name <span className="text-destructive">*</span></Label>
                      <Input
                        id="name"
                        placeholder="e.g. Abdullah Ali"
                        value={form.name}
                        onChange={(e) => set('name', e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="full_legal_name">Full Legal Name</Label>
                      <Input
                        id="full_legal_name"
                        placeholder="As on lease"
                        value={form.full_legal_name}
                        onChange={(e) => set('full_legal_name', e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="case_number">HRA Case Number</Label>
                    <Input
                      id="case_number"
                      placeholder="e.g. 38084283B-01"
                      value={form.case_number}
                      onChange={(e) => set('case_number', e.target.value)}
                      className="font-mono"
                    />
                    <p className="text-xs text-muted-foreground">
                      This links to HRA check payments. Cannot be changed once set.
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Contact */}
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
                  Contact
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="718-555-0100"
                      value={form.phone}
                      onChange={(e) => set('phone', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="tenant@email.com"
                      value={form.email}
                      onChange={(e) => set('email', e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2 mt-4">
                  <Label htmlFor="address">Current Address</Label>
                  <Input
                    id="address"
                    placeholder="Street address"
                    value={form.address}
                    onChange={(e) => set('address', e.target.value)}
                  />
                </div>
              </div>

              <Separator />

              {/* Sensitive Fields */}
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                  Sensitive Information
                </h3>
                <p className="text-xs text-muted-foreground mb-4">
                  These fields are masked in the UI by default. Use the eye icon to reveal.
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="ssn">SSN (last 4 or full)</Label>
                    <div className="relative">
                      <Input
                        id="ssn"
                        type={showSsn ? 'text' : 'password'}
                        placeholder="•••••••••"
                        value={form.ssn_encrypted}
                        onChange={(e) => set('ssn_encrypted', e.target.value)}
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowSsn(!showSsn)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showSsn ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="state_id">State ID Number</Label>
                    <div className="relative">
                      <Input
                        id="state_id"
                        type={showStateId ? 'text' : 'password'}
                        placeholder="•••••••••"
                        value={form.state_id}
                        onChange={(e) => set('state_id', e.target.value)}
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowStateId(!showStateId)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showStateId ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
                <div className="space-y-2 mt-4">
                  <Label htmlFor="household_size">Household Size</Label>
                  <Input
                    id="household_size"
                    type="number"
                    placeholder="Number of people"
                    className="w-40"
                    value={form.household_size}
                    onChange={(e) => set('household_size', e.target.value)}
                  />
                </div>
              </div>

              <Separator />

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="Any additional notes about this tenant"
                  value={form.notes}
                  onChange={(e) => set('notes', e.target.value)}
                  rows={3}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button type="submit" disabled={loading}>
                  {loading ? 'Saving…' : 'Add Tenant'}
                </Button>
                <Button type="button" variant="outline" onClick={() => router.back()}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>
      </div>
    </div>
  )
}
