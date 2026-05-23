'use client'

import { useState } from 'react'
import { buttonVariants } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { Download, ChevronDown, FileText, Sheet } from 'lucide-react'

interface Props {
  /** Supabase tenant UUID */
  tenantId: string
  /** 'court' = per-check detail (view_court_ledger)
   *  'summary' = monthly balance (view_rent_ledger) */
  type?: 'court' | 'summary'
}

export function LedgerExportButton({ tenantId, type = 'court' }: Props) {
  const [loading, setLoading] = useState<'pdf' | 'csv' | null>(null)

  // ── CSV — let the browser follow the link so it downloads the file ──────────
  function handleCSV() {
    const url = `/api/export-ledger?tenant_id=${tenantId}&format=csv&type=${type}`
    const a = document.createElement('a')
    a.href = url
    a.click()
  }

  // ── PDF — fetch JSON data from API, then generate PDF in the browser ─────────
  async function handlePDF() {
    setLoading('pdf')
    try {
      const res = await fetch(
        `/api/export-ledger?tenant_id=${tenantId}&format=json&type=${type}`
      )
      if (!res.ok) throw new Error(`API returned ${res.status}`)
      const { tenant, rows } = await res.json() as {
        tenant: { name: string; full_legal_name: string | null; case_number: string | null }
        rows: Record<string, unknown>[]
        type: string
      }

      // Dynamic import keeps jsPDF out of the initial bundle
      const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable'),
      ])

      const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
      const pageWidth = doc.internal.pageSize.getWidth()
      const margin = 40

      // ── Header ────────────────────────────────────────────────────────────
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      const title = type === 'court'
        ? 'Court Ledger — Rent Payment Detail'
        : 'Rent Ledger — Monthly Balance Summary'
      doc.text(title, margin, 50)

      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      const lines = [
        `Tenant: ${tenant.name}${tenant.full_legal_name ? ` / ${tenant.full_legal_name}` : ''}`,
        `HRA Case #: ${tenant.case_number ?? '—'}`,
        `Exported: ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`,
      ]
      lines.forEach((l, i) => doc.text(l, margin, 70 + i * 13))

      // ── Rule ──────────────────────────────────────────────────────────────
      doc.setDrawColor(200, 200, 200)
      doc.line(margin, 115, pageWidth - margin, 115)

      // ── Table ─────────────────────────────────────────────────────────────
      if (type === 'court') {
        autoTable(doc, {
          startY: 125,
          margin: { left: margin, right: margin },
          head: [['Month', 'Check #', 'Date', 'Amount Rcvd', 'Monthly Due', 'Balance']],
          body: rows.map((r) => [
            r.month_label ?? '',
            r.check_number ?? '—',
            r.check_date   ?? '—',
            `$${Number(r.amount        ?? 0).toFixed(2)}`,
            `$${Number(r.monthly_due   ?? 0).toFixed(2)}`,
            `$${Number(r.running_balance ?? 0).toFixed(2)}`,
          ]),
          styles:     { fontSize: 8, cellPadding: 4 },
          headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [248, 248, 248] },
          didDrawCell: (data) => {
            // Colour the balance column: positive = red, zero/negative = green
            if (data.section === 'body' && data.column.index === 5) {
              const val = Number(
                String(data.cell.raw).replace(/[^0-9.-]/g, '')
              )
              doc.setTextColor(val > 0 ? 200 : 0, val > 0 ? 0 : 130, 0)
            }
          },
        })
      } else {
        autoTable(doc, {
          startY: 125,
          margin: { left: margin, right: margin },
          head: [['Month', 'Due', 'Paid', 'Balance', 'Flag']],
          body: rows.map((r) => {
            const month = r.month
              ? new Date(String(r.month)).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
              : '—'
            const flag = r.flag_60_day ? '60d' : r.flag_30_day ? '30d' : ''
            return [
              month,
              `$${Number(r.due_amount     ?? 0).toFixed(2)}`,
              `$${Number(r.paid_amount    ?? 0).toFixed(2)}`,
              `$${Number(r.pending_balance ?? 0).toFixed(2)}`,
              flag,
            ]
          }),
          styles:     { fontSize: 8, cellPadding: 4 },
          headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [248, 248, 248] },
        })
      }

      // ── Footer ────────────────────────────────────────────────────────────
      const pageCount = (doc.internal as any).getNumberOfPages()
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i)
        doc.setFontSize(7)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(150)
        doc.text(
          `Page ${i} of ${pageCount}  •  LandlordOS  •  Confidential`,
          pageWidth / 2,
          doc.internal.pageSize.getHeight() - 20,
          { align: 'center' }
        )
      }

      // ── Save ──────────────────────────────────────────────────────────────
      const slug = tenant.name.replace(/[^a-z0-9]/gi, '-').toLowerCase()
      doc.save(`${type === 'court' ? 'court-ledger' : 'rent-ledger'}-${slug}.pdf`)

      toast.success('PDF downloaded.')
    } catch (err) {
      console.error(err)
      toast.error('PDF generation failed. Try CSV instead.')
    } finally {
      setLoading(null)
    }
  }

  const busy = loading !== null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={busy}
        className={cn(buttonVariants({ size: 'sm', variant: 'outline' }))}
      >
        <Download className="w-4 h-4 mr-1.5" />
        {loading === 'pdf' ? 'Generating PDF…'
         : loading === 'csv' ? 'Preparing CSV…'
         : 'Export'}
        <ChevronDown className="w-3 h-3 ml-1.5 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onClick={handlePDF} disabled={busy}>
          <FileText className="w-4 h-4 mr-2 shrink-0" />
          Export PDF
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleCSV} disabled={busy}>
          <Sheet className="w-4 h-4 mr-2 shrink-0" />
          Export CSV
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
