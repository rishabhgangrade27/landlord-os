'use server'

import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/dal'
import { mkdir, writeFile } from 'fs/promises'
import path from 'path'

const STORAGE_ROOT = path.join(process.cwd(), 'storage')

export async function uploadReceiptFile(formData: FormData) {
  await requireAuth()
  try {
    const file = formData.get('file') as File
    const relativePath = formData.get('path') as string

    if (!file || !relativePath) {
      return { error: 'File or path missing' }
    }

    // Defense in depth: the client already sanitizes the filename, but never
    // trust it — reject anything that could escape the storage directory.
    if (relativePath.includes('..') || path.isAbsolute(relativePath) || !relativePath.startsWith('receipts/')) {
      return { error: 'Invalid file path' }
    }

    const destPath = path.join(STORAGE_ROOT, relativePath)
    if (!destPath.startsWith(STORAGE_ROOT)) {
      return { error: 'Invalid file path' }
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    await mkdir(path.dirname(destPath), { recursive: true })
    await writeFile(destPath, buffer)

    await prisma.transaction.create({
      data: {
        status: 'uploaded',
        source_pdf_url: `/api/receipts/${relativePath}`,
        file_bucket: 'local',
        file_path: relativePath,
        created_by: 'system',
      }
    })

    return { success: true, path: relativePath }
  } catch (error: any) {
    return { error: error.message || 'Unknown error occurred' }
  }
}
