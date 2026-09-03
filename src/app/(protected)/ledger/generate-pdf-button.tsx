'use client'

import { useState } from 'react'
import { checkPdfJob } from './actions'
import { toast } from 'sonner'
import { FileDown } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function GeneratePDFButton({ tenantId }: { tenantId: string }) {
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    setLoading(true)
    try {
      const res = await fetch('/api/court-ledger-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: tenantId }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.error ?? `Request failed (${res.status})`)
      }
      const { job_id } = await res.json()
      if (!job_id) throw new Error('No job_id returned from API')

      // Poll pdf_jobs every 2 seconds, max 60 seconds
      const deadline = Date.now() + 60_000
      let pdfUrl: string | null = null

      while (Date.now() < deadline) {
        await new Promise<void>((r) => setTimeout(r, 2000))
        const res = await checkPdfJob(job_id)
        if (res.error) throw new Error(res.error)
        if (res.status === 'done') {
          pdfUrl = res.pdfUrl
          break
        }
        if (res.status === 'failed') {
          throw new Error('PDF generation failed')
        }
      }

      if (!pdfUrl) throw new Error('PDF generation timed out after 60 seconds')
      window.open(pdfUrl, '_blank')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate PDF')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleClick} disabled={loading}>
      <FileDown className="w-4 h-4 mr-1.5" />
      {loading ? 'Generating…' : 'Generate Court PDF'}
    </Button>
  )
}
