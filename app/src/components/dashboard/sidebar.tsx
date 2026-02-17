'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Building2,
  Receipt,
  Landmark,
  Calendar,
  Wrench,
  FileText,
  BarChart3,
  Settings,
} from 'lucide-react'
import type { User } from '@supabase/supabase-js'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from '@/components/ui/sidebar'
import { Badge } from '@/components/ui/badge'
import { SchemeSwitcher } from '@/components/dashboard/scheme-switcher'
import { UserNav } from '@/components/dashboard/user-nav'

interface SchemeOption {
  id: string
  scheme_name: string
  scheme_number: string
  status: string
}

interface AppSidebarProps {
  user: User
  organisation: { id: string; name: string } | null | undefined
  schemes: SchemeOption[]
}

const navItems = [
  {
    title: 'Dashboard',
    href: '/',
    icon: LayoutDashboard,
    exact: true,
  },
  {
    title: 'Schemes',
    href: '/schemes',
    icon: Building2,
  },
  {
    title: 'Levies',
    href: '/levies',
    icon: Receipt,
    disabled: true,
    badge: 'Soon',
  },
  {
    title: 'Trust Accounting',
    href: '/trust',
    icon: Landmark,
    disabled: true,
    badge: 'Soon',
  },
  {
    title: 'Meetings',
    href: '/meetings',
    icon: Calendar,
    disabled: true,
    badge: 'Soon',
  },
  {
    title: 'Maintenance',
    href: '/maintenance',
    icon: Wrench,
    disabled: true,
    badge: 'Soon',
  },
  {
    title: 'Documents',
    href: '/documents',
    icon: FileText,
    disabled: true,
    badge: 'Soon',
  },
  {
    title: 'Reports',
    href: '/reports',
    icon: BarChart3,
    disabled: true,
    badge: 'Soon',
  },
  {
    title: 'Settings',
    href: '/settings',
    icon: Settings,
  },
]

export function AppSidebar({ user, organisation, schemes }: AppSidebarProps) {
  const pathname = usePathname()

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
                  LL
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">LevyLite</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {organisation?.name ?? 'Strata Management'}
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarSeparator />
      <SidebarHeader>
        <SchemeSwitcher schemes={schemes} />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive = item.exact
                  ? pathname === item.href
                  : pathname.startsWith(item.href)

                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild={!item.disabled}
                      isActive={isActive}
                      tooltip={item.title}
                      disabled={item.disabled}
                    >
                      {item.disabled ? (
                        <span>
                          <item.icon className="size-4" />
                          <span>{item.title}</span>
                          {item.badge && (
                            <Badge variant="secondary" className="ml-auto text-[10px] px-1.5 py-0">
                              {item.badge}
                            </Badge>
                          )}
                        </span>
                      ) : (
                        <Link href={item.href}>
                          <item.icon className="size-4" />
                          <span>{item.title}</span>
                          {item.badge && (
                            <Badge variant="secondary" className="ml-auto text-[10px] px-1.5 py-0">
                              {item.badge}
                            </Badge>
                          )}
                        </Link>
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <UserNav user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
