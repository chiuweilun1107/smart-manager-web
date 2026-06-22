import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getSessionUser } from '@/lib/session'
import type { ModuleField, ModuleColumn } from '@/lib/modules'

// GET /api/admin/forms — 列出該 company 所有 form_definitions
export async function GET() {
  const user = await getSessionUser()
  const db = createServiceClient().schema('aido')

  const { data, error } = await db
    .from('form_definitions')
    .select('id, company_id, module_code, form_code, name, version, is_active, fields_json, columns_json, chain_code, icon, group_name, sort_order, created_at, updated_at')
    .eq('company_id', user.companyId)
    .order('sort_order', { ascending: true })
    .order('id', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ forms: data ?? [] })
}

// POST /api/admin/forms — 新增表單
export async function POST(req: NextRequest) {
  const user = await getSessionUser()
  const body = await req.json()
  const { module_code, form_code, name, icon, group_name, chain_code, sort_order } = body

  if (!module_code) return NextResponse.json({ error: 'module_code 為必填' }, { status: 400 })
  if (!form_code) return NextResponse.json({ error: 'form_code 為必填' }, { status: 400 })
  if (!name) return NextResponse.json({ error: '表單名稱為必填' }, { status: 400 })

  const db = createServiceClient().schema('aido')
  const { data, error } = await db
    .from('form_definitions')
    .insert({
      company_id: user.companyId,
      module_code,
      form_code,
      name,
      version: 1,
      is_active: true,
      fields_json: [] as ModuleField[],
      columns_json: [] as ModuleColumn[],
      chain_code: chain_code ?? null,
      icon: icon ?? null,
      group_name: group_name ?? null,
      sort_order: sort_order ?? 0,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ form: data })
}

// PUT /api/admin/forms — 編輯表單（主要存 fields_json/columns_json/name/chain_code/is_active）
export async function PUT(req: NextRequest) {
  const user = await getSessionUser()
  const body = await req.json()
  const { id, name, icon, group_name, chain_code, is_active, fields_json, columns_json, sort_order } = body

  if (!id) return NextResponse.json({ error: '缺少 id' }, { status: 400 })

  const db = createServiceClient().schema('aido')

  // 確認此表單屬於當前公司
  const { data: existing } = await db
    .from('form_definitions')
    .select('id')
    .eq('id', id)
    .eq('company_id', user.companyId)
    .single()
  if (!existing) return NextResponse.json({ error: '找不到表單' }, { status: 404 })

  const patch: Record<string, unknown> = {}
  if (name !== undefined) patch.name = name
  if (icon !== undefined) patch.icon = icon
  if (group_name !== undefined) patch.group_name = group_name
  if (chain_code !== undefined) patch.chain_code = chain_code
  if (is_active !== undefined) patch.is_active = is_active
  if (fields_json !== undefined) patch.fields_json = fields_json
  if (columns_json !== undefined) patch.columns_json = columns_json
  if (sort_order !== undefined) patch.sort_order = sort_order

  const { data, error } = await db
    .from('form_definitions')
    .update(patch)
    .eq('id', id)
    .eq('company_id', user.companyId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ form: data })
}

// DELETE /api/admin/forms?id= — 刪除表單
export async function DELETE(req: NextRequest) {
  const user = await getSessionUser()
  const { searchParams } = new URL(req.url)
  const id = Number(searchParams.get('id'))
  if (!id) return NextResponse.json({ error: '缺少 id' }, { status: 400 })

  const db = createServiceClient().schema('aido')

  const { data: existing } = await db
    .from('form_definitions')
    .select('id')
    .eq('id', id)
    .eq('company_id', user.companyId)
    .single()
  if (!existing) return NextResponse.json({ error: '找不到表單' }, { status: 404 })

  const { error } = await db
    .from('form_definitions')
    .delete()
    .eq('id', id)
    .eq('company_id', user.companyId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
