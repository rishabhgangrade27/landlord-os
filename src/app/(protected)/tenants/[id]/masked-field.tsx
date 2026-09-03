'use client'

import { useState, useTransition } from 'react'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { revealSensitiveField } from '../actions'

export function MaskedField({
  tenantId,
  field,
  last4,
  hasValue,
}: {
  tenantId: string
  field: 'ssn_encrypted' | 'state_id'
  last4: string | null
  hasValue: boolean
}) {
  const [revealed, setRevealed] = useState<string | null>(null)
  const [visible, setVisible] = useState(false)
  const [isPending, startTransition] = useTransition()

  if (!hasValue) return <p className="text-sm font-medium">—</p>

  function toggle() {
    if (visible) {
      setVisible(false)
      return
    }
    if (revealed !== null) {
      setVisible(true)
      return
    }
    startTransition(async () => {
      const { data } = await revealSensitiveField(tenantId, field)
      setRevealed(data)
      setVisible(true)
    })
  }

  const display = visible && revealed ? revealed : `••••${last4 ?? ''}`

  return (
    <div className="flex items-center gap-2">
      <p className="text-sm font-medium font-mono">{display}</p>
      <button
        type="button"
        onClick={toggle}
        disabled={isPending}
        className="text-muted-foreground hover:text-foreground transition-colors"
      >
        {isPending ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : visible ? (
          <EyeOff className="w-3.5 h-3.5" />
        ) : (
          <Eye className="w-3.5 h-3.5" />
        )}
      </button>
    </div>
  )
}
