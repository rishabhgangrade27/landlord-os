'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'

const STATUS_CLASS: Record<string, string> = {
  verified:            'bg-emerald-100 text-emerald-800 border-emerald-200',
  processing:          'bg-blue-100 text-blue-800 border-blue-200',
  needs_review:        'bg-amber-100 text-amber-800 border-amber-200',
  duplicate_suspected: 'bg-purple-100 text-purple-800 border-purple-200',
  rejected:            'bg-red-100 text-red-800 border-red-200',
  blank_detected:      'bg-slate-100 text-slate-600 border-slate-200',
  deleted_blank:       'bg-slate-100 text-slate-500 border-slate-200',
}

export function TransactionRow({ t }: { t: any }) {
  const router = useRouter()
  const tenant = t.tenant

  return (
    <tr
      className="border-b last:border-0 hover:bg-muted/20 cursor-pointer"
      onClick={() => router.push(`/transactions/${t.id}`)}
    >
      <td className="px-4 py-2.5 font-mono text-xs">
        <Link href={`/transactions/${t.id}`} className="hover:underline text-primary font-semibold">
          {t.extracted_case_number ?? 'Review'}
        </Link>
      </td>
      <td className="px-4 py-2.5">
        {tenant ? (
          <Link href={`/tenants/${tenant.id}`} className="hover:underline" onClick={(e) => e.stopPropagation()}>
            {tenant.name}
          </Link>
        ) : (
          <span className="text-muted-foreground">Unmatched</span>
        )}
      </td>
      <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground hidden sm:table-cell">
        {t.extracted_check_number ?? '—'}
      </td>
      <td className="px-4 py-2.5 text-muted-foreground hidden md:table-cell">
        {t.extracted_check_date ?? '—'}
      </td>
      <td className="px-4 py-2.5 text-right font-medium">
        {t.extracted_amount != null
          ? `$${Number(t.extracted_amount).toFixed(2)}`
          : '—'}
      </td>
      <td className="px-4 py-2.5">
        <Badge
          variant="outline"
          className={`text-xs border ${STATUS_CLASS[t.status ?? ''] ?? 'bg-slate-100 text-slate-600 border-slate-200'}`}
        >
          {t.status ?? '—'}
        </Badge>
      </td>
      <td className="px-4 py-2.5 text-right text-muted-foreground text-xs hidden lg:table-cell">
        {t.ocr_confidence != null
          ? `${(Number(t.ocr_confidence) * 100).toFixed(0)}%`
          : '—'}
      </td>
    </tr>
  )
}
