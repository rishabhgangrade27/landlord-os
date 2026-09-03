'use server'

import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/dal'
import { createBackup } from '@/lib/backup'

export async function getTenants() {
  await requireAuth()
  return prisma.tenant.findMany({
    select: { id: true, name: true, case_number: true, status: true },
    orderBy: { name: 'asc' }
  })
}

// Manual bulk entry is exactly the kind of "risky op" a pre-snapshot is for —
// it's hand-typed, unverified data going straight into the ledger. Only
// bothers for genuinely bulk batches; a single manual correction doesn't need
// a pg_dump round-trip, and there's still the daily auto-snapshot as a floor.
// Best-effort: if the snapshot itself fails, don't block the actual entry —
// log it and move on, the daily backup and manual button are still there.
export async function createManualTransactions(data: any[]) {
  await requireAuth()
  if (data.length > 5) {
    const backupResult = await createBackup('pre-op', 'bulk_manual_entry')
    if (!backupResult.success) {
      console.error('Pre-op backup failed before bulk manual entry:', backupResult.error)
    }
  }
  try {
    await prisma.transaction.createMany({
      data
    })
    return { success: true }
  } catch (error: any) {
    return { error: error.message }
  }
}
