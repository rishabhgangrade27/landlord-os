import { prisma } from '@/lib/db'
import { buildNoticeContent } from '@/lib/legal-notice'

// Business-logic mapping from ledger flag -> which template to auto-draft.
// This is a default, not yet confirmed with the client (see SCRATCHPAD.md Phase 3) —
// safe because these are DRAFT-only, never auto-sent, always reviewed by hand.
//   30-day flag only  -> notice_30day  (landlord's own reminder, not court)
//   60-day flag       -> notice_14day  (court-track escalation)
const NOTICE_TYPE_FOR_60_DAY = 'notice_14day'
const NOTICE_TYPE_FOR_30_DAY = 'notice_30day'

// Don't draft another notice of the same type for the same tenant if one was
// already created in this window — daily-cron-safe debounce.
const DEBOUNCE_DAYS = 25

export type OverdueCheckResult = {
  checked: number
  flagged: number
  drafted: { tenantId: string; tenantName: string; noticeType: string; noticeId: string }[]
  skipped: { tenantId: string; tenantName: string; noticeType: string; reason: string }[]
}

// Scans the latest ledger month for every tenant, and for anyone crossing the
// 30- or 60-day overdue threshold, creates a DRAFT legal notice if one of the
// matching type doesn't already exist recently. Never sends anything —
// drafts sit in /legal-notices for manual review, per the hard app rule.
export async function runDailyOverdueCheck(): Promise<OverdueCheckResult> {
  // One row per tenant: their most recent ledger month (mirrors the
  // "take ledgerRows[0], never sum" rule used everywhere else in the app).
  const latestRows = await prisma.$queryRaw<any[]>`
    SELECT DISTINCT ON (tenant_id) tenant_id, tenant_name, month, pending_balance, flag_30_day, flag_60_day
    FROM view_rent_ledger
    ORDER BY tenant_id, month DESC
  `

  const flaggedRows = latestRows.filter((r) => r.flag_30_day)

  const result: OverdueCheckResult = { checked: latestRows.length, flagged: flaggedRows.length, drafted: [], skipped: [] }

  const debounceSince = new Date()
  debounceSince.setDate(debounceSince.getDate() - DEBOUNCE_DAYS)

  for (const row of flaggedRows) {
    const noticeType = row.flag_60_day ? NOTICE_TYPE_FOR_60_DAY : NOTICE_TYPE_FOR_30_DAY
    const tenantId = row.tenant_id as string
    const tenantName = (row.tenant_name as string) ?? tenantId

    const existing = await prisma.legalNotice.findFirst({
      where: {
        tenant_id: tenantId,
        notice_type: noticeType,
        created_at: { gte: debounceSince },
      },
      select: { id: true },
    })
    if (existing) {
      result.skipped.push({ tenantId, tenantName, noticeType, reason: `already drafted within the last ${DEBOUNCE_DAYS} days` })
      continue
    }

    const content = await buildNoticeContent(tenantId, noticeType)
    if ('error' in content) {
      result.skipped.push({ tenantId, tenantName, noticeType, reason: content.error })
      continue
    }

    const referenceId = `LN-AUTO-${Date.now()}-${tenantId.slice(0, 8)}`
    const notice = await prisma.legalNotice.create({
      data: {
        tenant_id: tenantId,
        lease_id: content.data.leaseId,
        unit_id: null,
        property_id: content.data.propertyId,
        notice_type: content.data.effectiveNoticeType,
        reference_id: referenceId,
        rendered_text: content.data.renderedText,
        status: 'draft',
        attorney_email: content.data.attorneyEmail,
        admin_notes: `Auto-drafted by daily overdue check — ${row.flag_60_day ? '60' : '30'}-day flag, balance $${Number(row.pending_balance).toFixed(2)}.`,
      },
    })

    result.drafted.push({ tenantId, tenantName, noticeType: content.data.effectiveNoticeType, noticeId: notice.id })
  }

  return result
}
