import { NextResponse } from 'next/server'
import { createBackup, pruneDailyBackups } from '@/lib/backup'

// Called by Windows Task Scheduler once a day — same CRON_SECRET pattern as
// /api/cron/daily-overdue (see that route for why: no browser session to
// send, proxy.ts exempts the /api/cron/ prefix from the normal auth check).
export async function POST(request: Request) {
  const auth = request.headers.get('authorization')
  const expected = `Bearer ${process.env.CRON_SECRET}`

  if (!process.env.CRON_SECRET || auth !== expected) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const result = await createBackup('daily')
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  const pruned = await pruneDailyBackups()
  return NextResponse.json({ filename: result.filename, prunedOldSnapshots: pruned })
}
