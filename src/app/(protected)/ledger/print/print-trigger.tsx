'use client'

import { useEffect } from 'react'

// Automatically opens the browser print dialog when the print page loads.
// This means clicking "Print / PDF" from the ledger will land on this page
// and immediately pop the print dialog — one less click for Sonu.
export function PrintTrigger() {
  useEffect(() => {
    // Small delay so the page renders fully before the dialog opens.
    const t = setTimeout(() => window.print(), 600)
    return () => clearTimeout(t)
  }, [])

  return null
}
