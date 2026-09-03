-- Anonymization script for the demo/portfolio branch.
-- Run ONLY against a disposable copy of the database (e.g. `landlordos_demo`),
-- never against the real client database. Preserves row counts, relationships,
-- dates, and dollar amounts; replaces identity-bearing fields with fictional
-- but realistically-shaped placeholders, keyed by a stable per-row sequence
-- so a tenant's name/case_number/SSN stay consistent with each other.

BEGIN;

WITH numbered AS (
  SELECT id, row_number() OVER (ORDER BY id) AS rn FROM "Tenant"
)
UPDATE "Tenant" t SET
  name            = 'Sample Tenant ' || lpad(n.rn::text, 2, '0'),
  full_legal_name = CASE WHEN t.full_legal_name IS NOT NULL THEN 'Sample Tenant ' || lpad(n.rn::text, 2, '0') ELSE NULL END,
  email           = CASE WHEN t.email IS NOT NULL THEN 'tenant' || lpad(n.rn::text, 2, '0') || '@example.com' ELSE NULL END,
  phone           = CASE WHEN t.phone IS NOT NULL THEN '(555) 010-' || lpad((1000 + n.rn)::text, 4, '0') ELSE NULL END,
  address         = CASE WHEN t.address IS NOT NULL THEN (100 + n.rn) || ' Example Ave, Sample City, NY 10001' ELSE NULL END,
  ssn_encrypted   = CASE WHEN t.ssn_encrypted IS NOT NULL THEN lpad(n.rn::text, 3, '0') || '-00-' || lpad(n.rn::text, 4, '0') ELSE NULL END,
  state_id        = CASE WHEN t.state_id IS NOT NULL THEN 'DEMO' || lpad(n.rn::text, 6, '0') ELSE NULL END,
  case_number     = CASE WHEN t.case_number IS NOT NULL THEN 'SAMPLE-' || lpad(n.rn::text, 4, '0') ELSE NULL END,
  notes           = CASE WHEN t.notes IS NOT NULL THEN 'Sample notes for demo tenant ' || n.rn ELSE NULL END
FROM numbered n WHERE t.id = n.id;

-- Keep Transaction.extracted_case_number consistent with the tenant it's matched to.
UPDATE "Transaction" tx SET extracted_case_number = t.case_number
FROM "Tenant" t WHERE tx.matched_tenant_id = t.id;

UPDATE "Transaction" SET extracted_case_number = 'SAMPLE-UNMATCHED'
WHERE matched_tenant_id IS NULL AND extracted_case_number IS NOT NULL;

UPDATE "Transaction" SET
  review_notes      = CASE WHEN review_notes      IS NOT NULL THEN 'Sample review note' ELSE NULL END,
  reviewed_by       = CASE WHEN reviewed_by       IS NOT NULL THEN 'demo-admin' ELSE NULL END,
  created_by        = CASE WHEN created_by        IS NOT NULL THEN 'demo-admin' ELSE NULL END,
  updated_by        = CASE WHEN updated_by        IS NOT NULL THEN 'demo-admin' ELSE NULL END,
  status_changed_by = CASE WHEN status_changed_by IS NOT NULL THEN 'demo-admin' ELSE NULL END,
  processed_by      = CASE WHEN processed_by      IS NOT NULL THEN 'demo-admin' ELSE NULL END,
  source_pdf_url    = CASE WHEN source_pdf_url    IS NOT NULL THEN 'demo/sample-receipt.pdf' ELSE NULL END,
  file_path         = CASE WHEN file_path         IS NOT NULL THEN 'demo/sample-receipt.pdf' ELSE NULL END;

WITH numbered AS (
  SELECT id, row_number() OVER (ORDER BY id) AS rn FROM "Property"
)
UPDATE "Property" p SET
  name       = CASE WHEN p.name     IS NOT NULL THEN 'Sample Property ' || n.rn ELSE NULL END,
  nickname   = CASE WHEN p.nickname IS NOT NULL THEN 'Sample Property ' || n.rn ELSE NULL END,
  address    = CASE WHEN p.address  IS NOT NULL THEN (300 + n.rn * 10) || ' Example St' ELSE NULL END,
  city       = CASE WHEN p.city     IS NOT NULL THEN 'Sample City' ELSE NULL END,
  state      = CASE WHEN p.state    IS NOT NULL THEN 'NY' ELSE NULL END,
  zip        = CASE WHEN p.zip      IS NOT NULL THEN '10001' ELSE NULL END,
  created_by = CASE WHEN p.created_by IS NOT NULL THEN 'demo-admin' ELSE NULL END
FROM numbered n WHERE p.id = n.id;

WITH numbered AS (
  SELECT id, row_number() OVER (ORDER BY id) AS rn FROM "Contractor"
)
UPDATE "Contractor" c SET
  name    = 'Sample Contractor ' || n.rn,
  email   = CASE WHEN c.email   IS NOT NULL THEN 'contractor' || n.rn || '@example.com' ELSE NULL END,
  phone   = CASE WHEN c.phone   IS NOT NULL THEN '(555) 020-' || lpad((1000 + n.rn)::text, 4, '0') ELSE NULL END,
  address = CASE WHEN c.address IS NOT NULL THEN (400 + n.rn) || ' Example Rd, Sample City, NY 10001' ELSE NULL END,
  notes   = CASE WHEN c.notes   IS NOT NULL THEN 'Sample contractor notes' ELSE NULL END
FROM numbered n WHERE c.id = n.id;

UPDATE "LegalNotice" SET
  rendered_text  = '[Sample notice content — demo data, full text withheld]',
  admin_notes    = CASE WHEN admin_notes IS NOT NULL THEN 'Sample admin note' ELSE NULL END,
  attorney_email = 'demo.attorney@example.com';

UPDATE "SystemSettings" SET
  attorney_name    = 'Demo Law Offices, P.C.',
  attorney_address = '300 Example Blvd., Sample City, NY 10001',
  attorney_phone   = '(555) 010-0300',
  attorney_email   = 'demo.attorney@example.com';

UPDATE "SystemError" SET
  raw_payload = CASE WHEN raw_payload IS NOT NULL THEN '{"note":"sample payload redacted for demo"}' ELSE NULL END;

UPDATE "LegalHistory" SET
  snapshot = CASE WHEN snapshot IS NOT NULL THEN '{"note":"sample snapshot redacted for demo"}' ELSE NULL END;

UPDATE "pdf_jobs" SET
  html_content = CASE WHEN html_content IS NOT NULL THEN '<p>Sample content</p>' ELSE NULL END,
  filename     = CASE WHEN filename     IS NOT NULL THEN 'sample-document.pdf' ELSE NULL END,
  pdf_url      = CASE WHEN pdf_url      IS NOT NULL THEN 'https://example.com/sample-document.pdf' ELSE NULL END;

-- Free-text fields written by a human, liberally reference real tenants/dates/
-- events by name — blanket-genericize every one of them rather than trying to
-- guess which specific notes are "safe."
UPDATE "Unit" SET
  notes = CASE WHEN notes IS NOT NULL THEN 'Sample unit notes' ELSE NULL END;

UPDATE "Lease" SET
  notes = CASE WHEN notes IS NOT NULL THEN 'Sample lease notes' ELSE NULL END;

UPDATE "MaintenanceTicket" SET
  description = CASE WHEN description IS NOT NULL THEN 'Sample maintenance description' ELSE NULL END;

COMMIT;
