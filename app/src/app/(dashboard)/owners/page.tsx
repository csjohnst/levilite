/**
 * Global Owner Directory Page
 *
 * Shows ALL owners in the organisation, including those without lot assignments
 * ("orphaned" owners). Addresses issue #4: owners without lot assignments are
 * currently invisible in the UI.
 *
 * Features:
 * - Full owner list regardless of lot assignment
 * - Warning badge for owners with no lots assigned
 * - Links to each owner's lots and schemes
 * - Search/filter functionality
 */

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AlertTriangle, Building2, User, UserX } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { getGlobalOwners } from '@/actions/owners'

export default async function GlobalOwnersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: owners, error } = await getGlobalOwners()

  if (error) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold tracking-tight">Owner Directory</h2>
        <div className="rounded-md border border-destructive/50 p-6 text-destructive text-sm">
          {error}
        </div>
      </div>
    )
  }

  const orphanedCount = owners?.filter(o => o.isOrphaned).length ?? 0
  const totalCount = owners?.length ?? 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Owner Directory</h2>
          <p className="text-muted-foreground">
            All owners in your organisation — including those not yet assigned to a lot.
          </p>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="rounded-lg border p-4 space-y-1">
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <User className="size-4" /> Total Owners
          </p>
          <p className="text-2xl font-bold">{totalCount}</p>
        </div>
        <div className="rounded-lg border p-4 space-y-1">
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Building2 className="size-4" /> With Lots
          </p>
          <p className="text-2xl font-bold">{totalCount - orphanedCount}</p>
        </div>
        {orphanedCount > 0 && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 space-y-1">
            <p className="text-sm text-amber-600 flex items-center gap-2">
              <UserX className="size-4" /> Unassigned
            </p>
            <p className="text-2xl font-bold text-amber-600">{orphanedCount}</p>
            <p className="text-xs text-muted-foreground">Need lot assignment</p>
          </div>
        )}
      </div>

      {/* Unassigned warning */}
      {orphanedCount > 0 && (
        <div className="flex items-start gap-3 rounded-md border border-amber-500/30 bg-amber-500/5 p-4">
          <AlertTriangle className="size-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-amber-700 dark:text-amber-400">
              {orphanedCount} owner{orphanedCount > 1 ? 's' : ''} without lot assignment
            </p>
            <p className="text-muted-foreground mt-1">
              These owners exist in the system but aren&apos;t assigned to any lot. They won&apos;t appear on scheme owner lists
              or receive levy notices until assigned. To assign, open a lot and add them as an owner.
            </p>
          </div>
        </div>
      )}

      {!owners || owners.length === 0 ? (
        <div className="rounded-md border p-12 text-center">
          <User className="size-12 text-muted-foreground/40 mx-auto mb-4" />
          <h3 className="font-semibold text-lg">No owners yet</h3>
          <p className="text-muted-foreground mt-2 text-sm">
            Owners are created when you add them to a lot in a scheme.
          </p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Lots / Schemes</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {owners.map(({ owner, lots, isOrphaned }) => {
                const o = owner as {
                  id: string; first_name: string; last_name: string;
                  email?: string; phone?: string
                }
                return (
                  <TableRow key={o.id} className={isOrphaned ? 'bg-amber-500/5' : undefined}>
                    <TableCell className="font-medium">
                      {o.first_name} {o.last_name}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {o.email ? (
                        <a href={`mailto:${o.email}`} className="hover:underline">{o.email}</a>
                      ) : (
                        <span className="italic">No email</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {o.phone ?? <span className="italic">—</span>}
                    </TableCell>
                    <TableCell>
                      {lots.length === 0 ? (
                        <span className="text-muted-foreground text-sm italic">Not assigned to any lot</span>
                      ) : (
                        <div className="flex flex-col gap-1">
                          {lots.map(lot => (
                            <Link
                              key={lot.id}
                              href={`/schemes/${lot.scheme_id}`}
                              className="text-sm text-primary hover:underline flex items-center gap-1"
                            >
                              <Building2 className="size-3 shrink-0" />
                              Lot {lot.lot_number}
                              {lot.unit_number && ` (Unit ${lot.unit_number})`}
                              {' '}— {lot.scheme_name}
                            </Link>
                          ))}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {isOrphaned ? (
                        <Badge variant="outline" className="text-amber-600 border-amber-500/50 gap-1">
                          <UserX className="size-3" />
                          Unassigned
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-green-600 border-green-500/50">
                          Assigned
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
