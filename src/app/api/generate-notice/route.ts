import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

type GenerateRequest = {
  tenant_id: string
  notice_type: string
  confirm?: boolean
}

function fillTemplate(body: string, data: Record<string, string>): string {
  return body.replace(/\{\{(\w+)\}\}/g, (_, key) => data[key] ?? `{{${key}}}`)
}

// Determine landlord entity based on property address
function getLandlordInfo(propertyAddress: string | null): {
  landlord_entity: string
  landlord_signatory: string
  landlord_address: string
  landlord_phone: string
  landlord_email: string
} {
  const addr = (propertyAddress ?? '').toLowerCase()
  const isWillow = addr.includes('4521') || addr.includes('willow')
  if (isWillow) {
    return {
      landlord_entity:    'Willow Grove Holdings LLC',
      landlord_signatory: 'Jamie Rivera',
      landlord_address:   '4521 Willow Avenue, Kew Gardens, NY 11415',
      landlord_phone:     '(555) 010-2200',
      landlord_email:     'jamie.rivera@willowgroveholdings.example',
    }
  }
  // Sunrise / default (Sunrise Boulevard properties)
  return {
    landlord_entity:    'Sunrise Court Properties LLC',
    landlord_signatory: 'Morgan Ellis',
    landlord_address:   '220 Sunrise Boulevard, Ocean Grove, NY 11693',
    landlord_phone:     '(555) 010-8800',
    landlord_email:     'morgan.ellis@sunrisecourtproperties.example',
  }
}

// Auto-detect property-specific template variant for 90-day and court notices
async function resolveTemplateType(
  supabase: Awaited<ReturnType<typeof createClient>>,
  noticeType: string,
  propertyAddress: string | null
): Promise<string> {
  if (noticeType !== 'notice_90day') return noticeType

  const addr = (propertyAddress ?? '').toLowerCase()
  const isWillow  = addr.includes('4521') || addr.includes('willow')
  const isSunrise = addr.includes('sunrise') || addr.includes('ocean grove') || addr.includes('220')

  const variantType = isWillow ? 'notice_90day_willow' : isSunrise ? 'notice_90day_sunrise' : null
  if (!variantType) return noticeType

  const { data } = await supabase
    .from('legal_templates')
    .select('notice_type')
    .eq('notice_type', variantType)
    .eq('is_active', true)
    .maybeSingle()

  return data ? variantType : noticeType
}

