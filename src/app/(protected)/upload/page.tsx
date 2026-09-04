import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Upload } from 'lucide-react'

export default function UploadPage() {
  return (
    <div>
      <PageHeader
        title="Upload Receipts"
        description="Upload HRA check PDFs or images. Processing starts automatically."
      />

      <div className="p-4 md:p-6 max-w-2xl">
        <Card className="bg-muted/30 border-dashed">
          <CardContent className="p-8 text-center space-y-2">
            <Upload className="w-8 h-8 text-muted-foreground mx-auto" />
            <p className="font-medium">OCR pipeline disabled in this public demo</p>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              In production this page uploads scanned checks to storage, where an
              automation pipeline (Gemini extraction, orchestrated via n8n) parses
              them and inserts matched transactions automatically. That pipeline
              depends on a live backend and isn&apos;t wired up for this demo — the
              rest of the app (ledger, tenants, leases, legal notices) runs against
              seeded sample data instead.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
