'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

export function DateFilter() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const dateFrom = searchParams.get('date_from') ?? ''
  const dateTo = searchParams.get('date_to') ?? ''

  const update = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value) {
        params.set(key, value)
      } else {
        params.delete(key)
      }
      params.delete('page')
      router.push(`/transactions?${params.toString()}`)
    },
    [router, searchParams],
  )

  const clear = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('date_from')
    params.delete('date_to')
    params.delete('page')
    router.push(`/transactions?${params.toString()}`)
  }, [router, searchParams])

  const hasFilter = dateFrom || dateTo

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Check date from</Label>
        <Input
          type="date"
          className="h-8 text-sm w-36"
          value={dateFrom}
          onChange={(e) => update('date_from', e.target.value)}
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">to</Label>
        <Input
          type="date"
          className="h-8 text-sm w-36"
          value={dateTo}
          onChange={(e) => update('date_to', e.target.value)}
        />
      </div>
      {hasFilter && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-xs text-muted-foreground"
          onClick={clear}
        >
          Clear dates
        </Button>
      )}
    </div>
  )
}
