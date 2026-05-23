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

  // ── Template ────────────────────────────────────────────────────────────────
  const { data: template } = await supabase
    .from('legal_templates')
    .select('id, title, body, notice_type')
    .eq('notice_type', notice_type)
    .eq('is_active', true)
    .single()

  if (!template) {
    return NextResponse.json({
      error: `No active template found for "${notice_type}". Run the legal_templates INSERT script in Supabase first.`,
    }, { status: 404 })
  }

  // ── Tenant ──────────────────────────────────────────────────────────────────
  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, name, full_legal_name, case_number, address, unit_id')
    .eq('id', tenant_id)
    .single()

  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })

  // ── Unit + Property ─────────────────────────────────────────────────────────
  let unit: any = null
  let property: any = null

  if (tenant.unit_id) {
    const { data: unitData } = await supabase
      .from('units')
      .select('id, unit_number, property_id, properties(id, name, address, city_state_zip)')
      .eq('id', tenant.unit_id)
      .single()
    if (unitData) {
      unit = unitData
      property = (unitData as any).properties
    }
  }

  // ── Active Lease ────────────────────────────────────────────────────────────
  const { data: lease } = await supabase
    .from('leases')
    .select('id, rent_amount, start_date, end_date, status')
    .eq('tenant_id', tenant_id)
    .order('start_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  // ── Ledger: outstanding balance (pending rows only) ─────────────────────────
  const { data: ledgerRows } = await supabase
    .from('view_rent_ledger')
    .select('month, due_amount, paid_amount, pending_balance')
    .eq('tenant_id', tenant_id)
    .gt('pending_balance', 0)
    .order('month', { ascending: false })

  const totalBalance = ledgerRows?.reduce((s, r) => s + Number(r.pending_balance || 0), 0) ?? 0

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

  // ── Build template data — matches WF4 Code — Fill Template placeholders ─────
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  const propertyLine = property
    ? `${property.name ?? property.address ?? ''}, Unit ${unit?.unit_number ?? ''}, ${property.city_state_zip ?? 'New York'}`
    : (tenant.address ?? '')

  const outstandingBalance = (yearly?.total_balance ?? totalBalance)
  const totalDue = Number(yearly?.total_due ?? 0)
  const totalPaid = Number(yearly?.total_paid ?? 0)

  const tplData: Record<string, string> = {
    // ── WF4 canonical placeholder names (used by Workflow 4 and the SQL templates) ──
    notice_date:          today,
    tenant_name:          tenant.full_legal_name ?? tenant.name,
    case_number:          tenant.case_number ?? '—',
    property_address:     property?.name ?? property?.address ?? tenant.address ?? '—',
    unit_number:          unit?.unit_number ?? '—',
    monthly_rent:         lease ? `$${Number(lease.rent_amount).toFixed(2)}` : '—',
    outstanding_balance:  `$${Number(outstandingBalance).toFixed(2)}`,
    total_due:            `$${totalDue.toFixed(2)}`,
    total_paid:           `$${totalPaid.toFixed(2)}`,
    period_start:         periodStart,
    period_end:           periodEnd,
    check_detail_list:    checkDetailList,
    lease_start:          lease?.start_date ? new Date(lease.start_date).toLocaleDateString('en-US') : '—',
    lease_end:            lease?.end_date   ? new Date(lease.end_date).toLocaleDateString('en-US')   : 'Month-to-Month',
    // ── Aliases kept for any legacy template content ──────────────────────────
    today_date:           today,
    full_legal_name:      tenant.full_legal_name ?? tenant.name,
    unit_address:         propertyLine,
    tenant_address:       tenant.address ?? propertyLine,
    balance_owed:         `$${Number(outstandingBalance).toFixed(2)}`,
    landlord_name:        'Sonu Gupta',
  }

  const renderedText = fillTemplate(template.body as string, tplData)

  // ── Preview mode ────────────────────────────────────────────────────────────
  if (!confirm) {
    return NextResponse.json({
      rendered_text: renderedText,
      template_title: template.title,
      tenant_name: tenant.name,
      unit_display: unit
        ? `${property?.name ?? property?.address ?? '?'} / ${unit.unit_number}`
        : null,
    })
  }

  // ── Confirm: insert into legal_notices ──────────────────────────────────────
  const referenceId = `LN-${Date.now()}`

  const { data: notice, error: insertError } = await supabase
    .from('legal_notices')
    .insert({
      tenant_id,
      lease_id: lease?.id ?? null,
      unit_id: unit?.id ?? null,
      property_id: unit?.property_id ?? null,
      notice_type,
      reference_id: referenceId,
      rendered_text: renderedText,
      status: 'generated',
      generated_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json({ notice_id: notice.id, reference_id: referenceId })
}
