'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  FileText, FileSpreadsheet, FileImage, File, Search, Filter,
  Upload, Eye, Calendar,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DocumentActions, type DocumentRow } from '@/components/documents/document-actions'

interface DocumentLibraryProps {
  schemeId: string
  documents: DocumentRow[]
}

const CATEGORY_LABELS: Record<string, string> = {
  agm: 'AGM',
  'levy-notices': 'Levy Notices',
  financial: 'Financial',
  insurance: 'Insurance',
  bylaws: 'By-Laws',
  correspondence: 'Correspondence',
  maintenance: 'Maintenance',
  contracts: 'Contracts',
  'building-reports': 'Building Reports',
  other: 'Other',
}

const CATEGORY_COLORS: Record<string, string> = {
  agm: 'bg-purple-100 text-purple-800',
  'levy-notices': 'bg-blue-100 text-blue-800',
  financial: 'bg-green-100 text-green-800',
  insurance: 'bg-amber-100 text-amber-800',
  bylaws: 'bg-red-100 text-red-800',
  correspondence: 'bg-slate-100 text-slate-800',
  maintenance: 'bg-orange-100 text-orange-800',
  contracts: 'bg-cyan-100 text-cyan-800',
  'building-reports': 'bg-indigo-100 text-indigo-800',
  other: 'bg-gray-100 text-gray-800',
}

const VISIBILITY_LABELS: Record<string, string> = {
  manager_only: 'Manager Only',
  committee: 'Committee',
  owners: 'All Owners',
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return FileImage
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType === 'text/csv') return FileSpreadsheet
  if (mimeType.includes('pdf') || mimeType.includes('word') || mimeType.includes('document')) return FileText
  return File
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
}

export function DocumentLibrary({ schemeId, documents }: DocumentLibraryProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [visibilityFilter, setVisibilityFilter] = useState('all')

  const filtered = documents.filter(doc => {
    if (categoryFilter !== 'all' && doc.category !== categoryFilter) return false
    if (visibilityFilter !== 'all' && doc.visibility !== visibilityFilter) return false
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      return (
        doc.document_name.toLowerCase().includes(q) ||
        doc.description?.toLowerCase().includes(q) ||
        doc.tags?.some(t => t.toLowerCase().includes(q))
      )
    }
    return true
  })

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Search documents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={visibilityFilter} onValueChange={setVisibilityFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Visibility" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Visibility</SelectItem>
                <SelectItem value="manager_only">Manager Only</SelectItem>
                <SelectItem value="committee">Committee</SelectItem>
                <SelectItem value="owners">All Owners</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Documents table */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <FileText className="size-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">
              {documents.length === 0 ? 'No documents yet' : 'No documents match your filters'}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {documents.length === 0
                ? 'Upload your first document to get started.'
                : 'Try adjusting your search or filter criteria.'}
            </p>
            {documents.length === 0 && (
              <Button asChild className="mt-4">
                <Link href={`/schemes/${schemeId}/documents/upload`}>
                  <Upload className="mr-2 size-4" />
                  Upload Document
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Documents</CardTitle>
            <CardDescription>
              {filtered.length} document{filtered.length !== 1 ? 's' : ''}
              {filtered.length !== documents.length && ` (${documents.length} total)`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Document</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Visibility</TableHead>
                  <TableHead className="w-[50px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(doc => {
                  const IconComponent = getFileIcon(doc.mime_type)
                  return (
                    <TableRow key={doc.id}>
                      <TableCell>
                        <div className="flex items-start gap-3">
                          <IconComponent className="mt-0.5 size-5 text-muted-foreground shrink-0" />
                          <div>
                            <span className="font-medium">{doc.document_name}</span>
                            {doc.version_number > 1 && (
                              <span className="ml-2 text-xs text-muted-foreground">v{doc.version_number}</span>
                            )}
                            {doc.description && (
                              <p className="text-sm text-muted-foreground line-clamp-1">{doc.description}</p>
                            )}
                            {doc.tags && doc.tags.length > 0 && (
                              <div className="flex gap-1 mt-1">
                                {doc.tags.map(tag => (
                                  <Badge key={tag} variant="outline" className="text-[10px] px-1.5 py-0">
                                    {tag}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={CATEGORY_COLORS[doc.category] ?? ''}>
                          {CATEGORY_LABELS[doc.category] ?? doc.category}
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {formatDate(doc.document_date)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatFileSize(doc.file_size)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {VISIBILITY_LABELS[doc.visibility] ?? doc.visibility}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DocumentActions document={doc} />
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
