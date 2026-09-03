'use server'

import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/dal'
import { revalidatePath } from 'next/cache'

export async function createContractor(data: {
  name: string
  trade: string | null
  phone: string | null
  email: string | null
  address: string | null
  payment_method: string | null
  notes: string | null
}) {
  await requireAuth()
  try {
    const contractor = await prisma.contractor.create({
      data: { ...data, status: 'active' },
    })
    revalidatePath('/contractors')
    return { data: contractor, error: null }
  } catch (error: any) {
    return { data: null, error: { message: error.message } }
  }
}

export async function updateContractor(id: string, data: {
  name: string
  trade: string | null
  phone: string | null
  email: string | null
  address: string | null
  payment_method: string | null
  notes: string | null
  status: string
}) {
  await requireAuth()
  try {
    await prisma.contractor.update({ where: { id }, data })
    revalidatePath('/contractors')
    revalidatePath(`/contractors/${id}`)
    return { error: null }
  } catch (error: any) {
    return { error: { message: error.message } }
  }
}
