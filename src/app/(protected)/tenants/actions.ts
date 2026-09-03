'use server'

import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { requireAuth } from '@/lib/dal'

export async function createTenant(data: {
  name: string
  full_legal_name: string | null
  case_number: string | null
  email: string | null
  phone: string | null
  address: string | null
  household_size: number | null
  ssn_encrypted: string | null
  state_id: string | null
  notes: string | null
  status: string
}) {
  await requireAuth()
  try {
    const tenant = await prisma.tenant.create({
      data: {
        name: data.name,
        full_legal_name: data.full_legal_name,
        case_number: data.case_number,
        email: data.email,
        phone: data.phone,
        address: data.address,
        household_size: data.household_size,
        ssn_encrypted: data.ssn_encrypted,
        state_id: data.state_id,
        notes: data.notes,
        status: data.status,
      }
    })
    revalidatePath('/tenants')
    return { data: tenant, error: null }
  } catch (error: any) {
    return { data: null, error: { message: error.message } }
  }
}

export async function updateTenant(id: string, data: {
  name: string
  full_legal_name: string | null
  case_number: string | null
  email: string | null
  phone: string | null
  address: string | null
  // Sensitive fields are omitted (undefined) whenever the caller wants to
  // leave the existing value untouched — the edit form never gets the real
  // value to begin with, so "no change" has to mean "field wasn't sent"
  // rather than "field was sent as null/empty".
  ssn_encrypted?: string | null
  state_id?: string | null
  notes: string | null
  status: string
}) {
  await requireAuth()
  try {
    const tenant = await prisma.tenant.update({
      where: { id },
      data: {
        name: data.name,
        full_legal_name: data.full_legal_name,
        case_number: data.case_number,
        email: data.email,
        phone: data.phone,
        address: data.address,
        ...(data.ssn_encrypted !== undefined ? { ssn_encrypted: data.ssn_encrypted } : {}),
        ...(data.state_id !== undefined ? { state_id: data.state_id } : {}),
        notes: data.notes,
        status: data.status,
      }
    })
    revalidatePath('/tenants')
    revalidatePath(`/tenants/${id}`)
    return { data: tenant, error: null }
  } catch (error: any) {
    return { data: null, error: { message: error.message } }
  }
}

// Returns a sensitive field's real value only on an explicit, authenticated
// request — never embedded in a page's initial server-render payload.
export async function revealSensitiveField(id: string, field: 'ssn_encrypted' | 'state_id') {
  await requireAuth()
  const tenant = await prisma.tenant.findUnique({
    where: { id },
    select: { ssn_encrypted: true, state_id: true },
  })
  if (!tenant) return { data: null, error: { message: 'Tenant not found' } }
  return { data: tenant[field], error: null }
}
