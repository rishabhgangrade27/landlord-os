'use client'

import { Printer, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'

export type LedgerCheckEntry = {
  check_number: string | null
  amount: number
  check_date: string | null
}

export type LedgerMonthRow = {
  month: string
  month_label: string
  due: number
  checks: LedgerCheckEntry[]
  balance: number
}

interface LedgerExportButtonProps {
  tenantId: string
  tenantName?: string
  caseNumber?: string
  months?: LedgerMonthRow[]
}

export function LedgerExportButton({
  tenantId,
  tenantName,
  caseNumber,
  months = [],
}: LedgerExportButtonProps) {

  // ── CSV export ────────────────────────────────────────────────────────────
  const handleCsvDownload = () => {
    const headers = [
      'Month', 'Year', 'Due',
      'Check 1', 'Check 1 #',
      'Check 2', 'Check 2 #',
      'Check 3', 'Check 3 #',
      'Check 4', 'Check 4 #',
      'Check 5', 'Check 5 #',
      'Paid By Tenant',
      'Balance',
      'Comment',
    ]

    const rows = months.map((m) => {
      const [monthStr, yearStr] = m.month_label.split(' ')
      const checks = m.checks.slice(0, 5)
      const totalReceived = checks.reduce((s, c) => s + c.amount, 0)

      const checkCols = [0, 1, 2, 3, 4].flatMap((i) => [
        checks[i]?.amount != null ? checks[i].amount.toFixed(2) : '',
        checks[i]?.check_number ?? '',
      ])

      const comment = totalReceived === 0 && m.due > 0 ? 'No payment received' : ''

      return [
        monthStr ?? '',
        yearStr ?? '',
        m.due.toFixed(2),
        ...checkCols,
        '',             // Paid By Tenant — tracked manually for now
        m.balance.toFixed(2),
        comment,
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(',')
    })

    // Footer totals row
    const totals = [
      'TOTAL', '',
      months.reduce((s, m) => s + m.due, 0).toFixed(2),
      ...[0, 1, 2, 3, 4].flatMap((i) => [
        months.reduce((s, m) => s + (m.checks[i]?.amount ?? 0), 0).toFixed(2),
        '',
      ]),
      '',
      (months.at(-1)?.balance ?? 0).toFixed(2),
      '',
    ]
      .map((v) => `"${v}"`)
      .join(',')

    const csv = [headers.join(','), ...rows, totals].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ledger_${(tenantName ?? tenantId).replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // ── Print page ────────────────────────────────────────────────────────────
  const printUrl = `/ledger/print?tenant_id=${tenantId}`

  return (
    <div className="flex gap-2">
      <a href={printUrl} target="_blank" rel="noopener noreferrer">
        <Button variant="outline" size="sm">
          <Printer className="w-3.5 h-3.5 mr-1.5" />
          Print / PDF
        </Button>
      </a>

      <Button variant="outline" size="sm" onClick={handleCsvDownload}>
        <Download className="w-3.5 h-3.5 mr-1.5" />
        Export CSV
      </Button>
    </div>
  )
}
