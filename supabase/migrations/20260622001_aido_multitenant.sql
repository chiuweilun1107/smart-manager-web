-- AiDo 智行 — 多租戶 (multi-tenant) 架構預留
-- 目標：趁生產資料還少時，為每張業務表加 company_id，未來接多家公司零大改。
-- 策略：現階段只有一家公司 (id=1)，所有現有資料回填 company_id=1。
-- 之後接第二家公司時：INSERT companies + 設 RLS policy 即可，schema 不用再動。

-- ============ 1. companies 租戶主表 ============
CREATE TABLE IF NOT EXISTS aido.companies (
  id BIGSERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  legal_name TEXT,
  tax_id TEXT,
  status TEXT DEFAULT 'active',
  locale TEXT DEFAULT 'zh-TW',
  timezone TEXT DEFAULT 'Asia/Taipei',
  settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 第一家公司 (Allen 的公司)；id 固定為 1 作為現有資料的回填目標
INSERT INTO aido.companies (id, code, name)
VALUES (1, 'default', 'AiDo 智行')
ON CONFLICT (id) DO NOTHING;
-- 確保 sequence 不會再次產出 1
SELECT setval('aido.companies_id_seq', GREATEST((SELECT MAX(id) FROM aido.companies), 1), true);

-- ============ 2. 對所有業務表加 company_id (回填 1 → NOT NULL → FK → index) ============
-- 用 DO LOOP 涵蓋全部 43 張表，避免逐一手寫漏掉。
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
    'candidates','compliance_checks','ai_form_drafts'
  ];
BEGIN
  FOREACH t IN ARRAY tbls LOOP
    -- 2a. 加欄位 (冪等)
    EXECUTE format('ALTER TABLE aido.%I ADD COLUMN IF NOT EXISTS company_id BIGINT', t);
    -- 2b. 回填現有資料到第一家公司
    EXECUTE format('UPDATE aido.%I SET company_id = 1 WHERE company_id IS NULL', t);
    -- 2c. 設 NOT NULL (回填後才能設)
    EXECUTE format('ALTER TABLE aido.%I ALTER COLUMN company_id SET NOT NULL', t);
    -- 2d. 加 FK 到 companies (冪等：先嘗試刪同名 constraint 再加)
    EXECUTE format('ALTER TABLE aido.%I DROP CONSTRAINT IF EXISTS fk_%s_company', t, t);
    EXECUTE format('ALTER TABLE aido.%I ADD CONSTRAINT fk_%s_company FOREIGN KEY (company_id) REFERENCES aido.companies(id)', t, t);
    -- 2e. 加 index (RLS / query filter 用)
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_aido_%s_company ON aido.%I(company_id)', t, t);
  END LOOP;
END $$;

-- ============ 3. company-scoped 唯一鍵調整 ============
-- 原本 UNIQUE(code) 等全域唯一鍵，多租戶下應改成 (company_id, code) 唯一。
-- 現階段單一公司不衝突，但先把最關鍵的幾個改成複合唯一，避免未來第二家公司的
-- 部門 code / employee_no 撞到第一家。email 維持全域唯一 (auth 層綁定)。
ALTER TABLE aido.departments DROP CONSTRAINT IF EXISTS departments_code_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_aido_departments_company_code
  ON aido.departments(company_id, code) WHERE code IS NOT NULL;

ALTER TABLE aido.users DROP CONSTRAINT IF EXISTS users_employee_no_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_aido_users_company_empno
  ON aido.users(company_id, employee_no) WHERE employee_no IS NOT NULL;

-- 註：roles.code 維持全域唯一 (系統角色跨公司共用語意)；如未來要 per-company
-- 自訂角色，再改成 (company_id, code)。
