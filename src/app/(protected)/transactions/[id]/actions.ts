'use server'

import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/dal'

export async function updateTransaction(id: string, data: any) {
  await requireAuth()
  try {
    await prisma.transaction.update({
      where: { id },
      data
    })
    return { success: true }
  } catch (error: any) {
    return { error: error.message }
  }
}

export async function deleteTransaction(id: string) {
  await requireAuth()
  try {
    await prisma.transaction.delete({ where: { id } })
    return { success: true }
  } catch (error: any) {
    return { error: error.message }
  }
}

export async function createTenant(data: { name: string, case_number: string }) {
  await requireAuth()
  try {
    const tenant = await prisma.tenant.create({
      data: { ...data, status: 'active' }
    })
    return { data: tenant }
  } catch (error: any) {
    return { error: error.message }
  }
}
