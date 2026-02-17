'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, FileText, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import { uploadDocument } from '@/actions/documents'

interface DocumentUploadFormProps {
  schemeId: string
}

const ALLOWED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'text/csv',
  'text/plain',
]

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB

const CATEGORY_OPTIONS = [
  { value: 'agm', label: 'AGM' },
  { value: 'levy-notices', label: 'Levy Notices' },
  { value: 'financial', label: 'Financial' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'bylaws', label: 'By-Laws' },
  { value: 'correspondence', label: 'Correspondence' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'contracts', label: 'Contracts' },
  { value: 'building-reports', label: 'Building Reports' },
  { value: 'other', label: 'Other' },
]

const VISIBILITY_OPTIONS = [
  { value: 'manager_only', label: 'Manager Only' },
  { value: 'committee', label: 'Committee' },
  { value: 'owners', label: 'All Owners' },
]

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function DocumentUploadForm({ schemeId }: DocumentUploadFormProps) {
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [documentName, setDocumentName] = useState('')
  const [category, setCategory] = useState('other')
  const [documentDate, setDocumentDate] = useState(new Date().toISOString().split('T')[0])
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState('')
  const [visibility, setVisibility] = useState('manager_only')
  const [uploading, setUploading] = useState(false)
  const [fileError, setFileError] = useState<string | null>(null)

  const validateFile = useCallback((f: File): string | null => {
    if (!ALLOWED_TYPES.includes(f.type) && f.type !== '') {
      return `File type "${f.type}" is not supported. Accepted: PDF, DOC, DOCX, XLS, XLSX, JPG, PNG, GIF, WEBP, CSV, TXT.`
    }
    if (f.size > MAX_FILE_SIZE) {
      return `File is too large (${formatFileSize(f.size)}). Maximum size is 50MB.`
    }
    if (f.size === 0) {
      return 'File is empty.'
    }
    return null
  }, [])

  function handleFileSelect(f: File) {
    const error = validateFile(f)
    setFileError(error)
    if (!error) {
      setFile(f)
      if (!documentName) {
        const nameWithoutExt = f.name.replace(/\.[^/.]+$/, '')
        setDocumentName(nameWithoutExt)
      }
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (f) handleFileSelect(f)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const f = e.dataTransfer.files[0]
    if (f) handleFileSelect(f)
  }

  function clearFile() {
    setFile(null)
    setFileError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!file) {
      toast.error('Please select a file')
      return
    }

    setUploading(true)

    const formData = new FormData()
    formData.set('file', file)
    formData.set('document_name', documentName)
    formData.set('category', category)
    formData.set('document_date', documentDate)
    formData.set('description', description)
    formData.set('tags', JSON.stringify(tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : []))
    formData.set('visibility', visibility)

    const result = await uploadDocument(schemeId, formData)

    if (result.error) {
      toast.error(result.error)
      setUploading(false)
      return
    }

    toast.success('Document uploaded successfully')
    router.push(`/schemes/${schemeId}/documents`)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* File selection */}
      <Card>
        <CardHeader>
          <CardTitle>Select File</CardTitle>
          <CardDescription>
            Upload a document file. Accepted formats: PDF, DOC, DOCX, XLS, XLSX, JPG, PNG, GIF, WEBP, CSV, TXT. Max 50MB.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {file ? (
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="flex items-center gap-3">
                <FileText className="size-8 text-muted-foreground" />
                <div>
                  <p className="font-medium">{file.name}</p>
                  <p className="text-sm text-muted-foreground">{formatFileSize(file.size)}</p>
                </div>
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={clearFile}>
                <X className="size-4" />
              </Button>
            </div>
          ) : (
            <div
              className="relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center cursor-pointer"
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
            >
              <Upload className="mb-2 size-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Drag and drop your file here, or click to browse
              </p>
              <input
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.webp,.csv,.txt"
                onChange={handleFileChange}
                className="absolute inset-0 cursor-pointer opacity-0"
              />
            </div>
          )}
          {fileError && (
            <p className="mt-2 text-sm text-destructive">{fileError}</p>
          )}
        </CardContent>
      </Card>

      {/* Document metadata */}
      <Card>
        <CardHeader>
          <CardTitle>Document Details</CardTitle>
          <CardDescription>
            Add metadata to help organise and find this document later.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="document_name">Document Name</Label>
            <Input
              id="document_name"
              value={documentName}
              onChange={(e) => setDocumentName(e.target.value)}
              placeholder="e.g. 2026 Annual Budget"
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger id="category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="document_date">Document Date</Label>
              <Input
                id="document_date"
                type="date"
                value={documentDate}
                onChange={(e) => setDocumentDate(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of the document contents"
              rows={3}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="tags">Tags (comma-separated)</Label>
              <Input
                id="tags"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="e.g. 2026, annual, budget"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="visibility">Visibility</Label>
              <Select value={visibility} onValueChange={setVisibility}>
                <SelectTrigger id="visibility">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VISIBILITY_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button type="submit" disabled={uploading || !file || !documentName || !!fileError}>
          {uploading ? 'Uploading...' : 'Upload Document'}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
