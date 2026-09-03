import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/dal'
import { buildNoticeContent } from '@/lib/legal-notice'
import { NextResponse } from 'next/server'

type GenerateRequest = {
  tenant_id: string
  notice_type: string
  confirm?: boolean
}

export async function POST(request: Request) {
  await requireAuth()

  let body: GenerateRequest
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { tenant_id, notice_type, confirm = false } = body
  if (!tenant_id || !notice_type) {
    return NextResponse.json({ error: 'tenant_id and notice_type are required' }, { status: 400 })
  }

  const result = await buildNoticeContent(tenant_id, notice_type)
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }
  const content = result.data

  // ── Preview mode ────────────────────────────────────────────────────────────
  if (!confirm) {
    return NextResponse.json({
      rendered_text:  content.renderedText,
      template_title: content.templateTitle,
      tenant_name:    content.tenantName,
      unit_display:   content.unitDisplay,
      // Show which variant was resolved (helps admin confirm)
      resolved_type: content.effectiveNoticeType !== notice_type ? content.effectiveNoticeType : null,
    })
  }

  // ── Confirm: insert into legal_notices ──────────────────────────────────────
  const referenceId = `LN-${Date.now()}`

  try {
    const notice = await prisma.legalNotice.create({
      data: {
        tenant_id,
        lease_id:     content.leaseId,
        unit_id:      null,
        property_id:  content.propertyId,
        notice_type:  content.effectiveNoticeType,
        reference_id: referenceId,
        rendered_text: content.renderedText,
        status:        'generated',
        attorney_email: content.attorneyEmail,
        generated_at:  new Date(),
      }
    })

    // We do NOT queue pdf_jobs here anymore, since we will transition to docxtemplater natively.
    // Attorney emails can be handled via a local service instead of Supabase edge functions.

    return NextResponse.json({ notice_id: notice.id, reference_id: referenceId, pdf_queued: false })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
