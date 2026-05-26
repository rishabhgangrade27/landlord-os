// Minimal layout for the print/PDF route — no sidebar, no AppShell.
// Auth is still checked; unauthenticated users get redirected.
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

  return (
    <html lang="en">
      <body className="bg-white text-black font-sans antialiased">
        {children}
      </body>
    </html>
  )
}
