import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { authBearerUser, companyOf, jsonCors, preflight } from '@/lib/agent-auth'

export async function OPTIONS(req: NextRequest) { return preflight(req) }

// GET /api/v1/directory/[id] — Bearer JWT 版單一成員通訊錄個人資料卡（同公司任何登入者可讀）。
// 鏡像 cookie 版 /api/directory/[id]，唯身分改 authBearerUser；只露通訊錄安全欄位
// （手機 / 英文名 / 部門 / 職稱 / 主管 / 到職日），national_id / bank / address /
// birth_date / emergency_contact 等敏感 HR 資料一律不回傳。
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await authBearerUser(req)
  if (!user) return jsonCors(req, { error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const uid = Number(id)
  if (!uid) return jsonCors(req, { error: '缺少成員 id' }, { status: 400 })

  const companyId = companyOf(user)
  const db = createServiceClient().schema('aido')

  const { data: u } = await db
    .from('users')
    .select(`
      id, employee_no, display_name, email, status,
      hired_at, manager_user_id,
      departments:department_id(id, name),
      positions:position_id(id, title, grade),
      roles:primary_role_id(id, name)
    `)
    .eq('id', uid)
    .eq('company_id', companyId)
    .single()

  if (!u) return jsonCors(req, { error: '找不到成員' }, { status: 404 })

  const pick = <T,>(rel: T | T[] | null): T | null => (Array.isArray(rel) ? rel[0] ?? null : rel)
  const dept = pick(u.departments) as { name?: string } | null
  const pos = pick(u.positions) as { title?: string; grade?: string } | null
  const role = pick(u.roles) as { name?: string } | null

  // 主管姓名（鎖 company_id）
  let manager_name: string | null = null
  if (u.manager_user_id) {
    const { data: m } = await db
      .from('users')
      .select('display_name')
      .eq('id', u.manager_user_id)
      .eq('company_id', companyId)
      .single()
    manager_name = m?.display_name ?? null
  }

  // 個人檔（只取通訊錄安全欄位：手機、英文名）
  const { data: profile } = await db
    .from('user_profiles')
    .select('mobile, english_name')
    .eq('user_id', uid)
    .maybeSingle()

  const member = {
    id: u.id,
    employee_no: u.employee_no,
    display_name: u.display_name,
    english_name: profile?.english_name ?? null,
    email: u.email,
    mobile: profile?.mobile ?? null,
    status: u.status,
    hired_at: u.hired_at,
    department_name: dept?.name ?? null,
    position_title: pos?.title ?? null,
    role_name: role?.name ?? null,
    manager_name,
  }

  return jsonCors(req, { member })
}
