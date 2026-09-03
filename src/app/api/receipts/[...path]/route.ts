import { NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import path from 'path'
import { requireAuth } from '@/lib/dal'

const STORAGE_ROOT = path.join(process.cwd(), 'storage')

const CONTENT_TYPES: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    await requireAuth()
  } catch {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { path: segments } = await params
  const relativePath = segments.join('/')

  // Defense in depth: reject anything that could escape the storage directory,
  // even though the segments come from Next's own route matching.
  if (relativePath.includes('..')) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
  }

  const filePath = path.join(STORAGE_ROOT, relativePath)
  if (!filePath.startsWith(STORAGE_ROOT)) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
  }

  try {
    const file = await readFile(filePath)
    const ext = path.extname(filePath).toLowerCase()
    return new NextResponse(new Uint8Array(file), {
      headers: {
        'Content-Type': CONTENT_TYPES[ext] || 'application/octet-stream',
        'Content-Disposition': `inline; filename="${path.basename(filePath)}"`,
      },
    })
  } catch {
    return NextResponse.json({ error: 'File not found' }, { status: 404 })
  }
}
