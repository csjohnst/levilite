'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MoreHorizontal, Download, Pencil, Trash2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { downloadDocument, deleteDocument, updateDocument } from '@/actions/documents'
import type { UpdateDocumentFormData } from '@/actions/documents'

export interface DocumentRow {
  id: string
  scheme_id: string
  document_name: string
  description: string | null
  category: string
  document_date: string
  file_path: string
  file_size: number
  mime_type: string
  tags: string[]
  visibility: string
  version_number: number
  created_at: string
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

const VISIBILITY_LABELS: Record<string, string> = {
  manager_only: 'Manager Only',
  committee: 'Committee',
  owners: 'All Owners',
}

interface DocumentActionsProps {
  document: DocumentRow
}

export function DocumentActions({ document }: DocumentActionsProps) {
  const router = useRouter()
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [saving, setSaving] = useState(false)

  async function handleDownload() {
    const result = await downloadDocument(document.id)
    if (result.error) {
      toast.error(result.error)
      return
    }
    if (result.data?.url) {
      window.open(result.data.url, '_blank')
    }
  }

  async function handleDelete() {
    setDeleting(true)
    const result = await deleteDocument(document.id)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success('Document deleted')
      router.refresh()
    }
    setDeleting(false)
    setShowDeleteDialog(false)
  }

  async function handleUpdate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)

    const formData = new FormData(e.currentTarget)
    const tagsRaw = formData.get('tags') as string
    const data: UpdateDocumentFormData = {
      document_name: formData.get('document_name') as string,
      description: (formData.get('description') as string) || null,
      category: formData.get('category') as UpdateDocumentFormData['category'],
      visibility: formData.get('visibility') as UpdateDocumentFormData['visibility'],
      tags: tagsRaw ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean) : [],
    }

    const result = await updateDocument(document.id, data)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success('Document updated')
      router.refresh()
      setShowEditDialog(false)
    }
    setSaving(false)
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="size-8">
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handleDownload}>
            <Download className="mr-2 size-4" />
            Download
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setShowEditDialog(true)}>
            <Pencil className="mr-2 size-4" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive"
            onClick={() => setShowDeleteDialog(true)}
          >
            <Trash2 className="mr-2 size-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Edit dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Document</DialogTitle>
            <DialogDescription>
              Update the document metadata.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit_document_name">Document Name</Label>
              <Input
                id="edit_document_name"
                name="document_name"
                defaultValue={document.document_name}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_description">Description</Label>
              <Textarea
                id="edit_description"
                name="description"
                defaultValue={document.description ?? ''}
                rows={3}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edit_category">Category</Label>
                <Select name="category" defaultValue={document.category}>
                  <SelectTrigger id="edit_category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_visibility">Visibility</Label>
                <Select name="visibility" defaultValue={document.visibility}>
                  <SelectTrigger id="edit_visibility">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(VISIBILITY_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_tags">Tags (comma-separated)</Label>
              <Input
                id="edit_tags"
                name="tags"
                defaultValue={document.tags?.join(', ') ?? ''}
                placeholder="e.g. 2026, annual, important"
              />
            </div>
            <div className="flex gap-3">
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowEditDialog(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Document</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{document.document_name}&quot;? This action can be undone by an administrator.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3">
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting...' : 'Delete'}
            </Button>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