export async function POST(request: Request) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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

  // ── Attorney config from system_settings ────────────────────────────────────
  const { data: settings } = await supabase
    .from('system_settings')
    .select('attorney_name, attorney_address, attorney_phone, attorney_email')
    .eq('id', 1)
    .single()

  const attorneyName    = settings?.attorney_name    ?? 'Demo Legal Associates, P.C.'
  const attorneyAddress = settings?.attorney_address ?? '400 Market Street, Suite 100, Springfield, NY 10001'
  const attorneyPhone   = settings?.attorney_phone   ?? '(555) 010-4400'
  const attorneyEmail   = settings?.attorney_email   ?? 'contact@demolegalassociates.example'

  // ── Tenant ──────────────────────────────────────────────────────────────────
  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, name, full_legal_name, case_number, address, unit_id')
    .eq('id', tenant_id)
    .single()

  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

  // ── Property (from most recent lease — no separate units table) ─────────────
  let property: any = null
  let propertyId: string | null = null

  const { data: propRow } = await supabase
    .from('leases')
    .select('property_id, properties(id, name, address, nickname, city_state_zip)')
    .eq('tenant_id', tenant_id)
    .order('start_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (propRow) {
    property = (propRow as any).properties ?? null
    propertyId = (propRow as any).property_id ?? null
  }

  // ── Resolve property-variant template type ───────────────────────────────────
  const effectiveNoticeType = await resolveTemplateType(supabase, notice_type, property?.address ?? null)

  // ── Template ────────────────────────────────────────────────────────────────
  const { data: template } = await supabase
    .from('legal_templates')
    .select('id, title, body, notice_type')
    .eq('notice_type', effectiveNoticeType)
    .eq('is_active', true)
    .single()

  if (!template) {
    return NextResponse.json({
      error: `No active template found for "${effectiveNoticeType}". Run attorney-notice-updates.sql in Supabase first.`,
    }, { status: 404 })
  }

  // ── Active Lease ────────────────────────────────────────────────────────────
  const { data: lease } = await supabase
    .from('leases')
    .select('id, rent_amount, start_date, end_date, status')
    .eq('tenant_id', tenant_id)
    .order('start_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  // ── Ledger: current outstanding balance ──────────────────────────────────────
  // pending_balance is already a running cumulative total, so we only need the
  // LATEST row (most recent month). Summing all rows would triple-count everything.
  const { data: ledgerRows } = await supabase
    .from('view_rent_ledger')
    .select('month, due_amount, paid_amount, pending_balance')
    .eq('tenant_id', tenant_id)
    .order('month', { ascending: false })
    .limit(12) // last 12 months for check detail context

  // Latest row = most recent month's cumulative balance
  const totalBalance = Number(ledgerRows?.[0]?.pending_balance ?? 0)

  // ── Yearly summary (most recent year) ──────────────────────────────────────
  const { data: yearly } = await supabase
    .from('view_yearly_payments')
    .select('year, total_due, total_paid, total_balance')
    .eq('tenant_id', tenant_id)
    .order('year', { ascending: false })
    .limit(1)
    .maybeSingle()

  // ── Court ledger: check details + period dates ──────────────────────────────
  const { data: courtRows } = await supabase
    .from('view_court_ledger')
    .select('month_label, check_number, check_date, amount')
    .eq('tenant_id', tenant_id)
    .order('check_date', { ascending: true })

  const checkDetailList = courtRows?.length
    ? courtRows
        .map((c) => `${c.month_label ?? ''} — Check #${c.check_number ?? '—'} (${c.check_date ?? '—'}) — $${Number(c.amount || 0).toFixed(2)}`)
        .join('\n')
    : '(No checks recorded)'

  const checkDates = (courtRows ?? [])
    .map((c) => c.check_date)
    .filter(Boolean)
    .sort() as string[]

  const periodStart = checkDates[0] ?? '—'
  const periodEnd = checkDates[checkDates.length - 1] ?? '—'

  // ── Landlord info based on property ─────────────────────────────────────────
  const landlordInfo = getLandlordInfo(property?.address ?? null)

  // ── Date helpers ─────────────────────────────────────────────────────────────
  const today = new Date()
  const todayStr = today.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

  // cure_by_date = today + 14 days (for 14-day notice)
  const cureDate = new Date(today)
  cureDate.setDate(cureDate.getDate() + 14)
  const cureByDate = cureDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

  // vacate_by_date = today + 90 days (for 90-day notice)
  const vacateDate = new Date(today)
  vacateDate.setDate(vacateDate.getDate() + 90)
  const vacateByDate = vacateDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

  // ── Build template data ───────────────────────────────────────────────────────
  // Extract unit label from property nickname (e.g. "4521 Willow Ave - Unit 2R" → "2R")
  const unitLabel = property?.nickname
    ? (property.nickname.match(/[Uu]nit\s*(.+)$/)?.[1]?.trim() ?? property.nickname)
    : '—'

  const propertyLine = property
    ? `${property.address ?? property.name ?? ''}, ${property.city_state_zip ?? 'New York'}`
    : (tenant.address ?? '')

  // Use cumulative balance from ledger (most recent month's running total).
  // yearly.total_balance is only the current year's deficit — too low for notices.
  // yearly totals are still shown as breakdown context in the notice body.
  const outstandingBalance = totalBalance
  const totalDue = Number(yearly?.total_due ?? 0)
  const totalPaid = Number(yearly?.total_paid ?? 0)

  const tplData: Record<string, string> = {
    // Dates
    notice_date:          todayStr,
    today_date:           todayStr,
    notice_year:          String(today.getFullYear()),
    cure_by_date:         cureByDate,
    vacate_by_date:       vacateByDate,
    // Tenant
    tenant_name:          tenant.full_legal_name ?? tenant.name,
    full_legal_name:      tenant.full_legal_name ?? tenant.name,
    case_number:          tenant.case_number ?? '—',
    tenant_address:       tenant.address ?? propertyLine,
    // Property / unit
    property_address:     property?.address ?? tenant.address ?? '—',
    unit_number:          unitLabel,
    unit_address:         propertyLine,
    // Lease
    monthly_rent:         lease ? `$${Number(lease.rent_amount).toFixed(2)}` : '—',
    lease_start:          lease?.start_date ? new Date(lease.start_date).toLocaleDateString('en-US') : '—',
    lease_end:            lease?.end_date   ? new Date(lease.end_date).toLocaleDateString('en-US')   : 'Month-to-Month',
    // Financials
    outstanding_balance:  `$${Number(outstandingBalance).toFixed(2)}`,
    balance_owed:         `$${Number(outstandingBalance).toFixed(2)}`,
    total_due:            `$${totalDue.toFixed(2)}`,
    total_paid:           `$${totalPaid.toFixed(2)}`,
    period_start:         periodStart,
    period_end:           periodEnd,
    check_detail_list:    checkDetailList,
    // Landlord (auto-detected by property)
    landlord_name:        landlordInfo.landlord_signatory,
    landlord_entity:      landlordInfo.landlord_entity,
    landlord_signatory:   landlordInfo.landlord_signatory,
    landlord_address:     landlordInfo.landlord_address,
    landlord_phone:       landlordInfo.landlord_phone,
    landlord_email:       landlordInfo.landlord_email,
    // Attorney (from system_settings — admin-configurable)
    attorney_name:        attorneyName,
    attorney_address:     attorneyAddress,
    attorney_phone:       attorneyPhone,
    attorney_email:       attorneyEmail,
  }

  const renderedText = fillTemplate(template.body as string, tplData)

  // ── Preview mode ────────────────────────────────────────────────────────────
  if (!confirm) {
    return NextResponse.json({
      rendered_text:  renderedText,
      template_title: template.title,
      tenant_name:    tenant.name,
      unit_display:   property
        ? `${property.nickname ?? property.name ?? property.address ?? '?'}`
        : null,
      // Show which variant was resolved (helps admin confirm)
      resolved_type: effectiveNoticeType !== notice_type ? effectiveNoticeType : null,
    })
  }

  // ── Confirm: insert into legal_notices ──────────────────────────────────────
  const referenceId = `LN-${Date.now()}`

  const { data: notice, error: insertError } = await supabase
    .from('legal_notices')
    .insert({
      tenant_id,
      lease_id:     lease?.id ?? null,
      unit_id:      null,
      property_id:  propertyId ?? null,
      notice_type:  effectiveNoticeType,
      reference_id: referenceId,
      rendered_text: renderedText,
      status:        'generated',
      attorney_email: attorneyEmail,
      generated_at:  new Date().toISOString(),
    })
    .select('id')
    .single()

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  // Build HTML wrapper for PDF generation
  // Convert plain-text notice to styled HTML matching legal document format
  const lines = renderedText.split('\n')
  const firstNonEmpty = lines.findIndex(l => l.trim().length > 0)
  const titleLine = firstNonEmpty >= 0 ? lines[firstNonEmpty].trim() : ''
  const bodyLines = firstNonEmpty >= 0 ? lines.slice(firstNonEmpty + 1) : lines
  const htmlBody = bodyLines
    .join('\n')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/PLEASE TAKE NOTICE/g, '<strong>PLEASE TAKE NOTICE</strong>')
    .replace(/PLEASE TAKE FURTHER NOTICE/g, '<strong>PLEASE TAKE FURTHER NOTICE</strong>')
    .replace(/LANDLORD\/OWNER:/g, '<strong>LANDLORD/OWNER:</strong>')
    .split('\n')
    .map(l => l === '' ? '<br>' : '<p style="margin:0 0 6pt">' + l + '</p>')
    .join('')
  const safeTitle = titleLine.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const noticeHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{font-family:Arial,sans-serif;font-size:11pt;margin:72pt 72pt;color:#000;line-height:1.6}p{margin:0 0 6pt}strong{font-weight:bold}</style></head><body><h2 style="text-align:center;font-size:13pt;margin-bottom:18pt">${safeTitle}</h2>${htmlBody}</body></html>`
  const pdfFilename = `notice_${tenant.name.replace(/[^a-zA-Z0-9]/g, '_')}_${effectiveNoticeType}_${notice.id}`
  await supabase.from('pdf_jobs').insert({
    job_type: 'notice',
    reference_id: notice.id,
    html_content: noticeHtml,
    filename: pdfFilename,
    status: 'pending',
  })
  // Queue attorney notification email
  await supabase.from('notice_attorney_queue').insert({
    notice_id: notice.id,
    tenant_name: tenant.name,
    notice_type: effectiveNoticeType,
    rendered_text: renderedText,
    attorney_email: attorneyEmail,
    status: 'pending',
  })
  await supabase.from('legal_notices').update({
    attorney_email_sent: false,
  }).eq('id', notice.id)

  return NextResponse.json({ notice_id: notice.id, reference_id: referenceId, pdf_queued: true })
}
