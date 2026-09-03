import { NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import path from 'path'
import PizZip from 'pizzip'
import Docxtemplater from 'docxtemplater'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/dal'
import { buildNoticeContent } from '@/lib/legal-notice'

const TEMPLATES_DIR = path.join(process.cwd(), 'templates', 'legal-notices')

// Only notice types with a real client-provided source document have a proper
// .docx template so far (see SCRATCHPAD.md) — 90-day (all property variants
// share one file, the landlord entity/signatory are placeholders), the 14-day
// cure/quit, and the holdover petition. Everything else (5-day, 7-day, the
// 30-day-to-tenant letter, the non-payment court petition) has no real
// template to build from yet and still uses the HTML-wrapper .doc download.
function templateFileFor(effectiveNoticeType: string): string | null {
  if (effectiveNoticeType.startsWith('notice_90day')) return 'notice_90day.docx'
  if (effectiveNoticeType === 'notice_14day') return 'notice_14day.docx'
  if (effectiveNoticeType === 'court_form') return 'court_form.docx'
  return null
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth()
  } catch {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { id } = await params

  const notice = await prisma.legalNotice.findUnique({
    where: { id },
    select: { id: true, tenant_id: true, notice_type: true },
  }).catch(() => null)

  if (!notice || !notice.tenant_id || !notice.notice_type) {
    return NextResponse.json({ error: 'Legal notice not found or missing tenant/notice_type' }, { status: 404 })
  }

  const result = await buildNoticeContent(notice.tenant_id, notice.notice_type)
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  const templateFile = templateFileFor(result.data.effectiveNoticeType)
  if (!templateFile) {
    return NextResponse.json(
      { error: `No real .docx template for "${result.data.effectiveNoticeType}" yet — use the Word doc (.doc) download instead.` },
      { status: 501 }
    )
  }

  let templateBuffer: Buffer
  try {
    templateBuffer = await readFile(path.join(TEMPLATES_DIR, templateFile))
  } catch {
    return NextResponse.json({ error: `Template file ${templateFile} missing on disk` }, { status: 500 })
  }

  const zip = new PizZip(templateBuffer)
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: '{{', end: '}}' },
  })

  try {
    doc.render(result.data.templateData)
  } catch (error: any) {
    return NextResponse.json({ error: `Template render failed: ${error.message}` }, { status: 500 })
  }

  const outBuffer = doc.getZip().generate({ type: 'nodebuffer' })
  const filename = `${result.data.templateTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${result.data.tenantName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.docx`

  return new NextResponse(new Uint8Array(outBuffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
