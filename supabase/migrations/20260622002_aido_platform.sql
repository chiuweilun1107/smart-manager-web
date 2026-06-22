-- AiDo 平台化 Phase 2-10: 對外整合表 + company-scoped RLS policy

-- ============ 1. 對外整合: api_keys + webhooks ============
CREATE TABLE IF NOT EXISTS aido.api_keys (
  id BIGSERIAL PRIMARY KEY,
  company_id BIGINT NOT NULL REFERENCES aido.companies(id),
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL,
  scopes TEXT[] DEFAULT ARRAY['read'],
  created_by_user_id BIGINT REFERENCES aido.users(id),
  last_used_at TIMESTAMPTZ,
  revoked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_aido_apikeys_company ON aido.api_keys(company_id);

CREATE TABLE IF NOT EXISTS aido.webhooks (
  id BIGSERIAL PRIMARY KEY,
  company_id BIGINT NOT NULL REFERENCES aido.companies(id),
  url TEXT NOT NULL,
  events TEXT[] DEFAULT ARRAY['request.approved'],
  secret TEXT,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_aido_webhooks_company ON aido.webhooks(company_id);

-- ============ 2. company-scoped RLS ============
-- helper: 取當前登入者 (auth.uid) 對應的 company_id
CREATE OR REPLACE FUNCTION aido.current_company_id() RETURNS BIGINT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = aido AS $fn$
  SELECT company_id FROM aido.users WHERE auth_user_id = auth.uid() LIMIT 1
$fn$;

-- 對所有業務表加 company_isolation policy (authenticated 只能看自己 company)
-- app 全走 service_role (bypass RLS)，此 policy 防 anon/authenticated 直連竊取跨租戶資料
DO $$
DECLARE
  t TEXT;
  tbls TEXT[] := ARRAY[
    'roles','departments','positions','users','user_roles',
    'form_definitions','requests','approval_steps','approval_actions',
    'audit_logs','notifications','notification_preferences','user_profiles',
    'user_delegates','user_files','leave_types','leave_balances','schedules',
    'attendance_records','attendance_corrections','overtime_records',
    'payroll_runs','payslips','assets','contracts','announcements',
    'knowledge_docs','benefit_claims','er_cases','headcount',
    'personnel_changes','compensation_changes','expense_claims',
    'purchase_orders','seal_requests','it_tickets','onboarding_cases',
    'offboarding_cases','performance_reviews','training_records',
    'candidates','compliance_checks','ai_form_drafts','api_keys','webhooks'
  ];
BEGIN
  FOREACH t IN ARRAY tbls LOOP
    EXECUTE format('ALTER TABLE aido.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS company_isolation ON aido.%I', t);
    EXECUTE format('CREATE POLICY company_isolation ON aido.%I FOR ALL TO authenticated USING (company_id = aido.current_company_id())', t);
  END LOOP;
END $$;

-- companies 表本身: authenticated 只能看自己那筆
ALTER TABLE aido.companies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS company_self ON aido.companies;
CREATE POLICY company_self ON aido.companies FOR ALL TO authenticated USING (id = aido.current_company_id());
