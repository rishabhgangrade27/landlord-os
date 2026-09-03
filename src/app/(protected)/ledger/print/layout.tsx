// Layout override for the print/PDF route.
// Does NOT add html/body (only root layout can do that in Next.js App Router).
// Sidebar is hidden via print:hidden CSS on AppShell.

export default function PrintLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
