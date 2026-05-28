'use client'

import { Printer, Download, FileSpreadsheet } from 'lucide-react'
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

  // ── Excel export (HTML table → .xls — opens natively in Excel, zero dependencies) ──
  const handleExcelDownload = () => {
    const fmt = (n: number) => (n > 0 ? `$${n.toFixed(2)}` : n < 0 ? `($${Math.abs(n).toFixed(2)})` : '$0.00')

    const headerRow = `
      <tr style="background:#dce6f1;font-weight:bold">
        <th>Month</th><th>Year</th><th>Due</th>
        <th>HRA 1</th><th>Check #1</th>
        <th>HRA 2</th><th>Check #2</th>
        <th>HRA 3</th><th>Check #3</th>
        <th>HRA 4</th><th>Check #4</th>
        <th>HRA 5</th><th>Check #5</th>
        <th>Paid By Tenant</th>
        <th>Balance</th>
        <th>Comment</th>
      </tr>`

    const bodyRows = months.map((m) => {
      const [monthStr, yearStr] = m.month_label.split(' ')
      const checks = m.checks.slice(0, 5)
      const totalReceived = checks.reduce((s, c) => s + c.amount, 0)
      const bal = m.balance
      const checkCols = [0,1,2,3,4].map((i) =>
        `<td>${checks[i] ? `$${checks[i].amount.toFixed(2)}` : ''}</td><td style="font-family:monospace">${checks[i]?.check_number ?? ''}</td>`
      ).join('')
      const rowBg = bal > 500 ? 'background:#ffe8e8' : bal < -50 ? 'background:#e8f5e9' : ''
      return `<tr style="${rowBg}">
        <td>${monthStr ?? ''}</td>
        <td>${yearStr ?? ''}</td>
        <td>$${m.due.toFixed(2)}</td>
        ${checkCols}
        <td></td>
        <td style="font-weight:bold">${fmt(bal)}</td>
        <td>${totalReceived === 0 && m.due > 0 ? 'No payment received' : ''}</td>
      </tr>`
    }).join('')

    const totalsByCol = [0,1,2,3,4].map((i) => months.reduce((s, m) => s + (m.checks[i]?.amount ?? 0), 0))
    const latestBal = months.at(-1)?.balance ?? 0
    const totRow = `<tr style="background:#dce6f1;font-weight:bold">
      <td colspan="2">TOTAL</td>
      <td>$${months.reduce((s, m) => s + m.due, 0).toFixed(2)}</td>
      ${totalsByCol.map((t) => `<td>$${t.toFixed(2)}</td><td></td>`).join('')}
      <td></td>
      <td>${fmt(latestBal)}</td>
      <td></td>
    </tr>`

    const infoBlock = `
      <table style="font-family:Arial;font-size:10pt;margin-bottom:12pt">
        <tr><td style="font-weight:bold;padding-right:8pt">Tenant:</td><td>${tenantName ?? ''}</td>
            <td style="font-weight:bold;padding-left:16pt;padding-right:8pt">Case #:</td><td style="font-family:monospace">${caseNumber ?? '—'}</td></tr>
        <tr><td style="font-weight:bold">Balance:</td><td style="font-weight:bold">${fmt(latestBal)}</td>
            <td style="font-weight:bold;padding-left:16pt">Months:</td><td>${months.length}</td></tr>
      </table>`

    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:x="urn:schemas-microsoft-com:office:excel">
      <head><meta charset="utf-8"/>
        <style>
          table { border-collapse: collapse; font-family: Arial; font-size: 9pt; }
          td, th { border: 1px solid #aaa; padding: 3pt 5pt; }
        </style>
      </head>
      <body>
        <div style="font-family:Arial;font-size:12pt;font-weight:bold;margin-bottom:4pt">Rent Ledger</div>
        ${infoBlock}
        <table>${headerRow}${bodyRows}${totRow}</table>
      </body>
    </html>`

    const blob = new Blob(['﻿', html], { type: 'application/vnd.ms-excel;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ledger_${(tenantName ?? tenantId).replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.xls`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

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

  return (
    <div className="flex gap-2">
      <Button variant="outline" size="sm" onClick={() => window.print()}>
        <Printer className="w-3.5 h-3.5 mr-1.5" />
        Print / PDF
      </Button>

      <Button variant="outline" size="sm" onClick={handleCsvDownload}>
        <Download className="w-3.5 h-3.5 mr-1.5" />
        Export CSV
      </Button>

      <Button variant="outline" size="sm" onClick={handleExcelDownload}>
        <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5" />
        Export Excel
      </Button>
    </div>
  )
}
