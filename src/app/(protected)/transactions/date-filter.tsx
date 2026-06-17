'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

export function DateFilter() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const dateFrom   = searchParams.get('date_from') ?? ''
  const dateTo     = searchParams.get('date_to') ?? ''
  const caseNum    = searchParams.get('case_number') ?? ''
  const amountMin  = searchParams.get('amount_min') ?? ''
  const amountMax  = searchParams.get('amount_max') ?? ''

  // Local state so we don't navigate on every keystroke for text fields
  const [localCase,      setLocalCase]      = useState(caseNum)
  const [localAmountMin, setLocalAmountMin] = useState(amountMin)
  const [localAmountMax, setLocalAmountMax] = useState(amountMax)

  // Sync if URL changes externally (e.g. status tab click clears params)
  useEffect(() => { setLocalCase(caseNum) }, [caseNum])
  useEffect(() => { setLocalAmountMin(amountMin) }, [amountMin])
  useEffect(() => { setLocalAmountMax(amountMax) }, [amountMax])

  function buildParams(overrides: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString())
    const merged = { date_from: dateFrom, date_to: dateTo, case_number: localCase, amount_min: localAmountMin, amount_max: localAmountMax, ...overrides }
    for (const [k, v] of Object.entries(merged)) {
      if (v) params.set(k, v); else params.delete(k)
    }
    params.delete('page')
    return params.toString()
  }

  const updateDate = useCallback(
    (key: string, value: string) => {
      router.push(`/transactions?${buildParams({ [key]: value })}`)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [router, searchParams, localCase, localAmountMin, localAmountMax],
  )

  function applyTextFilters() {
    router.push(`/transactions?${buildParams({})}`)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') applyTextFilters()
  }

  function clearAll() {
    setLocalCase('')
    setLocalAmountMin('')
    setLocalAmountMax('')
    const params = new URLSearchParams(searchParams.toString())
    ;['date_from', 'date_to', 'case_number', 'amount_min', 'amount_max', 'page'].forEach((k) => params.delete(k))
    router.push(`/transactions?${params.toString()}`)
  }

  const hasAny = dateFrom || dateTo || localCase || localAmountMin || localAmountMax

  return (
    <div className="flex flex-wrap items-end gap-3">
      {/* Date range */}
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Date from</Label>
        <Input type="date" className="h-8 text-sm w-36" value={dateFrom} onChange={(e) => updateDate('date_from', e.target.value)} />
      </div>
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">to</Label>
        <Input type="date" className="h-8 text-sm w-36" value={dateTo} onChange={(e) => updateDate('date_to', e.target.value)} />
      </div>

      {/* Case number */}
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Case #</Label>
        <Input
          className="h-8 text-sm w-36 font-mono"
          placeholder="e.g. 038482672D"
          value={localCase}
          onChange={(e) => setLocalCase(e.target.value)}
          onBlur={applyTextFilters}
          onKeyDown={handleKeyDown}
        />
      </div>

      {/* Amount range */}
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Amount min</Label>
        <Input
          type="number"
          min="0"
          step="0.01"
          className="h-8 text-sm w-28"
          placeholder="0.00"
          value={localAmountMin}
          onChange={(e) => setLocalAmountMin(e.target.value)}
          onBlur={applyTextFilters}
          onKeyDown={handleKeyDown}
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">max</Label>
        <Input
          type="number"
          min="0"
          step="0.01"
          className="h-8 text-sm w-28"
          placeholder="any"
          value={localAmountMax}
          onChange={(e) => setLocalAmountMax(e.target.value)}
          onBlur={applyTextFilters}
          onKeyDown={handleKeyDown}
        />
      </div>

      {hasAny && (
        <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground" onClick={clearAll}>
          Clear filters
        </Button>
      )}
    </div>
  )
}
