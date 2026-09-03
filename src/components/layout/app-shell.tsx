'use client'

import { useState } from 'react'
import { Sidebar } from './sidebar'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Menu, Building2 } from 'lucide-react'

export function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)

  return (
    // h-screen + overflow-hidden: page never scrolls as a whole.
    // The sidebar stays pinned; only <main> scrolls internally.
    <div className="flex h-screen overflow-hidden print:block print:h-auto print:overflow-visible">

      {/* Desktop sidebar — hidden when printing */}
      <div className="hidden lg:flex w-60 shrink-0 h-full print:hidden">
        <Sidebar />
      </div>

      {/* Mobile sidebar — hidden when printing */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="p-0 w-60 print:hidden" showCloseButton={false}>
          <Sidebar />
        </SheetContent>
      </Sheet>

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden print:overflow-visible print:block">

        {/* Mobile top bar — hidden when printing */}
        <header className="lg:hidden shrink-0 sticky top-0 z-30 flex items-center gap-3 px-4 h-14 border-b bg-background print:hidden">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-7 h-7 rounded-md bg-primary text-primary-foreground">
              <Building2 className="w-3.5 h-3.5" />
            </div>
            <span className="font-semibold text-sm">LandlordOS</span>
          </div>
        </header>

        {/* Page content — this is the only scrolling region */}
        <main className="flex-1 overflow-y-auto bg-background print:overflow-visible print:h-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
