import { NextResponse } from 'next/server'
import { runDailyOverdueCheck } from '@/lib/overdue-check'

// Called by Windows Task Scheduler (or node-cron) once a day — NOT by a
// logged-in browser, so it can't use the session cookie. Protected by a
// shared secret instead. proxy.ts exempts this one path from the normal
// auth redirect so the request actually reaches this check.
export async function POST(request: Request) {
  const auth = request.headers.get('authorization')
  const expected = `Bearer ${process.env.CRON_SECRET}`

  if (!process.env.CRON_SECRET || auth !== expected) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  try {
    const result = await runDailyOverdueCheck()
    return NextResponse.json(result)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
