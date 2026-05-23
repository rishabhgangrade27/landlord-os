'use client'

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Upload, FileText, CheckCircle2, AlertCircle, X } from 'lucide-react'

interface UploadFile {
  file: File
  status: 'pending' | 'uploading' | 'done' | 'error'
  progress: number
  error?: string
  path?: string
}

export default function UploadPage() {
  const supabase = createClient()
  const [files, setFiles] = useState<UploadFile[]>([])
  const [uploading, setUploading] = useState(false)

  const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const dropped = Array.from(e.dataTransfer.files).filter(
      (f) => f.type === 'application/pdf' || f.type.startsWith('image/')
    )
    addFiles(dropped)
  }, [])

  function addFiles(newFiles: File[]) {
    const items: UploadFile[] = newFiles.map((f) => ({
      file: f,
      status: 'pending',
      progress: 0,
    }))
    setFiles((prev) => [...prev, ...items])
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  async function uploadAll() {
    const pending = files.filter((f) => f.status === 'pending')
    if (!pending.length) {
      toast.error('No pending files to upload.')
      return
    }
    setUploading(true)

    for (let i = 0; i < files.length; i++) {
      if (files[i].status !== 'pending') continue

      setFiles((prev) =>
        prev.map((f, idx) => (idx === i ? { ...f, status: 'uploading', progress: 10 } : f))
      )

      const file = files[i].file
      const timestamp = Date.now()
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const path = `receipts/${timestamp}_${safeName}`

      const { error } = await supabase.storage
        .from('receipts')
        .upload(path, file, { contentType: file.type, upsert: false })

      if (error) {
        setFiles((prev) =>
          prev.map((f, idx) =>
            idx === i ? { ...f, status: 'error', progress: 0, error: error.message } : f
          )
        )
        toast.error(`Failed: ${file.name} — ${error.message}`)
      } else {
        setFiles((prev) =>
          prev.map((f, idx) =>
            idx === i ? { ...f, status: 'done', progress: 100, path } : f
          )
        )
      }
    }

    setUploading(false)
    const doneCount = files.filter((f) => f.status === 'done').length + 1
    toast.success(`Upload complete. n8n will process the files automatically.`)
  }

  const allDone = files.length > 0 && files.every((f) => f.status === 'done' || f.status === 'error')

  return (
    <div>
      <PageHeader
        title="Upload Receipts"
        description="Upload HRA check PDFs or images. Processing starts automatically."
      />

      <div className="p-6 space-y-5 max-w-2xl">
        {/* Instructions */}
        <Card className="bg-blue-50/50 border-blue-200">
          <CardContent className="p-4 text-sm text-blue-800 space-y-1">
            <p className="font-medium">How it works:</p>
            <ol className="list-decimal list-inside space-y-0.5 text-blue-700">
              <li>Drop your PDFs below (up to 500 pages per file)</li>
              <li>Click "Upload All" — files go to Supabase Storage</li>
              <li>n8n picks them up automatically and runs Gemini extraction</li>
              <li>You'll receive an email when processing is complete</li>
              <li>Review extracted transactions in the Transactions page</li>
            </ol>
            <p className="text-blue-600 mt-2">
              If a single PDF is over 500 pages, split it into ~125-page chunks first.
            </p>
          </CardContent>
        </Card>

        {/* Drop Zone */}
        <div
          onDrop={onDrop}
          onDragOver={(e) => e.preventDefault()}
          className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-10 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/10 transition-colors"
          onClick={() => document.getElementById('file-input')?.click()}
        >
          <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <p className="font-medium">Drop PDFs or images here</p>
          <p className="text-sm text-muted-foreground mt-1">or click to browse</p>
          <p className="text-xs text-muted-foreground mt-2">Supported: PDF, JPG, PNG</p>
          <input
            id="file-input"
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png"
            className="hidden"
            onChange={(e) => {
              if (e.target.files) addFiles(Array.from(e.target.files))
            }}
          />
        </div>

        {/* File List */}
        {files.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">
                Files ({files.length}) —{' '}
                {files.filter((f) => f.status === 'done').length} done,{' '}
                {files.filter((f) => f.status === 'error').length} errors
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {files.map((f, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3 border-b last:border-0">
                  <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{f.file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(f.file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                    {f.status === 'uploading' && (
                      <Progress value={f.progress} className="h-1 mt-1" />
                    )}
                    {f.error && (
                      <p className="text-xs text-destructive mt-0.5">{f.error}</p>
                    )}
                  </div>
                  <div className="shrink-0 flex items-center gap-2">
                    {f.status === 'done' && (
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                    )}
                    {f.status === 'error' && (
                      <AlertCircle className="w-4 h-4 text-destructive" />
                    )}
                    {f.status === 'pending' && (
                      <Badge variant="secondary" className="text-xs">Pending</Badge>
                    )}
                    {f.status !== 'uploading' && f.status !== 'done' && (
                      <button
                        onClick={() => removeFile(i)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        {files.length > 0 && !allDone && (
          <Button onClick={uploadAll} disabled={uploading} size="lg">
            <Upload className="w-4 h-4 mr-2" />
            {uploading ? 'Uploading…' : `Upload ${files.filter((f) => f.status === 'pending').length} File(s)`}
          </Button>
        )}

        {allDone && (
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            <p className="text-sm font-medium text-green-700">
              All files uploaded. n8n will process them shortly. You'll get an email when done.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
