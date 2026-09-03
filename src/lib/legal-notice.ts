import { prisma } from '@/lib/db'

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
  const is8607 = addr.includes('8607') || addr.includes('101st') || addr.includes('101 st')
  if (is8607) {
    return {
      landlord_entity:    'RIVERSIDE HOLDINGS LLC',
      landlord_signatory: 'Alex Rivera',
      landlord_address:   '100 Example Ave., Sample City, NY 10001',
      landlord_phone:     '(555) 010-0100',
      landlord_email:     'demo.landlord@example.com',
    }
  }
  // B84 / default (Beach 84th St)
  return {
    landlord_entity:    'MEADOWBROOK PROPERTIES LLC',
    landlord_signatory: 'Demo Administrator',
    landlord_address:   '200 Example Ave., Sample City, NY 10001',
    landlord_phone:     '(555) 010-0200',
    landlord_email:     'demo.landlord@example.com',
  }
}

async function resolveTemplateType(
  noticeType: string,
  propertyAddress: string | null
): Promise<string> {
  if (noticeType !== 'notice_90day') return noticeType

  const addr = (propertyAddress ?? '').toLowerCase()
  const is8607 = addr.includes('8607') || addr.includes('101st') || addr.includes('101 st')
  const isB84  = addr.includes('beach') || addr.includes('84th') || addr.includes('338')

  const variantType = is8607 ? 'notice_90day_8607' : isB84 ? 'notice_90day_b84' : null
  if (!variantType) return noticeType

  const template = await prisma.legalTemplate.findFirst({
    where: { notice_type: variantType, is_active: true }
  })

  return template ? variantType : noticeType
}

export type NoticeContent = {
  renderedText: string
  templateTitle: string
  effectiveNoticeType: string
  tenantName: string
  unitDisplay: string | null
  leaseId: string | null
  propertyId: string | null
  attorneyEmail: string
  outstandingBalance: number
  templateData: Record<string, string>
}

export type NoticeContentResult =
  | { error: string; status: number }
  | { data: NoticeContent }

