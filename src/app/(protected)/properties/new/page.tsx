'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { LinkButton } from '@/components/ui/link-button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { toast } from 'sonner'
import { ArrowLeft } from 'lucide-react'

export default function NewPropertyPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)

  const [form, setForm] = useState({
    name: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    property_type: 'residential',
  })

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim() || !form.address.trim()) {
      toast.error('Property name and address are required.')
      return
    }
    setLoading(true)

    const { data, error } = await supabase
      .from('properties')
      .insert({
        name: form.name.trim(),
        address: form.address.trim(),
        city: form.city.trim() || null,
        state: form.state.trim() || null,
        zip: form.zip.trim() || null,
        property_type: form.property_type,
      })
      .select()
      .single()

    if (error) {
      toast.error(error.message)
      setLoading(false)
    } else {
      toast.success('Property added successfully.')
      router.push(`/properties/${data.id}`)
    }
  }

  return (
    <div>
      <PageHeader
        title="Add Property"
        description="Add a new building or property"
        action={
          <LinkButton variant="outline" size="sm" href="/properties">
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            Back
          </LinkButton>
        }
      />

      <div className="p-6 max-w-xl">
        <Card>
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Property Name <span className="text-destructive">*</span></Label>
                <Input
                  id="name"
                  placeholder="e.g. 4521 Willow Avenue"
                  value={form.name}
                  onChange={(e) => set('name', e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Street Address <span className="text-destructive">*</span></Label>
                <Input
                  id="address"
                  placeholder="e.g. 4521 Willow Avenue"
                  value={form.address}
                  onChange={(e) => set('address', e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    placeholder="Jamaica"
                    value={form.city}
                    onChange={(e) => set('city', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">State</Label>
                  <Input
                    id="state"
                    placeholder="NY"
                    maxLength={2}
                    value={form.state}
                    onChange={(e) => set('state', e.target.value.toUpperCase())}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="zip">ZIP Code</Label>
                  <Input
                    id="zip"
                    placeholder="11435"
                    value={form.zip}
                    onChange={(e) => set('zip', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Property Type</Label>
                  <Select value={form.property_type} onValueChange={(v) => set('property_type', v ?? '')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="residential">Residential</SelectItem>
                      <SelectItem value="commercial">Commercial</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button type="submit" disabled={loading}>
                  {loading ? 'Saving…' : 'Add Property'}
                </Button>
                <Button type="button" variant="outline" onClick={() => router.back()}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
