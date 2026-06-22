import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getSessionUser } from '@/lib/session'

// GET /api/admin/workflows — 列該 company 所有 approval_chain_templates + roles 清單
export async function GET() {
  const user = await getSessionUser()
  const db = createServiceClient().schema('aido')

  const [tplResult, rolesResult] = await Promise.all([
    db.from('approval_chain_templates')
      .select('id, chain_code, name, module_code, amount_field, steps_json, is_active, created_at')
      .eq('company_id', user.companyId)
      .order('created_at', { ascending: true }),
    db.from('roles')
      .select('id, code, name')
      .eq('company_id', user.companyId)
      .order('name', { ascending: true }),
  ])

  if (tplResult.error) return NextResponse.json({ error: tplResult.error.message }, { status: 500 })
  if (rolesResult.error) return NextResponse.json({ error: rolesResult.error.message }, { status: 500 })

  return NextResponse.json({
    templates: tplResult.data ?? [],
    roles: rolesResult.data ?? [],
  })
}

// POST /api/admin/workflows — 新增流程
export async function POST(req: NextRequest) {
  const user = await getSessionUser()
  const body = await req.json()
  const { chain_code, name, module_code, amount_field, steps_json } = body

  if (!chain_code) return NextResponse.json({ error: 'chain_code 為必填' }, { status: 400 })
  if (!name) return NextResponse.json({ error: '流程名稱為必填' }, { status: 400 })

  const db = createServiceClient().schema('aido')

  const { data, error } = await db.from('approval_chain_templates').insert({
    company_id: user.companyId,
    chain_code: chain_code.trim(),
    name: name.trim(),
    module_code: module_code || null,
    amount_field: amount_field || 'amount',
    steps_json: steps_json ?? [],
    is_active: true,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ template: data }, { status: 201 })
}

// PUT /api/admin/workflows — 更新流程
export async function PUT(req: NextRequest) {
  const user = await getSessionUser()
  const body = await req.json()
  const { id, name, module_code, amount_field, steps_json, is_active } = body

  if (!id) return NextResponse.json({ error: 'id 為必填' }, { status: 400 })

  const db = createServiceClient().schema('aido')

  const patch: Record<string, unknown> = {}
  if (name !== undefined) patch.name = name
  if (module_code !== undefined) patch.module_code = module_code
  if (amount_field !== undefined) patch.amount_field = amount_field
  if (steps_json !== undefined) patch.steps_json = steps_json
  if (is_active !== undefined) patch.is_active = is_active

  const { data, error } = await db.from('approval_chain_templates')
    .update(patch)
    .eq('id', id)
    .eq('company_id', user.companyId)
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ template: data })
}

// DELETE /api/admin/workflows?id=xxx
export async function DELETE(req: NextRequest) {
  const user = await getSessionUser()
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id 為必填' }, { status: 400 })

  const db = createServiceClient().schema('aido')

  const { error } = await db.from('approval_chain_templates')
    .delete()
    .eq('id', id)
    .eq('company_id', user.companyId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