// Shared by the manual "generate notice" flow (api/generate-notice) and the
// automated daily-overdue draft creator — builds the filled-in notice text
// and everything needed to save it as a LegalNotice row, but doesn't save
// anything itself (callers decide the resulting `status`).
export async function buildNoticeContent(tenantId: string, noticeType: string): Promise<NoticeContentResult> {
  const settings = await prisma.systemSettings.findUnique({
    where: { id: 1 },
    select: { attorney_name: true, attorney_address: true, attorney_phone: true, attorney_email: true }
  })

  const attorneyName    = settings?.attorney_name    ?? 'Demo Law Offices, P.C.'
  const attorneyAddress = settings?.attorney_address ?? '300 Example Blvd., Sample City, NY 10001'
  const attorneyPhone   = settings?.attorney_phone   ?? '(555) 010-0300'
  const attorneyEmail   = settings?.attorney_email   ?? 'demo.attorney@example.com'

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, name: true, full_legal_name: true, case_number: true, address: true, unit_id: true }
  })
  if (!tenant) return { error: 'Tenant not found', status: 404 }

  // Property (from most recent lease — no separate units table)
  const propRow = await prisma.lease.findFirst({
    where: { tenant_id: tenantId },
    orderBy: { start_date: 'desc' },
    select: { id: true, property_id: true, property: { select: { id: true, name: true, address: true, nickname: true, city: true, state: true, zip: true } } }
  })

  let property: any = null
  let propertyId: string | null = null
  if (propRow) {
    property = propRow.property ? { ...propRow.property, city_state_zip: `${propRow.property.city ?? ''} ${propRow.property.state ?? ''} ${propRow.property.zip ?? ''}`.trim() } : null
    propertyId = propRow.property_id
  }

  const effectiveNoticeType = await resolveTemplateType(noticeType, property?.address ?? null)

  const template = await prisma.legalTemplate.findFirst({
    where: { notice_type: effectiveNoticeType, is_active: true },
    select: { id: true, title: true, body: true, notice_type: true }
  })
  if (!template) {
    return { error: `No active template found for "${effectiveNoticeType}".`, status: 404 }
  }

  const lease = await prisma.lease.findFirst({
    where: { tenant_id: tenantId },
    orderBy: { start_date: 'desc' },
    select: { id: true, rent_amount: true, start_date: true, end_date: true, status: true }
  })

  // view_rent_ledger gives one row per tenant per month. pending_balance is
  // already cumulative — take only the most recent month's row for the
  // balance itself, never sum across rows (that was the $108,852 Flemister
  // bug from before). total_due/total_paid are informational lifetime
  // totals for the notice text, so those genuinely do sum across months.
  const ledgerRows = await prisma.$queryRaw<any[]>`
    SELECT due_amount, paid_amount, pending_balance FROM view_rent_ledger
    WHERE tenant_id = ${tenantId} ORDER BY month ASC
  `
  const totalDue = ledgerRows.reduce((sum, r) => sum + Number(r.due_amount ?? 0), 0)
  const totalPaid = ledgerRows.reduce((sum, r) => sum + Number(r.paid_amount ?? 0), 0)
  const outstandingBalance = Math.max(0, Number(ledgerRows.at(-1)?.pending_balance ?? 0))

  const tenantTransactions = await prisma.transaction.findMany({
    where: { matched_tenant_id: tenantId, status: { in: ['verified', 'processing'] }, deleted_at: null },
    select: { extracted_amount: true, extracted_check_date: true, extracted_check_number: true }
  })

  const checkDetailList = tenantTransactions.length
    ? tenantTransactions
        .map((c) => `Check #${c.extracted_check_number ?? '—'} (${c.extracted_check_date ?? '—'}) — $${Number(c.extracted_amount || 0).toFixed(2)}`)
        .join('\n')
    : '(No checks recorded)'

  const checkDates = tenantTransactions
    .map((c) => c.extracted_check_date)
    .filter(Boolean)
    .sort() as string[]
  const periodStart = checkDates[0] ?? '—'
  const periodEnd = checkDates[checkDates.length - 1] ?? '—'

  const landlordInfo = getLandlordInfo(property?.address ?? null)

  const today = new Date()
  const todayStr = today.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  const cureDate = new Date(today)
  cureDate.setDate(cureDate.getDate() + 14)
  const cureByDate = cureDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  const vacateDate = new Date(today)
  vacateDate.setDate(vacateDate.getDate() + 90)
  const vacateByDate = vacateDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

  const unitLabel = property?.nickname
    ? (property.nickname.match(/[Uu]nit\s*(.+)$/)?.[1]?.trim() ?? property.nickname)
    : '—'
  const propertyLine = property
    ? `${property.address ?? property.name ?? ''}, ${property.city_state_zip ?? 'New York'}`
    : (tenant.address ?? '')

  const tplData: Record<string, string> = {
    notice_date:          todayStr,
    today_date:           todayStr,
    notice_year:          String(today.getFullYear()),
    cure_by_date:         cureByDate,
    vacate_by_date:       vacateByDate,
    tenant_name:          tenant.full_legal_name ?? tenant.name,
    full_legal_name:      tenant.full_legal_name ?? tenant.name,
    case_number:          tenant.case_number ?? '—',
    tenant_address:       tenant.address ?? propertyLine,
    property_address:     property?.address ?? tenant.address ?? '—',
    unit_number:          unitLabel,
    unit_address:         propertyLine,
    monthly_rent:         lease ? `$${Number(lease.rent_amount).toFixed(2)}` : '—',
    lease_start:          lease?.start_date ? new Date(lease.start_date).toLocaleDateString('en-US') : '—',
    lease_end:            lease?.end_date   ? new Date(lease.end_date).toLocaleDateString('en-US')   : 'Month-to-Month',
    outstanding_balance:  `$${outstandingBalance.toFixed(2)}`,
    balance_owed:         `$${outstandingBalance.toFixed(2)}`,
    total_due:            `$${totalDue.toFixed(2)}`,
    total_paid:           `$${totalPaid.toFixed(2)}`,
    period_start:         periodStart,
    period_end:           periodEnd,
    check_detail_list:    checkDetailList,
    landlord_name:        landlordInfo.landlord_signatory,
    landlord_entity:      landlordInfo.landlord_entity,
    landlord_signatory:   landlordInfo.landlord_signatory,
    landlord_address:     landlordInfo.landlord_address,
    landlord_phone:       landlordInfo.landlord_phone,
    landlord_email:       landlordInfo.landlord_email,
    attorney_name:        attorneyName,
    attorney_address:     attorneyAddress,
    attorney_phone:       attorneyPhone,
    attorney_email:       attorneyEmail,
  }

  return {
    data: {
      renderedText: fillTemplate(template.body as string, tplData),
      templateTitle: template.title,
      effectiveNoticeType,
      tenantName: tenant.name,
      unitDisplay: property ? `${property.nickname ?? property.name ?? property.address ?? '?'}` : null,
      leaseId: lease?.id ?? propRow?.id ?? null,
      propertyId,
      attorneyEmail,
      outstandingBalance,
      templateData: tplData,
    }
  }
}
