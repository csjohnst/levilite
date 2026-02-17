'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { createBudget } from '@/actions/budgets'

interface FinancialYear {
  id: string
  year_label: string
  start_date: string
  end_date: string
  is_current: boolean
}

interface BudgetFormProps {
  schemeId: string
  financialYears: FinancialYear[]
  existingBudgets: { financial_year_id: string; budget_type: string }[]
}

export function BudgetForm({ schemeId, financialYears, existingBudgets }: BudgetFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [fyId, setFyId] = useState('')
  const [budgetType, setBudgetType] = useState<'admin' | 'capital_works'>('admin')
  const [notes, setNotes] = useState('')

  // Check which combos already exist
  const isDuplicate = existingBudgets.some(
    b => b.financial_year_id === fyId && b.budget_type === budgetType
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!fyId) {
      toast.error('Please select a financial year')
      return
    }
    if (isDuplicate) {
      toast.error('A budget already exists for this financial year and fund type')
      return
    }

    setLoading(true)
    const result = await createBudget(schemeId, {
      financial_year_id: fyId,
      budget_type: budgetType,
      notes: notes || null,
    })

    if (result.error) {
      toast.error(result.error)
      setLoading(false)
      return
    }

    toast.success('Budget created')
    const budget = result.data as { id: string }
    router.push(`/schemes/${schemeId}/budgets/${budget.id}`)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Financial Year</CardTitle>
          <CardDescription>Select the financial year for this budget</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="financial_year">Financial Year</Label>
            <Select value={fyId} onValueChange={setFyId}>
              <SelectTrigger id="financial_year">
                <SelectValue placeholder="Select a financial year" />
              </SelectTrigger>
              <SelectContent>
                {financialYears.map(fy => (
                  <SelectItem key={fy.id} value={fy.id}>
                    {fy.year_label}
                    {fy.is_current ? ' (Current)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Fund Type</CardTitle>
          <CardDescription>Choose which fund this budget is for</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            {([
              { value: 'admin' as const, label: 'Admin Fund' },
              { value: 'capital_works' as const, label: 'Capital Works Fund' },
            ]).map(opt => (
              <Button
                key={opt.value}
                type="button"
                variant={budgetType === opt.value ? 'default' : 'outline'}
                onClick={() => setBudgetType(opt.value)}
                className="flex-1"
              >
                {opt.label}
              </Button>
            ))}
          </div>
          {isDuplicate && (
            <p className="text-sm text-destructive">
              A budget already exists for this financial year and fund type.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notes</CardTitle>
          <CardDescription>Optional notes about this budget</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Approved at AGM on 15 September 2026"
            rows={3}
          />
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button type="submit" disabled={loading || !fyId || isDuplicate}>
          {loading ? 'Creating...' : 'Create Budget'}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
