'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { toast } from 'sonner'
import { getLotsForOpeningBalances, applyOpeningBalances, clearOpeningBalances, type OpeningBalanceEntry } from '@/actions/opening-balances'
import { Loader2, AlertCircle } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface LotData {
  id: string
  lot_number: string
  unit_number: string | null
  unit_entitlement: number
  total_annual_levy: number
  amount_paid: number
  balance: number
  existing_opening_balance: number
  has_opening_balance: boolean
  lot_ownerships: Array<{
    owners: {
      id: string
      first_name: string
      last_name: string
    } | null
  }> | null
}

function formatCurrency(amount: number): string {
  return '$' + amount.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function OpeningBalanceForm({ schemeId }: { schemeId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [lots, setLots] = useState<LotData[]>([])
  const [balances, setBalances] = useState<Record<string, string>>({})
  const [openingDate, setOpeningDate] = useState(new Date().toISOString().split('T')[0])

  useEffect(() => {
    loadLots()
  }, [])

  async function loadLots() {
    setLoading(true)
    const result = await getLotsForOpeningBalances(schemeId)
    if (result.error) {
      toast.error(result.error)
    } else if (result.data) {
      setLots(result.data as LotData[])
      // Pre-populate existing opening balances
      const initialBalances: Record<string, string> = {}
      result.data.forEach((lot: LotData) => {
        if (lot.existing_opening_balance > 0) {
          initialBalances[lot.id] = lot.existing_opening_balance.toString()
        }
      })
      setBalances(initialBalances)
    }
    setLoading(false)
  }

  function handleBalanceChange(lotId: string, value: string) {
    setBalances(prev => ({
      ...prev,
      [lotId]: value,
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    try {
      // Build opening balance entries
      const entries: OpeningBalanceEntry[] = []
      Object.entries(balances).forEach(([lotId, value]) => {
        const amount = parseFloat(value)
        if (!isNaN(amount) && amount > 0) {
          entries.push({ lot_id: lotId, amount })
        }
      })

      if (entries.length === 0) {
        toast.error('Please enter at least one opening balance')
        setSaving(false)
        return
      }

      const result = await applyOpeningBalances({
        scheme_id: schemeId,
        balances: entries,
        opening_balance_date: openingDate,
      })

      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(result.data?.message || 'Opening balances applied successfully')
        router.refresh()
        loadLots()
      }
    } catch (error) {
      toast.error('Failed to apply opening balances')
    } finally {
      setSaving(false)
    }
  }

  async function handleClear() {
    if (!confirm('Are you sure you want to clear all opening balances? This will delete all opening balance payment records.')) {
      return
    }

    setClearing(true)
    try {
      const result = await clearOpeningBalances(schemeId)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Opening balances cleared successfully')
        setBalances({})
        router.refresh()
        loadLots()
      }
    } catch (error) {
      toast.error('Failed to clear opening balances')
    } finally {
      setClearing(false)
    }
  }

  const totalOpeningBalance = Object.values(balances).reduce((sum, val) => {
    const num = parseFloat(val)
    return sum + (isNaN(num) ? 0 : num)
  }, 0)

  const hasAnyOpeningBalances = lots.some(lot => lot.has_opening_balance)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (lots.length === 0) {
    return (
      <Alert>
        <AlertCircle className="size-4" />
        <AlertDescription>
          No active lots found for this scheme. Please add lots before setting opening balances.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Opening Balance Settings</CardTitle>
          <CardDescription>
            Enter the amount already paid by each lot at the time of onboarding. These amounts will be allocated to outstanding levy items using FIFO.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="max-w-xs space-y-2">
            <Label htmlFor="opening-date">Opening Balance Date</Label>
            <Input
              id="opening-date"
              type="date"
              value={openingDate}
              onChange={(e) => setOpeningDate(e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">
              The date to record these opening balance payments (typically the scheme acquisition date or start of the financial year).
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Lot Opening Balances</CardTitle>
              <CardDescription>
                {lots.length} active lot{lots.length !== 1 ? 's' : ''} | Total: {formatCurrency(totalOpeningBalance)}
              </CardDescription>
            </div>
            {hasAnyOpeningBalances && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleClear}
                disabled={clearing}
              >
                {clearing && <Loader2 className="mr-2 size-4 animate-spin" />}
                Clear All
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lot</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead className="text-right">Total Annual Levy</TableHead>
                  <TableHead className="text-right">Current Balance</TableHead>
                  <TableHead className="text-right">Opening Balance</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lots.map(lot => {
                  const owner = lot.lot_ownerships?.[0]?.owners
                  const ownerName = owner
                    ? `${owner.first_name} ${owner.last_name}`
                    : 'No owner'
                  const lotLabel = lot.unit_number
                    ? `Unit ${lot.unit_number}`
                    : `Lot ${lot.lot_number}`

                  return (
                    <TableRow key={lot.id}>
                      <TableCell className="font-medium">{lotLabel}</TableCell>
                      <TableCell>{ownerName}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(lot.total_annual_levy)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(lot.balance)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={balances[lot.id] || ''}
                          onChange={(e) => handleBalanceChange(lot.id, e.target.value)}
                          className="max-w-[140px] text-right"
                        />
                      </TableCell>
                      <TableCell>
                        {lot.has_opening_balance && (
                          <Badge variant="secondary" className="bg-green-100 text-green-800">
                            Applied
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          <div className="mt-6 flex gap-3">
            <Button type="submit" disabled={saving || totalOpeningBalance <= 0}>
              {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
              Apply Opening Balances
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push(`/schemes/${schemeId}`)}
            >
              Cancel
            </Button>
          </div>

          <Alert className="mt-6">
            <AlertCircle className="size-4" />
            <AlertDescription>
              <strong>Note:</strong> Opening balances are allocated to outstanding levy items in FIFO (first-in, first-out) order by due date.
              If a lot has no outstanding levy items, the opening balance will be recorded but remain unallocated.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </form>
  )
}
