import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getSessionUser } from '@/lib/session'

// GET /api/directory — 全員通訊錄列表（同公司在職成員，任何登入者可讀）
export async function GET() {
  const user = await getSessionUser()
  const db = createServiceClient().schema('aido')

  const { data, error } = await db
    .from('users')
    .select(`
      id, employee_no, display_name, email, status,
      department_id, position_id, manager_user_id,
      departments:department_id(id, name),
      positions:position_id(id, title),
      roles:primary_role_id(id, name)
    `)
    .eq('company_id', user.companyId)
    .neq('status', 'resigned')
    .order('employee_no', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 補主管姓名（鎖 company_id 防跨租戶洩漏）
  const managerIds = [...new Set((data ?? []).map(u => u.manager_user_id).filter(Boolean) as number[])]
  const managerMap: Record<number, string> = {}
  if (managerIds.length > 0) {
    const { data: managers } = await db
      .from('users')
      .select('id, display_name')
      .in('id', managerIds)
      .eq('company_id', user.companyId)
    for (const m of managers ?? []) managerMap[m.id] = m.display_name
  }

  const pick = <T,>(rel: T | T[] | null): T | null => (Array.isArray(rel) ? rel[0] ?? null : rel)

  const members = (data ?? []).map(u => {
    const dept = pick(u.departments) as { name?: string } | null
    const pos = pick(u.positions) as { title?: string } | null
    const role = pick(u.roles) as { name?: string } | null
    return {
      id: u.id,
      employee_no: u.employee_no,
      display_name: u.display_name,
      email: u.email,
      status: u.status,
      department_id: u.department_id,
      department_name: dept?.name ?? null,
      position_title: pos?.title ?? null,
      role_name: role?.name ?? null,
      manager_name: u.manager_user_id ? managerMap[u.manager_user_id] ?? null : null,
    }
  })

  return NextResponse.json({ members })
}
