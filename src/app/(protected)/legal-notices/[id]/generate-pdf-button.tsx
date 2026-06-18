'use client'

import { useState } from 'react'
import { FileDown, Loader2 } from 'lucide-react'

export function GeneratePdfButton({ noticeId }: { noticeId: string }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleGenerate() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/generate-notice-pdf/${noticeId}`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'PDF generation failed')
        return
      }
      // Reload so the Download button appears
      window.location.reload()
    } catch {
      setError('Network error — try again')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        onClick={handleGenerate}
        disabled={loading}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-md hover:bg-muted/30 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <FileDown className="w-3.5 h-3.5" />
        )}
        {loading ? 'Generating PDF…' : 'Generate PDF'}
      </button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
