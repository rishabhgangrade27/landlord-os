'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { CheckCircle2 } from 'lucide-react'

export function VerifyTransactionButton({ transactionId }: { transactionId: string }) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)

  async function handleVerify() {
    setLoading(true)
    const { error } = await supabase
      .from('transactions')
      .update({ status: 'verified', verified_at: new Date().toISOString() })
      .eq('id', transactionId)

    if (error) {
      toast.error(error.message)
      setLoading(false)
    } else {
      toast.success('Transaction verified.')
      router.refresh()
    }
  }

  return (
    <Button onClick={handleVerify} disabled={loading} size="sm">
      <CheckCircle2 className="w-4 h-4 mr-1.5" />
      {loading ? 'Verifying…' : 'Mark as Verified'}
    </Button>
  )
}
