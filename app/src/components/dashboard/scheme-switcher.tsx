'use client'

import { useState } from 'react'
import { ChevronsUpDown, Check, Building2 } from 'lucide-react'
import { useCurrentScheme } from '@/hooks/use-current-scheme'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'

interface SchemeOption {
  id: string
  scheme_name: string
  scheme_number: string
  status: string
}

export function SchemeSwitcher({ schemes }: { schemes: SchemeOption[] }) {
  const [open, setOpen] = useState(false)
  const { schemeId, setSchemeId } = useCurrentScheme()
  const { isMobile } = useSidebar()

  const activeScheme = schemes.find((s) => s.id === schemeId)

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Building2 className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">
                  {activeScheme ? activeScheme.scheme_name : 'All Schemes'}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {activeScheme ? activeScheme.scheme_number : `${schemes.length} scheme${schemes.length !== 1 ? 's' : ''}`}
                </span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </PopoverTrigger>
          <PopoverContent
            className="w-[--radix-popover-trigger-width] min-w-56 rounded-lg p-0"
            align="start"
            side={isMobile ? 'bottom' : 'right'}
            sideOffset={4}
          >
            <Command>
              <CommandInput placeholder="Search schemes..." />
              <CommandList>
                <CommandEmpty>No schemes found.</CommandEmpty>
                <CommandGroup>
                  <CommandItem
                    onSelect={() => {
                      setSchemeId(null)
                      setOpen(false)
                    }}
                  >
                    <Building2 className="mr-2 size-4" />
                    <span>All Schemes</span>
                    {!schemeId && <Check className="ml-auto size-4" />}
                  </CommandItem>
                  {schemes.map((scheme) => (
                    <CommandItem
                      key={scheme.id}
                      value={`${scheme.scheme_name} ${scheme.scheme_number}`}
                      onSelect={() => {
                        setSchemeId(scheme.id)
                        setOpen(false)
                      }}
                    >
                      <Building2 className="mr-2 size-4" />
                      <div className="grid flex-1 text-sm leading-tight">
                        <span className="truncate">{scheme.scheme_name}</span>
                        <span className="truncate text-xs text-muted-foreground">
                          {scheme.scheme_number}
                        </span>
                      </div>
                      {schemeId === scheme.id && (
                        <Check className="ml-auto size-4" />
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
