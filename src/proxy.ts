import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { decrypt, SESSION_COOKIE } from '@/lib/session'

const PUBLIC_PATHS = ['/login']

// Cron-triggered routes have no browser session to send — they authenticate
// themselves with CRON_SECRET instead (see api/cron/*/route.ts). Exempting
// them here only skips the session-cookie check; each route still 401s on
// its own if the shared secret doesn't match.
const CRON_PATH_PREFIX = '/api/cron/'

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isPublicPath = PUBLIC_PATHS.includes(pathname)
  if (pathname.startsWith(CRON_PATH_PREFIX)) {
    return NextResponse.next()
  }

  const cookie = request.cookies.get(SESSION_COOKIE)?.value
  const session = await decrypt(cookie)
  const isAuthenticated = !!session?.authenticated

  if (!isPublicPath && !isAuthenticated) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (isPublicPath && isAuthenticated) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    // Run on everything except static assets and Next internals.
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
