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
    <div className="flex h-screen overflow-hidden">

      {/* Desktop sidebar — full height, never scrolls away */}
      <div className="hidden lg:flex w-60 shrink-0 h-full">
        <Sidebar />
      </div>

      {/* Mobile sidebar — Sheet drawer.
          w-60 matches the sidebar's own width exactly → no white bleed. */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="p-0 w-60" showCloseButton={false}>
          <Sidebar />
        </SheetContent>
      </Sheet>

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Mobile top bar */}
        <header className="lg:hidden shrink-0 sticky top-0 z-30 flex items-center gap-3 px-4 h-14 border-b bg-background">
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
        <main className="flex-1 overflow-y-auto bg-background">
          {children}
        </main>
      </div>
    </div>
  )
}
