'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updatePropertyStatus } from '../actions'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import { Archive } from 'lucide-react'

export function RetirePropertyButton({
  propertyId,
  currentStatus,
}: {
  propertyId: string
  currentStatus: string | null
}) {
  const router = useRouter()

  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const isRetired = currentStatus === 'Retired'

  async function handleToggle() {
    setLoading(true)
    const newStatus = isRetired ? 'Vacant' : 'Retired'
    const { error } = await updatePropertyStatus(propertyId, newStatus)
    setLoading(false)
    if (error) {
      toast.error(error.message)
    } else {
      toast.success(isRetired ? 'Property reactivated.' : 'Property retired.')
      setOpen(false)
      router.refresh()
    }
  }

  if (isRetired) {
    return (
      <Button variant="outline" size="sm" onClick={handleToggle} disabled={loading}>
        <Archive className="w-4 h-4 mr-1.5" />
        {loading ? 'Reactivating…' : 'Reactivate'}
      </Button>
    )
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={
          <Button variant="outline" size="sm" className="text-muted-foreground">
            <Archive className="w-4 h-4 mr-1.5" />
            Retire Property
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Retire this property?</AlertDialogTitle>
          <AlertDialogDescription>
            The property will be hidden from active views. All lease and transaction history is preserved. You can reactivate it at any time.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleToggle} disabled={loading}>
            {loading ? 'Retiring…' : 'Retire'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
