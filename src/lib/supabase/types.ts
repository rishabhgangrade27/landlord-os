// ─── Core Tables ────────────────────────────────────────────────────────────

export type Property = {
  id: string
  name: string | null
  address: string | null
  city: string | null
  state: string | null
  zip: string | null
  property_type: string | null
  status: string | null
  nickname: string | null
  created_at: string
}

export type Unit = {
  id: string
  property_id: string
  unit_number: string
  floor: number | null
  bedrooms: number | null
  bathrooms: number | null
  notes: string | null
  status: 'occupied' | 'vacant' | 'under_construction' | string
  created_at: string
}

export type Tenant = {
  id: string
  name: string
  full_legal_name: string | null
  case_number: string | null
  email: string | null
  phone: string | null
  address: string | null
  unit_id: string | null
  household_size: number | null
  ssn_encrypted: string | null
  state_id: string | null
  notes: string | null
  status: 'active' | 'moved_out' | string
  created_at: string
}

export type Lease = {
  id: string
  tenant_id: string
  property_id: string | null
  unit_id: string | null
  start_date: string
  end_date: string | null
  rent_amount: number
  status: 'active' | 'expired' | string
  notes: string | null
  created_at: string
}

export type Transaction = {
  id: string
  matched_tenant_id: string | null
  extracted_case_number: string | null
  extracted_check_number: string | null
  extracted_check_date: string | null
  extracted_amount: number | null
  extracted_rent_from: string | null
  extracted_rent_to: string | null
  ocr_confidence: number | null
  duplicate_suspected: boolean | null
  duplicate_reference_id: string | null
  page_number: number | null
  source_pdf_url: string | null
  file_bucket: string | null
  file_path: string | null
  review_notes: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  status:
    | 'uploaded'
    | 'processing'
    | 'needs_review'
    | 'verified'
    | 'rejected'
    | 'blank_detected'
    | 'deleted_blank'
    | 'duplicate_suspected'
    | string
  created_by: string | null
  created_at: string
}

export type MaintenanceTicket = {
  id: string
  title: string
  description: string | null
  category: 'plumbing' | 'electrical' | 'general' | 'other' | string
  priority: 'low' | 'medium' | 'high' | 'urgent' | string
  status:
    | 'reported'
    | 'reviewed'
    | 'assigned'
    | 'in_progress'
    | 'completed'
    | 'closed'
    | 'cancelled'
    | string
  tenant_id: string | null
  unit_id: string | null
  property_id: string | null
  assigned_contractor_id: string | null
  estimated_cost: number | null
  actual_cost: number | null
  cost_approved: boolean | null
  created_at: string
}

export type Contractor = {
  id: string
  name: string
  trade: string | null
  email: string | null
  phone: string | null
  address: string | null
  payment_method: string | null
  notes: string | null
  status: 'active' | 'inactive' | string
  created_at: string
}

export type Expense = {
  id: string
  property_id: string | null
  unit_id: string | null
  category:
    | 'electric'
    | 'water'
    | 'gas'
    | 'oil'
    | 'taxes'
    | 'mortgage'
    | 'contractor'
    | 'maintenance'
    | 'insurance'
    | 'other'
    | string
  description: string | null
  amount: number
  expense_date: string
  created_at: string
}

export type LegalNotice = {
  id: string
  tenant_id: string | null
  lease_id: string | null
  unit_id: string | null
  property_id: string | null
  notice_type:
    | 'non_payment_30day'
    | 'non_payment_60day'
    | 'notice_90day'
    | 'notice_90day_sunrise'
    | 'notice_90day_willow'
    | 'court_form'
    | 'court_form_nonpayment'
    | string
  reference_id: string | null
  rendered_text: string
  status:
    | 'draft'
    | 'generated'
    | 'pending_attorney'
    | 'attorney_reviewed'
    | 'sent'
    | 'cancelled'
    | string
  send_method: 'email' | 'print' | 'attorney' | string | null
  attorney_email: string | null
  sent_at: string | null
  admin_notes: string | null
  generated_at: string | null
  created_at: string
}

export type LegalTemplate = {
  id: string
  title: string
  notice_type: string
  body: string
  is_active: boolean
  created_at: string
}

export type SystemSettings = {
  id: number
  processing_mode: 'immediate' | 'scheduled'
  attorney_name: string | null
  attorney_address: string | null
  attorney_phone: string | null
  attorney_email: string | null
}

export type SystemError = {
  id: string
  workflow_name: string | null
  error_message: string | null
  error_data: Record<string, unknown> | null
  occurred_at: string
}

export type LegalHistory = {
  id: string
  notice_id: string | null
  entity_type: string | null
  entity_id: string | null
  action: string
  notice_type: string | null
  reference_id: string | null
  snapshot: Record<string, unknown> | null
  occurred_at: string
}

// ─── View Types ───────────────────────────────────────────────────────────────

export type RentLedgerRow = {
  tenant_id: string
  unit_id: string | null
  lease_id: string
  month: string
  due_amount: number
  paid_amount: number
  pending_balance: number
  carryover_from_previous: number
  flag_30_day: boolean
  flag_60_day: boolean
}

export type CourtLedgerRow = {
  tenant_id: string
  tenant_name: string | null
  case_number: string | null
  tenant_address: string | null
  unit_number: string | null
  property_address: string | null
  monthly_due: number | null
  lease_start: string | null
  lease_end: string | null
  month_label: string | null
  ledger_month: string | null
  check_number: string | null
  check_date: string | null
  amount: number | null
  running_monthly_total: number | null
  running_balance: number | null
}

export type PropertyTimelineRow = {
  unit_id: string
  unit_number: string
  property_id: string
  start_date: string
  end_date: string | null
  tenant_name: string | null
  rent_amount: number
  status: string
}

export type YearlyPaymentRow = {
  tenant_id: string
  unit_id: string | null
  year: number
  total_due: number
  total_paid: number
  total_balance: number
}

export type PropertyProfitRow = {
  property_id: string
  property_name: string | null
  address: string | null
  income: number
  expenses: number
  profit: number
}

export type MonthlyProfitRow = {
  month: string
  income: number
  expenses: number
  profit: number
}

// ─── Join / Extended Types ────────────────────────────────────────────────────

export type UnitWithProperty = Unit & {
  properties: Property | null
}

export type TenantWithUnit = Tenant & {
  units: (Unit & { properties: Property | null }) | null
}

export type LeaseWithTenantAndUnit = Lease & {
  tenants: Tenant | null
  units: (Unit & { properties: Property | null }) | null
}

export type TransactionWithTenant = Transaction & {
  tenants: Tenant | null
}

export type MaintenanceWithDetails = MaintenanceTicket & {
  units: Unit | null
  properties: Property | null
  contractors: Contractor | null
}
