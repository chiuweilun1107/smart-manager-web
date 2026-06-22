import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getSessionUser } from '@/lib/session'

const ADMIN_ROLES = ['admin', 'hr', 'executive', 'it']
function requireAdmin(roleCode: string) {
  return ADMIN_ROLES.includes(roleCode)
    ? null
    : NextResponse.json({ error: '無操作權限' }, { status: 403 })
}

// GET /api/admin/positions — 列出全部職位
export async function GET() {
  const user = await getSessionUser()
  const denied = requireAdmin(user.roleCode)
  if (denied) return denied
  const db = createServiceClient().schema('aido')

  const { data, error } = await db
    .from('positions')
    .select('id, code, title, grade, job_family, is_manager, status, created_at')
    .eq('company_id', user.companyId)
    .order('grade', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ positions: data ?? [] })
}

// POST /api/admin/positions — 新增職位
export async function POST(req: NextRequest) {
  const user = await getSessionUser()
  const denied = requireAdmin(user.roleCode)
  if (denied) return denied
  const body = await req.json()
  const { code, title, grade, job_family, is_manager, status } = body

  if (!title) return NextResponse.json({ error: '職位名稱為必填' }, { status: 400 })

  const db = createServiceClient().schema('aido')
  const { data, error } = await db
    .from('positions')
    .insert({
      company_id: user.companyId,
      code: code ?? null,
      title,
      grade: grade ?? null,
      job_family: job_family ?? null,
      is_manager: is_manager ?? false,
      status: status ?? 'active',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ position: data })
}

// PUT /api/admin/positions — 編輯職位
export async function PUT(req: NextRequest) {
  const user = await getSessionUser()
  const denied = requireAdmin(user.roleCode)
  if (denied) return denied
  const body = await req.json()
  const { id, code, title, grade, job_family, is_manager, status } = body

  if (!id) return NextResponse.json({ error: '缺少 id' }, { status: 400 })
  if (!title) return NextResponse.json({ error: '職位名稱為必填' }, { status: 400 })

  const db = createServiceClient().schema('aido')
  const { data, error } = await db
    .from('positions')
    .update({
      code: code ?? null,
      title,
      grade: grade ?? null,
      job_family: job_family ?? null,
      is_manager: is_manager ?? false,
      status: status ?? 'active',
    })
    .eq('id', id)
    .eq('company_id', user.companyId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ position: data })
}
