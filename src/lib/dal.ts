import 'server-only'
import { cache } from 'react'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { decrypt, SESSION_COOKIE } from '@/lib/session'

// For Server Components / pages — redirects to /login if there's no valid session.
export const verifySession = cache(async () => {
  const cookie = (await cookies()).get(SESSION_COOKIE)?.value
  const session = await decrypt(cookie)

  if (!session?.authenticated) {
    redirect('/login')
  }

  return { isAuth: true as const }
})

// For Server Actions / Route Handlers — does NOT redirect (can't redirect mid-mutation
// the same way), just tells the caller whether the request is authenticated so it can
// return an error instead of silently mutating data.
export async function requireAuth() {
  const cookie = (await cookies()).get(SESSION_COOKIE)?.value
  const session = await decrypt(cookie)

  if (!session?.authenticated) {
    throw new Error('Not authenticated')
  }
}
