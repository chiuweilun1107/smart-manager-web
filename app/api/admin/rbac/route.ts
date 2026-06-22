import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdminUser } from '@/lib/api-guard'

// GET /api/admin/rbac
// 回傳該公司的 roles 清單 + role_permissions + role_field_access
export async function GET() {
  const { user, error: authErr } = await requireAdminUser()
  if (authErr) return authErr
  const db = createServiceClient().schema('aido')

  const [rolesResult, permsResult, fieldResult] = await Promise.all([
    db.from('roles')
      .select('id, code, name, level, is_system')
      .eq('company_id', user.companyId)
      .order('level', { ascending: true }),
    db.from('role_permissions')
      .select('id, role_code, module_code, visible, actions, read_scope')
      .eq('company_id', user.companyId),
    db.from('role_field_access')
      .select('id, role_code, field_key, allowed')
      .eq('company_id', user.companyId),
  ])

  if (rolesResult.error) return NextResponse.json({ error: rolesResult.error.message }, { status: 500 })
  if (permsResult.error) return NextResponse.json({ error: permsResult.error.message }, { status: 500 })
  if (fieldResult.error) return NextResponse.json({ error: fieldResult.error.message }, { status: 500 })

  return NextResponse.json({
    roles: rolesResult.data ?? [],
    permissions: permsResult.data ?? [],
    field_access: fieldResult.data ?? [],
  })
}

// PUT /api/admin/rbac
// upsert 一筆 role_permission: { role_code, module_code, visible, actions, read_scope }
export async function PUT(req: NextRequest) {
  const { user, error: authErr } = await requireAdminUser()
  if (authErr) return authErr
  const body = await req.json()
  const { role_code, module_code, visible, actions, read_scope } = body

  if (!role_code || !module_code) {
    return NextResponse.json({ error: '缺少 role_code 或 module_code' }, { status: 400 })
  }

  const db = createServiceClient().schema('aido')
  const { data, error } = await db
    .from('role_permissions')
    .upsert(
      {
        company_id: user.companyId,
        role_code,
        module_code,
        visible: visible ?? false,
        actions: actions ?? [],
        read_scope: read_scope ?? 'self',
      },
      { onConflict: 'company_id,role_code,module_code' }
    )
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ permission: data })
}

// POST /api/admin/rbac
// upsert role_field_access: { role_code, field_key, allowed }
export async function POST(req: NextRequest) {
  const { user, error: authErr } = await requireAdminUser()
  if (authErr) return authErr
  const body = await req.json()
  const { role_code, field_key, allowed } = body

  if (!role_code || !field_key) {
    return NextResponse.json({ error: '缺少 role_code 或 field_key' }, { status: 400 })
  }

  const db = createServiceClient().schema('aido')
  const { data, error } = await db
    .from('role_field_access')
    .upsert(
      {
        company_id: user.companyId,
        role_code,
        field_key,
        allowed: allowed ?? false,
      },
      { onConflict: 'company_id,role_code,field_key' }
    )
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ field_access: data })
}
