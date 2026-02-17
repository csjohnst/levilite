import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Plus, MoreHorizontal, Pencil, Archive } from 'lucide-react'
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
import { deleteScheme } from '@/actions/schemes'

export default async function SchemesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: orgUser } = await supabase
    .from('organisation_users')
    .select('organisation_id')
    .eq('user_id', user.id)
    .single()

  const { data: schemes } = await supabase
    .from('schemes')
    .select('*, lots(count)')
    .eq('organisation_id', orgUser?.organisation_id)
    .neq('status', 'archived')
    .order('scheme_name')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Schemes</h2>
          <p className="text-muted-foreground">
            Manage your strata schemes
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/schemes/new">
            <Plus className="mr-2 size-4" />
            Add Scheme
          </Link>
        </Button>
      </div>

      {schemes && schemes.length > 0 ? (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Scheme Number</TableHead>
                <TableHead>Scheme Name</TableHead>
                <TableHead>Suburb</TableHead>
                <TableHead className="text-center">Lots</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[50px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {schemes.map((scheme) => {
                const lotCount = (scheme.lots as { count: number }[])?.[0]?.count ?? 0
                return (
                  <TableRow key={scheme.id}>
                    <TableCell>
                      <Link
                        href={`/dashboard/schemes/${scheme.id}`}
                        className="font-medium hover:underline"
                      >
                        {scheme.scheme_number}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/dashboard/schemes/${scheme.id}`}
                        className="hover:underline"
                      >
                        {scheme.scheme_name}
                      </Link>
                    </TableCell>
                    <TableCell>{scheme.suburb}</TableCell>
                    <TableCell className="text-center">{lotCount}</TableCell>
                    <TableCell>
                      <Badge
                        variant={scheme.status === 'active' ? 'secondary' : 'outline'}
                        className={
                          scheme.status === 'active'
                            ? 'bg-green-100 text-green-800'
                            : ''
                        }
                      >
                        {scheme.status}
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
                            <Link href={`/dashboard/schemes/${scheme.id}/edit`}>
                              <Pencil className="mr-2 size-4" />
                              Edit
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <form action={async () => {
                              'use server'
                              await deleteScheme(scheme.id)
                            }}>
                              <button type="submit" className="flex w-full items-center">
                                <Archive className="mr-2 size-4" />
                                Archive
                              </button>
                            </form>
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
          <h3 className="text-lg font-medium">No schemes yet</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Get started by adding your first strata scheme.
          </p>
          <Button asChild className="mt-4">
            <Link href="/dashboard/schemes/new">
              <Plus className="mr-2 size-4" />
              Add Scheme
            </Link>
          </Button>
        </div>
      )}
    </div>
  )
}
