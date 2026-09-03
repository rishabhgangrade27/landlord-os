'use server'

import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/dal'
import { revalidatePath } from 'next/cache'

export async function getTenantOptions() {
  await requireAuth()
  return prisma.tenant.findMany({
    where: { deleted_at: null },
    select: { id: true, name: true, case_number: true, status: true },
    orderBy: { name: 'asc' },
  })
}

export async function getPropertyOptions() {
  await requireAuth()
  return prisma.property.findMany({
    where: { status: { notIn: ['Retired', 'Sold'] } },
    select: { id: true, name: true, nickname: true, address: true, status: true },
    orderBy: { nickname: 'asc' },
  })
}

export async function checkActiveLeaseForProperty(propertyId: string) {
  await requireAuth()
  if (!propertyId) return null
  const lease = await prisma.lease.findFirst({
    where: { property_id: propertyId, status: 'active' },
    select: {
      start_date: true,
      rent_amount: true,
      tenant: { select: { name: true } },
    },
  })
  if (!lease) return null
  return {
    tenant_name: lease.tenant?.name ?? 'Unknown tenant',
    start_date: lease.start_date,
    rent_amount: lease.rent_amount,
  }
}

export async function createLease(data: {
  tenant_id: string
  property_id: string
  start_date: string
  end_date: string | null
  rent_amount: number
  status: string
  notes: string | null
}) {
  await requireAuth()
  try {
    const lease = await prisma.lease.create({
      data: {
        tenant_id: data.tenant_id,
        property_id: data.property_id,
        // Properties serve as units in this system (no separate units table
        // with real data) — same UUID on both fields is intentional.
        unit_id: null,
        start_date: new Date(data.start_date),
        end_date: data.end_date ? new Date(data.end_date) : null,
        rent_amount: data.rent_amount,
        status: data.status,
        notes: data.notes,
      },
    })

    await prisma.property.update({
      where: { id: data.property_id },
      data: { status: 'Occupied' },
    })

    await prisma.tenant.update({
      where: { id: data.tenant_id },
      data: { status: 'active' },
    })

    revalidatePath('/leases')
    revalidatePath('/properties')
    revalidatePath(`/tenants/${data.tenant_id}`)
    return { data: lease, error: null }
  } catch (error: any) {
    return { data: null, error: { message: error.message } }
  }
}

export async function updateLease(id: string, data: {
  property_id: string | null
  start_date: string
  end_date: string | null
  rent_amount: number
  status: string
  notes: string | null
}) {
  await requireAuth()
  try {
    await prisma.lease.update({
      where: { id },
      data: {
        property_id: data.property_id,
        start_date: new Date(data.start_date),
        end_date: data.end_date ? new Date(data.end_date) : null,
        rent_amount: data.rent_amount,
        status: data.status,
        notes: data.notes,
      },
    })
    revalidatePath('/leases')
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}
