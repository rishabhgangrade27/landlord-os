'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import {
  Building2,
  LayoutDashboard,
  Users,
  FileText,
  BookOpen,
  Upload,
  Receipt,
  Wrench,
  HardHat,
  Scale,
  BarChart3,
  Settings,
  LogOut,
  ChevronDown,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Separator } from '@/components/ui/separator'

const navGroups = [
  {
    label: 'Overview',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    ],
  },
  {
    label: 'Properties',
    items: [
      { href: '/properties', label: 'Properties', icon: Building2 },
    ],
  },
  {
    label: 'People',
    items: [
      { href: '/tenants', label: 'Tenants', icon: Users },
      { href: '/leases', label: 'Leases', icon: FileText },
    ],
  },
  {
    label: 'Financials',
    items: [
      { href: '/ledger', label: 'Rent Ledger', icon: BookOpen },
      { href: '/upload', label: 'Upload Receipts', icon: Upload },
      { href: '/transactions', label: 'Transactions', icon: Receipt },
    ],
  },
  {
    label: 'Operations',
    items: [
      { href: '/maintenance', label: 'Maintenance', icon: Wrench },
      { href: '/contractors', label: 'Contractors', icon: HardHat },
    ],
  },
  {
    label: 'Legal',
    items: [
      { href: '/legal-notices', label: 'Legal Notices', icon: Scale },
    ],
  },
  {
    label: 'Reports',
    items: [
      { href: '/reports', label: 'Reports', icon: BarChart3 },
      { href: '/settings', label: 'Settings', icon: Settings },
    ],
  },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  function isActive(href: string) {
    if (href === '/dashboard') return pathname === '/dashboard'
    return pathname.startsWith(href)
  }

  return (
    <aside className="w-60 min-h-screen flex flex-col bg-sidebar border-r border-sidebar-border">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-4 border-b border-sidebar-border">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary text-primary-foreground shrink-0">
          <Building2 className="w-4 h-4" />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-semibold leading-none">LandlordOS</span>
          <span className="text-xs text-muted-foreground leading-none mt-1">Sonu Gupta</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        {navGroups.map((group, gi) => (
          <div key={group.label} className={cn('mb-1', gi > 0 && 'mt-3')}>
            <p className="px-2 mb-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {group.label}
            </p>
            {group.items.map((item) => {
              const Icon = item.icon
              const active = isActive(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-2.5 px-2 py-2 rounded-md text-sm font-medium transition-colors',
                    active
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                      : 'text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground'
                  )}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {item.label}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-sidebar-border p-2">
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 w-full px-2 py-2 rounded-md text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground transition-colors">
            <div className="flex items-center justify-center w-7 h-7 rounded-full bg-primary text-primary-foreground text-xs font-bold shrink-0">
              S
            </div>
            <span className="flex-1 text-left truncate">Sonu Gupta</span>
            <ChevronDown className="w-3.5 h-3.5 shrink-0" />
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-52">
            <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
              <LogOut className="w-4 h-4 mr-2" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  )
}
