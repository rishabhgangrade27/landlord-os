'use client'

import { Printer } from 'lucide-react'

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-md hover:bg-muted/30"
    >
      <Printer className="w-3.5 h-3.5" />
      Print / Save PDF
    </button>
  )
}
