'use client'

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
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
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Upload, Download, FileText } from 'lucide-react'
import { importLotsFromCSV } from '@/actions/lots'

interface CsvImportFormProps {
  schemeId: string
  onSuccess?: () => void
}

interface ParsedRow {
  values: Record<string, string>
  errors: string[]
}

const TEMPLATE_CSV = `lot_number,unit_entitlement,unit_number,lot_type,voting_entitlement,floor_area_sqm,bedrooms,bathrooms,car_bays,owner_first_name,owner_last_name,owner_email,owner_phone,notes
1,50,101,residential,,85.5,2,1,1,John,Smith,john@example.com,0400000001,
2,50,102,residential,,90.0,2,2,1,Jane,Doe,jane@example.com,0400000002,Corner unit`

export function CsvImportForm({ schemeId, onSuccess }: CsvImportFormProps) {
  const [csvText, setCsvText] = useState('')
  const [fileName, setFileName] = useState('')
  const [preview, setPreview] = useState<ParsedRow[]>([])
  const [headers, setHeaders] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{
    lotsCreated: number
    ownersCreated: number
    errors?: { row: number; message: string }[]
  } | null>(null)

  const parsePreview = useCallback((text: string) => {
    const lines = text.trim().split('\n')
    if (lines.length < 2) {
      setHeaders([])
      setPreview([])
      return
    }

    const parseLine = (line: string): string[] => {
      const fields: string[] = []
      let current = ''
      let inQuotes = false
      for (let i = 0; i < line.length; i++) {
        const char = line[i]
        if (char === '"') {
          if (inQuotes && line[i + 1] === '"') {
            current += '"'
            i++
          } else {
            inQuotes = !inQuotes
          }
        } else if (char === ',' && !inQuotes) {
          fields.push(current.trim())
          current = ''
        } else {
          current += char
        }
      }
      fields.push(current.trim())
      return fields
    }

    const hdrs = parseLine(lines[0]).map(h => h.toLowerCase().replace(/\s+/g, '_'))
    setHeaders(hdrs)

    const rows = lines.slice(1).filter(l => l.trim()).slice(0, 10).map(line => {
      const values: Record<string, string> = {}
      const fields = parseLine(line)
      const errors: string[] = []

      hdrs.forEach((h, i) => {
        values[h] = fields[i] || ''
      })

      if (!values.lot_number) errors.push('lot_number is required')
      if (values.unit_entitlement === '' || values.unit_entitlement === undefined || isNaN(Number(values.unit_entitlement)) || Number(values.unit_entitlement) < 0) {
        errors.push('unit_entitlement must be a non-negative number (0 is valid for Common Property lots)')
      }

      return { values, errors }
    })

    setPreview(rows)
  }, [])

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setFileName(file.name)
    setResult(null)
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      setCsvText(text)
      parsePreview(text)
    }
    reader.readAsText(file)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (!file) return

    setFileName(file.name)
    setResult(null)
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      setCsvText(text)
      parsePreview(text)
    }
    reader.readAsText(file)
  }

  function downloadTemplate() {
    const blob = new Blob([TEMPLATE_CSV], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'lots_import_template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleImport() {
    if (!csvText) return
    setLoading(true)
    setResult(null)

    const res = await importLotsFromCSV(schemeId, csvText)
    setLoading(false)

    if (res.error && !res.data) {
      toast.error(res.error)
      return
    }

    if (res.data) {
      setResult({
        ...res.data,
        errors: res.errors,
      })
      toast.success(`Imported ${res.data.lotsCreated} lots`)
      onSuccess?.()
    }
  }

  const totalRows = csvText ? csvText.trim().split('\n').length - 1 : 0
  const validRows = preview.filter(r => r.errors.length === 0).length

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Import Lots from CSV</CardTitle>
          <CardDescription>
            Upload a CSV file with lot data. Required columns: lot_number, unit_entitlement.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button variant="outline" onClick={downloadTemplate}>
            <Download className="mr-2 size-4" />
            Download Template
          </Button>

          <div
            className="relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center cursor-pointer"
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
          >
            {fileName ? (
              <div className="flex items-center gap-2">
                <FileText className="size-5 text-muted-foreground" />
                <span className="font-medium">{fileName}</span>
                <span className="text-sm text-muted-foreground">({totalRows} rows)</span>
              </div>
            ) : (
              <>
                <Upload className="mb-2 size-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Drag and drop your CSV file here, or click to browse
                </p>
              </>
            )}
            <input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="absolute inset-0 cursor-pointer opacity-0"
            />
          </div>
        </CardContent>
      </Card>

      {preview.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Preview (first 10 rows)</CardTitle>
            <CardDescription>
              {validRows} of {preview.length} preview rows are valid.
              {totalRows > 10 && ` Total rows in file: ${totalRows}.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Row</TableHead>
                    {headers.slice(0, 6).map(h => (
                      <TableHead key={h}>{h}</TableHead>
                    ))}
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.map((row, i) => (
                    <TableRow key={i}>
                      <TableCell>{i + 2}</TableCell>
                      {headers.slice(0, 6).map(h => (
                        <TableCell key={h}>{row.values[h] || '-'}</TableCell>
                      ))}
                      <TableCell>
                        {row.errors.length === 0 ? (
                          <Badge variant="secondary" className="bg-green-100 text-green-800">Valid</Badge>
                        ) : (
                          <Badge variant="destructive">{row.errors.join(', ')}</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="mt-4">
              <Button onClick={handleImport} disabled={loading || validRows === 0}>
                {loading ? 'Importing...' : `Import ${totalRows} lots`}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {result && (
        <Card>
          <CardHeader>
            <CardTitle>Import Results</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm">
              <span className="font-medium">{result.lotsCreated}</span> lots created
            </p>
            <p className="text-sm">
              <span className="font-medium">{result.ownersCreated}</span> owners created
            </p>
            {result.errors && result.errors.length > 0 && (
              <div className="mt-2">
                <p className="text-sm font-medium text-destructive">
                  {result.errors.length} rows had errors:
                </p>
                <ul className="mt-1 text-sm text-destructive">
                  {result.errors.map((err, i) => (
                    <li key={i}>Row {err.row}: {err.message}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
