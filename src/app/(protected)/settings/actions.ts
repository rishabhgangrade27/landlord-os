'use server'

import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { requireAuth } from '@/lib/dal'
import { createBackup, listBackups, restoreBackup } from '@/lib/backup'

export async function updateAttorneySettings(data: {
  attorney_name: string | null
  attorney_address: string | null
  attorney_phone: string | null
  attorney_email: string | null
}) {
  await requireAuth()
  try {
    await prisma.systemSettings.update({
      where: { id: 1 },
      data,
    })
    revalidatePath('/settings')
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

export async function updateProcessingMode(mode: 'immediate' | 'scheduled') {
  await requireAuth()
  try {
    await prisma.systemSettings.update({
      where: { id: 1 },
      data: { processing_mode: mode },
    })
    revalidatePath('/settings')
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

export async function getBackupList() {
  await requireAuth()
  const backups = await listBackups()
  return backups.map((b) => ({ ...b, createdAt: b.createdAt.toISOString() }))
}

export async function createManualBackup() {
  await requireAuth()
  const result = await createBackup('manual')
  revalidatePath('/settings')
  return result
}

export async function restoreFromBackup(filename: string) {
  await requireAuth()
  const result = await restoreBackup(filename)
  revalidatePath('/settings')
  return result
}
