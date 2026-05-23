'use client'

import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

export function MaskedField({ value }: { value: string | null }) {
  const [visible, setVisible] = useState(false)

  if (!value) return <p className="text-sm font-medium">—</p>

  return (
    <div className="flex items-center gap-2">
      <p className="text-sm font-medium font-mono">
        {visible ? value : '•'.repeat(Math.min(value.length, 9))}
      </p>
      <button
        type="button"
        onClick={() => setVisible(!visible)}
        className="text-muted-foreground hover:text-foreground transition-colors"
      >
        {visible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
      </button>
    </div>
  )
}
