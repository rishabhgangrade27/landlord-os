// Layout override for the print/PDF route.
// Does NOT add html/body (only root layout can do that in Next.js App Router).
// Sidebar is hidden via print:hidden CSS on AppShell.
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function PrintLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return <>{children}</>
}
