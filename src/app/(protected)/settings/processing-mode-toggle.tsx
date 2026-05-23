'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

export function ProcessingModeToggle({ currentMode }: { currentMode: string }) {
  const supabase = createClient()
  const [mode, setMode] = useState(currentMode)
  const [loading, setLoading] = useState(false)

  async function toggle() {
    const newMode = mode === 'immediate' ? 'scheduled' : 'immediate'
    setLoading(true)

    const { error } = await supabase
      .from('system_settings')
      .update({ processing_mode: newMode })
      .eq('id', 1)

    if (error) {
      toast.error(error.message)
    } else {
      setMode(newMode)
      toast.success(`Processing mode set to ${newMode}.`)
    }
    setLoading(false)
  }

  return (
    <div className="flex items-center gap-3">
      <div className="flex rounded-md border overflow-hidden">
        <button
          onClick={() => mode !== 'immediate' && toggle()}
          disabled={loading}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            mode === 'immediate'
              ? 'bg-primary text-primary-foreground'
              : 'bg-background text-muted-foreground hover:bg-muted'
          }`}
        >
          Immediate
        </button>
        <button
          onClick={() => mode !== 'scheduled' && toggle()}
          disabled={loading}
          className={`px-4 py-2 text-sm font-medium transition-colors border-l ${
            mode === 'scheduled'
              ? 'bg-primary text-primary-foreground'
              : 'bg-background text-muted-foreground hover:bg-muted'
          }`}
        >
          Scheduled
        </button>
      </div>
      {loading && <span className="text-xs text-muted-foreground">Saving…</span>}
    </div>
  )
}
