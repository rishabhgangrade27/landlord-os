-- LandlordOS PDF Jobs Migration — Run in Supabase SQL Editor BEFORE activating WF5

-- 1. pdf_jobs table
CREATE TABLE IF NOT EXISTS pdf_jobs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  job_type text NOT NULL CHECK (job_type IN ('notice', 'court_ledger')),
  reference_id uuid NOT NULL,
  html_content text,
  filename text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'done', 'failed')),
  pdf_url text,
  requested_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  error_message text
);

CREATE INDEX IF NOT EXISTS pdf_jobs_status_idx ON pdf_jobs (status, requested_at);

-- 2. Add pdf_url to legal_notices
ALTER TABLE legal_notices ADD COLUMN IF NOT EXISTS pdf_url text;

-- MANUAL STEPS:
-- 1. In Supabase Dashboard -> Storage -> New Bucket: Name=pdf-output, Public=YES
-- 2. In n8n -> Settings -> Environment Variables: SUPABASE_SERVICE_ROLE_KEY = <service role key>
