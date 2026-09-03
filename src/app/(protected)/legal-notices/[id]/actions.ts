'use server'

import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/dal'

export async function updateLegalNotice(id: string, data: any) {
  await requireAuth()
  try {
    await prisma.legalNotice.update({
      where: { id },
      data
    })
    return { success: true }
  } catch (error: any) {
    return { error: error.message }
  }
}
