import { prisma } from '@/lib/db'
import { PageHeader } from '@/components/layout/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { ProcessingModeToggle } from './processing-mode-toggle'
import { AttorneyConfigForm } from './attorney-config-form'
import { BackupPanel } from './backup-panel'
import { getBackupList } from './actions'

export default async function SettingsPage() {
  const settings = await prisma.systemSettings.findUnique({
    where: { id: 1 }
  })
  const backups = await getBackupList()

  return (
    <div>
      <PageHeader title="Settings" description="System configuration" />

      <div className="p-4 md:p-6 space-y-5 max-w-xl">
        {/* Attorney Details */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Attorney Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Used in all generated legal notices. Update here whenever your attorney changes.
            </p>
            <AttorneyConfigForm
              current={{
                attorney_name:    settings?.attorney_name    ?? null,
                attorney_address: settings?.attorney_address ?? null,
                attorney_phone:   settings?.attorney_phone   ?? null,
                attorney_email:   settings?.attorney_email   ?? null,
              }}
            />
          </CardContent>
        </Card>

        {/* Processing Mode */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">PDF Processing Mode</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Controls when uploaded PDFs are processed by the AI extraction pipeline.
            </p>
            <ProcessingModeToggle currentMode={settings?.processing_mode ?? 'immediate'} />
            <Separator />
            <div className="space-y-2 text-xs text-muted-foreground">
              <p><strong>Immediate:</strong> PDFs are processed as soon as they&apos;re uploaded. Recommended.</p>
              <p><strong>Scheduled:</strong> PDFs queue up and process on a schedule. Use if you want to review uploads before processing.</p>
            </div>
          </CardContent>
        </Card>

        {/* Backups */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Backup &amp; Restore</CardTitle>
          </CardHeader>
          <CardContent>
            <BackupPanel initialBackups={backups} />
          </CardContent>
        </Card>

        {/* System Info */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">System Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Processing Mode</span>
              <span className="font-medium capitalize">{settings?.processing_mode ?? 'immediate'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Attorney</span>
              <span className="font-medium">{settings?.attorney_name ?? 'Not set'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Database</span>
              <span className="font-medium">PostgreSQL (Local)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">AI Engine</span>
              <span className="font-medium">Gemini 2.5 Flash</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Automation</span>
              <span className="font-medium">n8n Workflows</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
