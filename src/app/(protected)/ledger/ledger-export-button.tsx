'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Download } from 'lucide-react'

export function LedgerExportButton({ tenantId }: { tenantId: string }) {
  const [loading, setLoading] = useState(false)

  async function handleExport() {
    const webhookUrl = process.env.NEXT_PUBLIC_N8N_WEBHOOK_LEDGER_EXPORT
    if (!webhookUrl) {
      toast.error('Ledger export webhook not configured. Add N8N_WEBHOOK_LEDGER_EXPORT to .env.local')
      return
    }

    setLoading(true)
    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: tenantId, format: 'pdf' }),
      })

      if (!res.ok) throw new Error(`Webhook returned ${res.status}`)
      toast.success('Export triggered! Check your email for the PDF.')
    } catch (err) {
      toast.error('Export failed. Check the n8n webhook.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button size="sm" variant="outline" onClick={handleExport} disabled={loading}>
      <Download className="w-4 h-4 mr-1.5" />
      {loading ? 'Exporting…' : 'Export PDF'}
    </Button>
  )
}
