'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import {
  CheckCircle2,
  XCircle,
  Save,
  ExternalLink,
  FileX,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react'
import Link from 'next/link'

type TenantOption = { id: string; name: string; case_number: string | null; status: string }

type Transaction = {
  id: string
  status: string | null
  extracted_case_number: string | null
  extracted_check_number: string | null
  extracted_amount: number | null
  extracted_check_date: string | null
  extracted_rent_from: string | null
  extracted_rent_to: string | null
  matched_tenant_id: string | null
  ocr_confidence: number | null
  page_number: number | null
  duplicate_suspected: boolean | null
  review_notes: string | null
  source_pdf_url: string | null
  file_bucket: string | null
  file_path: string | null
  created_at: string
  created_by: string | null
}

const STATUS_COLORS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  verified: 'default',
  processing: 'secondary',
  needs_review: 'outline',
  blank_detected: 'secondary',
  duplicate_suspected: 'destructive',
  rejected: 'destructive',
}

export function TransactionReviewPanel({
  transaction,
  matchedTenant,
  allTenants,
  pdfUrl,
  pageNumber,
}: {
  transaction: Transaction
  matchedTenant: TenantOption | null
  allTenants: TenantOption[]
  pdfUrl: string | null
  pageNumber: number
}) {
  const router = useRouter()
  const supabase = createClient()
  const isVerified = transaction.status === 'verified'
  const isBlank = transaction.status === 'blank_detected'

  // Editable field state
  const [form, setForm] = useState({
    extracted_case_number:  transaction.extracted_case_number ?? '',
    extracted_check_number: transaction.extracted_check_number ?? '',
    extracted_amount:       transaction.extracted_amount != null ? String(transaction.extracted_amount) : '',
    extracted_check_date:   transaction.extracted_check_date ?? '',
    extracted_rent_from:    transaction.extracted_rent_from ?? '',
    extracted_rent_to:      transaction.extracted_rent_to ?? '',
    matched_tenant_id:      transaction.matched_tenant_id ?? '',
    review_notes:           transaction.review_notes ?? '',
  })
  const [saving, setSaving]     = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [rejecting, setRejecting] = useState(false)

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  // ── Save edits ─────────────────────────────────────────────────────────────
  async function handleSave() {
    setSaving(true)
    const { error } = await supabase
      .from('transactions')
      .update({
        extracted_case_number:  form.extracted_case_number  || null,
        extracted_check_number: form.extracted_check_number || null,
        extracted_amount:       form.extracted_amount ? parseFloat(form.extracted_amount) : null,
        extracted_check_date:   form.extracted_check_date  || null,
        extracted_rent_from:    form.extracted_rent_from   || null,
        extracted_rent_to:      form.extracted_rent_to     || null,
        matched_tenant_id:      form.matched_tenant_id     || null,
        review_notes:           form.review_notes          || null,
        reviewed_by:            'admin',
        reviewed_at:            new Date().toISOString(),
      })
      .eq('id', transaction.id)

    if (error) toast.error(error.message)
    else {
      toast.success('Changes saved.')
      router.refresh()
    }
    setSaving(false)
  }

  // ── Verify ─────────────────────────────────────────────────────────────────
  async function handleVerify() {
    setVerifying(true)
    // Save edits first, then mark verified
    const { error } = await supabase
      .from('transactions')
      .update({
        extracted_case_number:  form.extracted_case_number  || null,
        extracted_check_number: form.extracted_check_number || null,
        extracted_amount:       form.extracted_amount ? parseFloat(form.extracted_amount) : null,
        extracted_check_date:   form.extracted_check_date  || null,
        extracted_rent_from:    form.extracted_rent_from   || null,
        extracted_rent_to:      form.extracted_rent_to     || null,
        matched_tenant_id:      form.matched_tenant_id     || null,
        review_notes:           form.review_notes          || null,
        status:                 'verified',
        reviewed_by:            'admin',
        reviewed_at:            new Date().toISOString(),
      })
      .eq('id', transaction.id)

    if (error) toast.error(error.message)
    else {
      toast.success('Transaction verified ✓')
      router.refresh()
    }
    setVerifying(false)
  }

  // ── Reject ─────────────────────────────────────────────────────────────────
  async function handleReject() {
    setRejecting(true)
    const { error } = await supabase
      .from('transactions')
      .update({
        status:       'rejected',
        review_notes: form.review_notes || null,
        reviewed_by:  'admin',
        reviewed_at:  new Date().toISOString(),
      })
      .eq('id', transaction.id)

    if (error) toast.error(error.message)
    else {
      toast.success('Transaction rejected.')
      router.refresh()
    }
    setRejecting(false)
  }

  // ── Reset to needs_review (un-verify / un-reject) ─────────────────────────
  async function handleReset() {
    const { error } = await supabase
      .from('transactions')
      .update({ status: 'needs_review' })
      .eq('id', transaction.id)
    if (error) toast.error(error.message)
    else {
      toast.success('Reset to needs review.')
      router.refresh()
    }
  }

  // ── Confidence colour ──────────────────────────────────────────────────────
  const confidence = transaction.ocr_confidence != null ? Number(transaction.ocr_confidence) : null
  const confidenceColor =
    confidence == null ? 'text-muted-foreground'
    : confidence >= 0.85 ? 'text-green-600'
    : confidence >= 0.6  ? 'text-yellow-600'
    : 'text-destructive'

  // ── PDF iframe URL with page anchor ───────────────────────────────────────
  const iframeSrc = pdfUrl
    ? `${pdfUrl}#page=${pageNumber}&toolbar=0&navpanes=0`
    : null

  return (
    <div className="flex flex-col lg:flex-row gap-0 flex-1 min-h-0 overflow-hidden">

      {/* ── LEFT: PDF Viewer ──────────────────────────────────────────────── */}
      <div className="lg:w-[55%] flex flex-col border-r bg-muted/10">
        {/* Header bar */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b bg-background">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Receipt — Page {pageNumber}
          </span>
          {pdfUrl && (
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <ExternalLink className="w-3 h-3" />
              Full PDF
            </a>
          )}
        </div>

        {/* PDF embed */}
        {iframeSrc ? (
          <iframe
            src={iframeSrc}
            className="flex-1 w-full border-0"
            title={`Receipt page ${pageNumber}`}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground p-8">
            <FileX className="w-10 h-10 opacity-30" />
            <p className="text-sm">No PDF available for this transaction.</p>
            {transaction.source_pdf_url && (
              <a
                href={transaction.source_pdf_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary underline"
              >
                Try opening source link
              </a>
            )}
          </div>
        )}
      </div>

      {/* ── RIGHT: Review Form ────────────────────────────────────────────── */}
      <div className="lg:w-[45%] overflow-y-auto">
        <div className="p-5 space-y-4">

          {/* Status row */}
          <div className="flex items-center justify-between">
            <Badge
              variant={STATUS_COLORS[transaction.status ?? ''] ?? 'secondary'}
              className="capitalize text-xs"
            >
              {transaction.status ?? '—'}
            </Badge>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {confidence != null && (
                <span className={confidenceColor}>
                  OCR {(confidence * 100).toFixed(0)}%
                </span>
              )}
              {transaction.duplicate_suspected && (
                <span className="flex items-center gap-1 text-yellow-600">
                  <AlertTriangle className="w-3 h-3" />
                  Duplicate flag
                </span>
              )}
            </div>
          </div>

          {/* ── Extracted fields (editable) ─────────────────────────────── */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">
                {isVerified ? 'Verified Data' : 'Extracted Data — review & correct'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Case Number</Label>
                  <Input
                    className="font-mono text-xs h-8"
                    value={form.extracted_case_number}
                    onChange={(e) => set('extracted_case_number', e.target.value)}
                    disabled={isVerified}
                    placeholder="e.g. 38084283B-01"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Check Number</Label>
                  <Input
                    className="font-mono text-xs h-8"
                    value={form.extracted_check_number}
                    onChange={(e) => set('extracted_check_number', e.target.value)}
                    disabled={isVerified}
                    placeholder="e.g. 1234"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Amount ($)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    className="h-8 text-sm"
                    value={form.extracted_amount}
                    onChange={(e) => set('extracted_amount', e.target.value)}
                    disabled={isVerified}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Check Date</Label>
                  <Input
                    type="date"
                    className="h-8 text-sm"
                    value={form.extracted_check_date}
                    onChange={(e) => set('extracted_check_date', e.target.value)}
                    disabled={isVerified}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Rent From</Label>
                  <Input
                    type="date"
                    className="h-8 text-sm"
                    value={form.extracted_rent_from}
                    onChange={(e) => set('extracted_rent_from', e.target.value)}
                    disabled={isVerified}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Rent To</Label>
                  <Input
                    type="date"
                    className="h-8 text-sm"
                    value={form.extracted_rent_to}
                    onChange={(e) => set('extracted_rent_to', e.target.value)}
                    disabled={isVerified}
                  />
                </div>
              </div>

            </CardContent>
          </Card>

          {/* ── Tenant match ────────────────────────────────────────────── */}
          <Card className={form.matched_tenant_id ? 'border-green-200' : 'border-orange-200'}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Matched Tenant</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {isVerified && matchedTenant ? (
                <div className="flex items-center justify-between">
                  <div>
                    <Link
                      href={`/tenants/${matchedTenant.id}`}
                      className="font-medium hover:underline text-primary text-sm"
                    >
                      {matchedTenant.name}
                    </Link>
                    <p className="text-xs text-muted-foreground font-mono">{matchedTenant.case_number}</p>
                  </div>
                  <Badge variant="default" className="text-xs">Verified</Badge>
                </div>
              ) : (
                <div className="space-y-1">
                  <Label className="text-xs">Select tenant</Label>
                  <Select
                    value={form.matched_tenant_id}
                    onValueChange={(v) => set('matched_tenant_id', v ?? '')}
                    disabled={isVerified}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="No tenant matched — select manually" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unmatched" className="text-xs italic text-muted-foreground">
                        — Unmatched —
                      </SelectItem>
                      {allTenants.map((t) => (
                        <SelectItem key={t.id} value={t.id} className="text-xs">
                          {t.name}
                          {t.case_number ? ` · ${t.case_number}` : ''}
                          {t.status === 'moved_out' ? ' (moved out)' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Review notes ────────────────────────────────────────────── */}
          <div className="space-y-1">
            <Label className="text-xs">Review Notes</Label>
            <Textarea
              className="text-xs resize-none"
              rows={2}
              placeholder="Optional: note any corrections or issues"
              value={form.review_notes}
              onChange={(e) => set('review_notes', e.target.value)}
              disabled={isVerified}
            />
          </div>

          {/* ── Action buttons ──────────────────────────────────────────── */}
          <div className="space-y-2 pt-1">
            {isVerified ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-green-700 font-medium">
                  <CheckCircle2 className="w-4 h-4" />
                  Verified — this record is locked.
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleReset}
                  className="w-full"
                >
                  <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                  Un-verify (reopen for editing)
                </Button>
              </div>
            ) : isBlank ? (
              <p className="text-xs text-muted-foreground">
                This page was detected as blank. No action needed.
              </p>
            ) : (
              <div className="space-y-2">
                {/* Primary actions */}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1"
                    onClick={handleVerify}
                    disabled={verifying || saving || rejecting}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                    {verifying ? 'Verifying…' : 'Save & Verify'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSave}
                    disabled={saving || verifying || rejecting}
                  >
                    <Save className="w-3.5 h-3.5 mr-1.5" />
                    {saving ? 'Saving…' : 'Save Draft'}
                  </Button>
                </div>
                {/* Reject */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleReject}
                  disabled={rejecting || verifying || saving}
                  className="w-full text-destructive hover:text-destructive hover:bg-destructive/5"
                >
                  <XCircle className="w-3.5 h-3.5 mr-1.5" />
                  {rejecting ? 'Rejecting…' : 'Reject (invalid / unreadable)'}
                </Button>
              </div>
            )}
          </div>

          {/* ── Meta ────────────────────────────────────────────────────── */}
          <div className="border-t pt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
            <div>
              <span className="block">Created by</span>
              <span className="text-foreground">{transaction.created_by ?? 'system'}</span>
            </div>
            <div>
              <span className="block">Created at</span>
              <span className="text-foreground">
                {new Date(transaction.created_at).toLocaleDateString('en-US')}
              </span>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
