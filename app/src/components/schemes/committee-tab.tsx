'use client'

import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { addCommitteeMember, removeCommitteeMember } from '@/actions/committee'
import { useRouter } from 'next/navigation'

interface CommitteeTabProps {
  schemeId: string
  members: Array<{
    id: string
    position: string
    elected_at: string
    term_end_date: string | null
    owners: {
      id: string
      first_name: string
      last_name: string
      email: string | null
      phone_mobile: string | null
    } | null
  }>
  owners: Array<{
    owner: Record<string, unknown>
    lots: Array<{ lot_number: string; unit_number: string | null }>
  }>
}

const POSITIONS = [
  { value: 'chair', label: 'Chair' },
  { value: 'treasurer', label: 'Treasurer' },
  { value: 'secretary', label: 'Secretary' },
  { value: 'member', label: 'Member' },
] as const

const POSITION_LABELS: Record<string, string> = {
  chair: 'Chair',
  treasurer: 'Treasurer',
  secretary: 'Secretary',
  member: 'Member',
}

export function CommitteeTab({ schemeId, members, owners }: CommitteeTabProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [selectedOwner, setSelectedOwner] = useState('')
  const [position, setPosition] = useState('member')
  const [electedAt, setElectedAt] = useState('')
  const [termEndDate, setTermEndDate] = useState('')

  // Filter out owners already on committee
  const memberOwnerIds = new Set(members.map(m => m.owners?.id).filter(Boolean))
  const availableOwners = owners.filter(o => !memberOwnerIds.has(o.owner.id as string))

  async function handleAdd() {
    if (!selectedOwner || !position || !electedAt) {
      toast.error('Please fill in all required fields')
      return
    }
    setLoading(true)
    const result = await addCommitteeMember(
      schemeId,
      selectedOwner,
      position as 'chair' | 'treasurer' | 'secretary' | 'member',
      electedAt,
      termEndDate || null
    )
    setLoading(false)
    if (result.error) {
      toast.error(result.error)
      return
    }
    toast.success('Committee member added')
    setOpen(false)
    setSelectedOwner('')
    setPosition('member')
    setElectedAt('')
    setTermEndDate('')
    router.refresh()
  }

  async function handleRemove(memberId: string) {
    if (!confirm('Remove this committee member?')) return
    const result = await removeCommitteeMember(memberId)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success('Committee member removed')
      router.refresh()
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 size-4" />
              Add Committee Member
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Committee Member</DialogTitle>
              <DialogDescription>
                Select an owner to add to the committee.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Owner</Label>
                <Select value={selectedOwner} onValueChange={setSelectedOwner}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select an owner" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableOwners.length === 0 ? (
                      <SelectItem value="_none" disabled>
                        No available owners
                      </SelectItem>
                    ) : (
                      availableOwners.map(({ owner }) => (
                        <SelectItem key={owner.id as string} value={owner.id as string}>
                          {owner.first_name as string} {owner.last_name as string}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Position</Label>
                <Select value={position} onValueChange={setPosition}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {POSITIONS.map(p => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Elected Date</Label>
                <Input
                  type="date"
                  value={electedAt}
                  onChange={(e) => setElectedAt(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Term End Date (optional)</Label>
                <Input
                  type="date"
                  value={termEndDate}
                  onChange={(e) => setTermEndDate(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAdd} disabled={loading}>
                {loading ? 'Adding...' : 'Add Member'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {members.length > 0 ? (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Position</TableHead>
                <TableHead>Elected</TableHead>
                <TableHead>Term End</TableHead>
                <TableHead className="w-[50px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member) => (
                <TableRow key={member.id}>
                  <TableCell className="font-medium">
                    {member.owners
                      ? `${member.owners.first_name} ${member.owners.last_name}`
                      : 'Unknown'
                    }
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {POSITION_LABELS[member.position] ?? member.position}
                    </Badge>
                  </TableCell>
                  <TableCell>{member.elected_at}</TableCell>
                  <TableCell>{member.term_end_date || '-'}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemove(member.id)}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
          <h3 className="text-lg font-medium">No committee members</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Add owners as committee members.
          </p>
        </div>
      )}
    </div>
  )
}
