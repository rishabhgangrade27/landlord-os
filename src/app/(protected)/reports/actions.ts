'use server'

import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { requireAuth } from '@/lib/dal'

export async function createExpense(data: {
  property_id: string
  unit_id: string | null
  category: string
  description: string | null
  amount: number
  expense_date: string
}) {
  await requireAuth()
  try {
    const expense = await prisma.expense.create({
      data: {
        property_id: data.property_id,
        category: data.category,
        description: data.description,
        amount: data.amount,
        expense_date: new Date(data.expense_date),
      }
    })

    revalidatePath('/reports')
    return { success: true, expense }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}
