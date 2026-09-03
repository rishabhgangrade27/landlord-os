import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function POST(request: Request): Promise<NextResponse> {
  // To be refactored in Phase 3
  return NextResponse.json({ error: 'PDF Generation coming soon.' }, { status: 501 })
}
