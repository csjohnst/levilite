'use client'

import Link from 'next/link'
import { MoreHorizontal, Pencil, Trash2, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import { deleteLevySchedule } from '@/actions/levy-schedules'
import { useRouter } from 'next/navigation'

interface LevyScheduleActionsProps {
  schemeId: string
  scheduleId: string
}

export function LevyScheduleActions({ schemeId, scheduleId }: LevyScheduleActionsProps) {
  const router = useRouter()

  async function handleDelete() {
    if (!confirm('Are you sure you want to delete this levy schedule? This cannot be undone if no levy items have been generated.')) return
    const result = await deleteLevySchedule(scheduleId)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success('Levy schedule deleted')
      router.refresh()
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm">
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link href={`/schemes/${schemeId}/levies/${scheduleId}`}>
            <Eye className="mr-2 size-4" />
            View
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          variant="destructive"
          onClick={handleDelete}
        >
          <Trash2 className="mr-2 size-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
