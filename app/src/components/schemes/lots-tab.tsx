'use client'

import Link from 'next/link'
import { Plus, Upload, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import { deleteLot } from '@/actions/lots'
import { useRouter } from 'next/navigation'

interface LotsTabProps {
  schemeId: string
  lots: Array<{
    id: string
    lot_number: string
    unit_number: string | null
    lot_type: string
    unit_entitlement: number
    occupancy_status: string
    lot_ownerships: Array<{
      owners: {
        id: string
        first_name: string
        last_name: string
        email: string | null
      } | null
    }> | null
  }>
}

const LOT_TYPE_LABELS: Record<string, string> = {
  residential: 'Residential',
  commercial: 'Commercial',
  parking: 'Parking',
  storage: 'Storage',
  'common-property': 'Common Property',
  other: 'Other',
}

const OCCUPANCY_LABELS: Record<string, string> = {
  'owner-occupied': 'Owner Occupied',
  tenanted: 'Tenanted',
  vacant: 'Vacant',
  'common-property': 'Common Property',
  unknown: 'Unknown',
}

export function LotsTab({ schemeId, lots }: LotsTabProps) {
  const router = useRouter()

  async function handleDelete(lotId: string) {
    if (!confirm('Are you sure you want to delete this lot?')) return
    const result = await deleteLot(lotId)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success('Lot deleted')
      router.refresh()
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Button asChild>
          <Link href={`/schemes/${schemeId}/lots/new`}>
            <Plus className="mr-2 size-4" />
            Add Lot
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href={`/schemes/${schemeId}/lots/import`}>
            <Upload className="mr-2 size-4" />
            Import CSV
          </Link>
        </Button>
      </div>

      {lots.length > 0 ? (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lot #</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Entitlement</TableHead>
                <TableHead>Owner(s)</TableHead>
                <TableHead>Occupancy</TableHead>
                <TableHead className="w-[50px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {lots.map((lot) => {
                const owners = lot.lot_ownerships
                  ?.map(o => o.owners)
                  .filter(Boolean) ?? []
                return (
                  <TableRow key={lot.id}>
                    <TableCell className="font-medium">{lot.lot_number}</TableCell>
                    <TableCell>{lot.unit_number || '-'}</TableCell>
                    <TableCell>{LOT_TYPE_LABELS[lot.lot_type] ?? lot.lot_type}</TableCell>
                    <TableCell className="text-right">{lot.unit_entitlement}</TableCell>
                    <TableCell>
                      {owners.length > 0
                        ? owners.map(o => `${o!.first_name} ${o!.last_name}`).join(', ')
                        : <span className="text-muted-foreground">Unassigned</span>
                      }
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {OCCUPANCY_LABELS[lot.occupancy_status] ?? lot.occupancy_status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/schemes/${schemeId}/lots/${lot.id}/edit`}>
                              <Pencil className="mr-2 size-4" />
                              Edit
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => handleDelete(lot.id)}
                          >
                            <Trash2 className="mr-2 size-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
          <h3 className="text-lg font-medium">No lots yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Add lots individually or import from CSV.
          </p>
        </div>
      )}
    </div>
  )
}
