import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/subscription'
import { FileText, Receipt } from 'lucide-react'

interface Invoice {
  id: string
  invoice_date: string
  stripe_invoice_number: string | null
  subtotal_ex_gst: number
  gst_amount: number
  total_inc_gst: number
  status: string
  lots_billed: number | null
  invoice_pdf_url: string | null
}

interface BillingHistoryTableProps {
  invoices: Invoice[]
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  paid: { label: 'Paid', className: 'bg-green-100 text-green-800' },
  open: { label: 'Open', className: 'bg-blue-100 text-blue-800' },
  draft: { label: 'Draft', className: 'bg-gray-100 text-gray-600' },
  void: { label: 'Void', className: 'bg-gray-100 text-gray-600' },
  uncollectible: {
    label: 'Uncollectible',
    className: 'bg-red-100 text-red-800',
  },
}

export function BillingHistoryTable({ invoices }: BillingHistoryTableProps) {
  if (!invoices || invoices.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <Receipt className="size-5" />
            Billing History
          </CardTitle>
          <CardDescription>Your past invoices and payments</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
            <Receipt className="size-10 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">
              No invoices yet. Invoices will appear here after your first
              payment.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-3">
          <Receipt className="size-5" />
          Billing History
        </CardTitle>
        <CardDescription>Your past invoices and payments</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Invoice</TableHead>
                <TableHead className="text-right">Amount (inc GST)</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[50px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((invoice) => {
                const statusConfig = STATUS_BADGE[invoice.status] ?? {
                  label: invoice.status,
                  className: '',
                }
                return (
                  <TableRow key={invoice.id}>
                    <TableCell>
                      {new Date(invoice.invoice_date).toLocaleDateString(
                        'en-AU',
                        { day: 'numeric', month: 'short', year: 'numeric' }
                      )}
                    </TableCell>
                    <TableCell className="font-medium">
                      {invoice.stripe_invoice_number ?? '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(invoice.total_inc_gst)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={statusConfig.className}
                      >
                        {statusConfig.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {invoice.invoice_pdf_url && (
                        <a
                          href={invoice.invoice_pdf_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center text-sm text-[#02667F] hover:underline"
                        >
                          <FileText className="size-4" />
                        </a>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
