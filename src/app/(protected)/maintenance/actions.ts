'use server'

import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/dal'
import { revalidatePath } from 'next/cache'

// Maintenance tickets link to a Property (which serves as the unit in this
// app — see SCRATCHPAD.md, the Unit table has 0 real rows), not a Unit.
export async function getPropertiesForMaintenance() {
  await requireAuth()
  return prisma.property.findMany({
    where: { status: { notIn: ['Retired', 'Sold'] } },
    select: { id: true, name: true, nickname: true, address: true },
    orderBy: { nickname: 'asc' },
  })
}

export async function getActiveContractors() {
  await requireAuth()
  return prisma.contractor.findMany({
    where: { status: 'active' },
    select: { id: true, name: true, trade: true },
    orderBy: { name: 'asc' },
  })
}

export async function createMaintenanceTicket(data: {
  title: string
  description: string | null
  category: string
  priority: string
  property_id: string | null
  assigned_contractor_id: string | null
  estimated_cost: number | null
}) {
  await requireAuth()
  try {
    const ticket = await prisma.maintenanceTicket.create({
      data: {
        title: data.title,
        description: data.description,
        category: data.category,
        priority: data.priority,
        status: 'reported',
        property_id: data.property_id,
        assigned_contractor_id: data.assigned_contractor_id,
        estimated_cost: data.estimated_cost,
      },
    })
    revalidatePath('/maintenance')
    return { data: ticket, error: null }
  } catch (error: any) {
    return { data: null, error: { message: error.message } }
  }
}

export async function updateMaintenanceTicket(id: string, data: {
  status: string
  priority: string
  assigned_contractor_id: string | null
  estimated_cost: number | null
  actual_cost: number | null
  cost_approved: boolean | null
}) {
  await requireAuth()
  try {
    await prisma.maintenanceTicket.update({ where: { id }, data })
    revalidatePath('/maintenance')
    revalidatePath(`/maintenance/${id}`)
    return { error: null }
  } catch (error: any) {
    return { error: { message: error.message } }
  }
}
