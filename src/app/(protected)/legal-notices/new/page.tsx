'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/layout/page-header'
import { LinkButton } from '@/components/ui/link-button'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { ArrowLeft, AlertTriangle } from 'lucide-react'

const NOTICE_TYPES = [
  { value: 'non_payment_30day',   label: '30-Day Rent Demand Letter (to HRA)' },
  { value: 'non_payment_60day',   label: '14-Day Notice of Cure/Quit' },
  { value: 'notice_90day',        label: '90-Day Termination Notice (auto-detects property)' },
  { value: 'court_form',          label: 'Court — Holdover Petition' },
  { value: 'court_form_nonpayment', label: 'Court — Non-Payment Petition' },
]

type TenantOption = { id: string; name: string; case_number: string | null }
type PreviewMeta = { template_title: string; tenant_name: string; unit_display: string | null; resolved_type: string | null }

function GenerateNoticeContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const [step, setStep] = useState<'select' | 'preview'>('select')
  const [tenants, setTenants] = useState<TenantOption[]>([])
  const [tenantId, setTenantId] = useState(searchParams.get('tenant_id') ?? '')
  const [noticeType, setNoticeType] = useState(searchParams.get('notice_type') ?? '')
  const [loading, setLoading] = useState(false)
  const [previewText, setPreviewText] = useState('')
  const [previewMeta, setPreviewMeta] = useState<PreviewMeta | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)

  useEffect(() => {
    supabase
      .from('tenants')
      .select('id, name, case_number')
      .eq('status', 'active')
      .order('name')
      .then(({ data }) => setTenants((data ?? []) as TenantOption[]))
  }, [])

  async function handlePreview() {
    if (!tenantId || !noticeType) {
      toast.error('Select a tenant and notice type.')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/generate-notice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: tenantId, notice_type: noticeType, confirm: false }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to generate preview.')
        return
      }
      setPreviewText(data.rendered_text)
      setPreviewMeta({
        template_title: data.template_title,
        tenant_name: data.tenant_name,
        unit_display: data.unit_display,
        resolved_type: data.resolved_type ?? null,
      })
      setStep('preview')
    } finally {
      setLoading(false)
    }
  }

  async function handleConfirm() {
    setLoading(true)
    setConfirmOpen(false)
    try {
      const res = await fetch('/api/generate-notice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: tenantId, notice_type: noticeType, confirm: true }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to generate notice.')
        return
      }
      toast.success('Notice generated.')
      router.push(`/legal-notices/${data.notice_id}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Generate Legal Notice"
        description="System prepares the notice — you review and approve before sending"
        action={
          <LinkButton variant="outline" size="sm" href="/legal-notices">
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            Back
          </LinkButton>
        }
      />

      {/* Disclaimer banner — always visible */}
      <div className="mx-6 mt-4 flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        <p className="text-xs font-medium text-amber-800">
          This system does NOT provide legal advice. You are responsible for all actions
          taken. All notices are drafts — review carefully before sending.
        </p>
      </div>

      <div className="p-6 max-w-2xl">
        {/* Step 1 — Select tenant + notice type */}
        {step === 'select' && (
          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="space-y-2">
                <Label>
                  Tenant <span className="text-destructive">*</span>
                </Label>
                <Select value={tenantId} onValueChange={(v) => setTenantId(v ?? '')}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select tenant" />
                  </SelectTrigger>
                  <SelectContent>
                    {tenants.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                        {t.case_number ? ` (${t.case_number})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>
                  Notice Type <span className="text-destructive">*</span>
                </Label>
                <Select value={noticeType} onValueChange={(v) => setNoticeType(v ?? '')}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select notice type" />
                  </SelectTrigger>
                  <SelectContent>
                    {NOTICE_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                onClick={handlePreview}
                disabled={loading || !tenantId || !noticeType}
              >
                {loading ? 'Generating preview…' : 'Preview Notice →'}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step 2 — Preview + confirm */}
        {step === 'preview' && previewMeta && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">{previewMeta.template_title}</h3>
                <p className="text-sm text-muted-foreground">
                  {previewMeta.tenant_name}
                  {previewMeta.unit_display ? ` · ${previewMeta.unit_display}` : ''}
                </p>
                {previewMeta.resolved_type && (
                  <p className="text-xs text-blue-600 mt-0.5">
                    ↳ Property-specific variant: {previewMeta.resolved_type}
                  </p>
                )}
              </div>
              <Badge variant="outline">Preview — not saved yet</Badge>
            </div>

            <Card>
              <CardContent className="p-0">
                <pre className="whitespace-pre-wrap rounded-md bg-muted/20 p-5 font-mono text-sm leading-relaxed">
                  {previewText}
                </pre>
              </CardContent>
            </Card>

            <div className="flex gap-3 pt-1">
              <Button onClick={() => setConfirmOpen(true)} disabled={loading}>
                Generate &amp; Save Notice
              </Button>
              <Button variant="outline" onClick={() => setStep('select')}>
                ← Change Selection
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Confirmation modal — mandatory, cannot skip */}
      <>
        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-4 w-4" />
                Confirm Generation
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-1.5 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800">
                <p>⚠ This system does NOT provide legal advice.</p>
                <p>⚠ You are responsible for this notice and all actions taken.</p>
                <p>⚠ This cannot be undone — the notice will be saved as generated.</p>
              </div>
              <div className="flex gap-3">
                <Button
                  onClick={handleConfirm}
                  disabled={loading}
                  variant="destructive"
                >
                  {loading ? 'Generating…' : 'Generate Notice'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setConfirmOpen(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </>
    </div>
  )
}

export default function GenerateNoticePage() {
  return (
    <Suspense
      fallback={
        <div className="p-6 text-sm text-muted-foreground">Loading…</div>
      }
    >
      <GenerateNoticeContent />
    </Suspense>
  )
}
