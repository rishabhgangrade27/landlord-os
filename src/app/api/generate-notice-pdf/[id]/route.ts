import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: noticeId } = await params
  
  // To be refactored in Phase 3: Word Document generation
  return NextResponse.json({ error: 'Word Document Generation coming soon.' }, { status: 501 })
}
