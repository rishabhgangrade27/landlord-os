'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createManualBackup, restoreFromBackup } from './actions'
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
import { DatabaseBackup, RotateCcw } from 'lucide-react'

type BackupItem = {
  filename: string
  kind: 'manual' | 'daily' | 'pre-op'
  createdAt: string
  sizeBytes: number
}

const KIND_LABEL: Record<BackupItem['kind'], string> = {
  manual: 'Manual',
  daily: 'Daily (automatic)',
  'pre-op': 'Safety snapshot',
}

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function BackupPanel({ initialBackups }: { initialBackups: BackupItem[] }) {
  const router = useRouter()
  // Not local state: router.refresh() re-runs the server component and gives
  // us a fresh initialBackups prop directly - a useState here would only
  // ever hold the value from the first render, since props changing don't
  // re-initialize it.
  const backups = initialBackups
  const [backingUp, setBackingUp] = useState(false)
  const [restoringFile, setRestoringFile] = useState<string | null>(null)

  async function handleBackupNow() {
    setBackingUp(true)
    const result = await createManualBackup()
    setBackingUp(false)
    if (result.success) {
      toast.success('Backup created.')
      router.refresh()
    } else {
      toast.error(result.error)
    }
  }

  async function handleRestore(filename: string) {
    setRestoringFile(filename)
    const result = await restoreFromBackup(filename)
    setRestoringFile(null)
    if (result.success) {
      toast.success(`Restored. A safety snapshot of the previous state was saved as ${result.safetyBackup}.`)
      router.refresh()
    } else {
      toast.error(result.error)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground max-w-md">
          Backups are full database snapshots. Restoring replaces everything currently
          in the database with the snapshot you pick — this is a day-level safety net,
          not a full undo history, so restoring loses anything entered since that
          snapshot was taken.
        </p>
        <Button variant="outline" size="sm" onClick={handleBackupNow} disabled={backingUp}>
          <DatabaseBackup className="w-3.5 h-3.5 mr-1.5" />
          {backingUp ? 'Backing up…' : 'Backup Now'}
        </Button>
      </div>

      {backups.length === 0 ? (
        <p className="text-sm text-muted-foreground">No backups yet.</p>
      ) : (
        <div className="border rounded-md divide-y">
          {backups.map((b) => (
            <div key={b.filename} className="flex items-center justify-between px-3 py-2 text-sm">
              <div>
                <div className="font-medium">
                  {new Date(b.createdAt).toLocaleString('en-US')}
                </div>
                <div className="text-xs text-muted-foreground">
                  {KIND_LABEL[b.kind]} · {formatSize(b.sizeBytes)}
                </div>
              </div>
              <AlertDialog>
                <AlertDialogTrigger
                  render={
                    <Button variant="outline" size="sm" disabled={restoringFile === b.filename}>
                      <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                      {restoringFile === b.filename ? 'Restoring…' : 'Restore'}
                    </Button>
                  }
                />
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Restore this backup?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This replaces everything currently in the database with the
                      snapshot from {new Date(b.createdAt).toLocaleString('en-US')}.
                      A safety snapshot of the current state is taken first, so this
                      can be undone — but anything entered after that snapshot will
                      be gone until you do.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleRestore(b.filename)}>
                      Restore
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
