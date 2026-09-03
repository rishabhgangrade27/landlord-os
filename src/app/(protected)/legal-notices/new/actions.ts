'use server'

import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/dal'

export async function getActiveTenants() {
  await requireAuth()
  return prisma.tenant.findMany({
    where: { status: 'active' },
    select: { id: true, name: true, case_number: true },
    orderBy: { name: 'asc' }
  })
}
