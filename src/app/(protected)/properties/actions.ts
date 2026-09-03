'use server'

import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { requireAuth } from '@/lib/dal'

export async function createProperty(data: {
  name: string
  address: string
  city: string | null
  state: string | null
  zip: string | null
  property_type: string
}) {
  await requireAuth()
  try {
    const property = await prisma.property.create({
      data: {
        name: data.name,
        address: data.address,
        city: data.city,
        state: data.state,
        zip: data.zip,
        property_type: data.property_type,
        status: 'Vacant',
      },
    })
    revalidatePath('/properties')
    return { data: property, error: null }
  } catch (error: any) {
    return { data: null, error: { message: error.message } }
  }
}

export async function updateProperty(id: string, data: {
  name: string | null
  nickname: string | null
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
  property_type: string
}) {
  await requireAuth()
  try {
    const property = await prisma.property.update({
      where: { id },
      data,
    })
    revalidatePath('/properties')
    revalidatePath(`/properties/${id}`)
    return { data: property, error: null }
  } catch (error: any) {
    return { data: null, error: { message: error.message } }
  }
}

export async function updatePropertyStatus(id: string, status: string) {
  await requireAuth()
  try {
    const property = await prisma.property.update({
      where: { id },
      data: { status },
    })
    revalidatePath('/properties')
    revalidatePath(`/properties/${id}`)
    return { data: property, error: null }
  } catch (error: any) {
    return { data: null, error: { message: error.message } }
  }
}

export async function updateUnit(id: string, data: {
  unit_number: string
  floor: number | null
  bedrooms: number | null
  bathrooms: number | null
  notes: string | null
  status: string
}) {
  await requireAuth()
  try {
    const unit = await prisma.unit.update({
      where: { id },
      data,
    })
    revalidatePath('/units')
    revalidatePath(`/units/${id}`)
    return { data: unit, error: null }
  } catch (error: any) {
    return { data: null, error: { message: error.message } }
  }
}

export async function createUnit(data: {
  property_id: string
  unit_number: string
  floor: number | null
  bedrooms: number | null
  bathrooms: number | null
  notes: string | null
}) {
  await requireAuth()
  try {
    const unit = await prisma.unit.create({
      data: {
        property_id: data.property_id,
        unit_number: data.unit_number,
        floor: data.floor,
        bedrooms: data.bedrooms,
        bathrooms: data.bathrooms,
        notes: data.notes,
        status: 'vacant',
      },
    })
    revalidatePath('/properties')
    revalidatePath(`/properties/${data.property_id}`)
    return { data: unit, error: null }
  } catch (error: any) {
    return { data: null, error: { message: error.message } }
  }
}
