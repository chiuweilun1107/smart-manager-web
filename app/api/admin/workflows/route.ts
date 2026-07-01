import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdminUser } from '@/lib/api-guard'
import { CHAINS } from '@/lib/chains'
import { MODULES } from '@/lib/modules'

// GET /api/admin/workflows — 列該 company 的「所有系統簽核流程」= 內建 CHAINS + DB 覆寫合併 + roles。
// 內建流程是 code 常數(lib/chains.ts)不在 DB;流程設計器需看到全部內建流程才能編輯。
// DB approval_chain_templates row 覆寫同 chain_code 內建(resolveChain 也是 DB-first,行為一致)。
// 內建未被覆寫者給 synthetic 負數 id(sentinel):前端據此走 POST 建覆寫而非 PUT。
export async function GET() {
  const { user, error: authErr } = await requireAdminUser()
  if (authErr) return authErr
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

  const dbRows = (tplResult.data ?? []).map(r => ({ ...r, is_builtin: !!CHAINS[r.chain_code], customized: true }))
  const overridden = new Set(dbRows.map(r => r.chain_code))

  // 內建 CHAINS 中「尚無 DB 覆寫」者 → 合成唯讀基底(可編輯,存檔時建覆寫)。
  // name 依對應 module 中文名(與 seed-platform 一致);module_code 由 chain_code 去 _default 推導。
  const builtinRows = Object.values(CHAINS)
    .filter(c => !overridden.has(c.chain_code))
    .map((c, i) => {
      const moduleCode = c.chain_code.replace(/_default$/, '')
      const mod = MODULES.find(m => m.code === moduleCode)
      return {
        id: -(i + 1),
        company_id: user.companyId,
        chain_code: c.chain_code,
        name: mod ? `${mod.name}簽核流程` : c.chain_code,
        module_code: mod ? moduleCode : null,
        amount_field: c.amount_field ?? 'amount',
        steps_json: c.steps ?? [],
        is_active: true,
        created_at: '',
        is_builtin: true,
        customized: false,
      }
    })

  return NextResponse.json({
    templates: [...builtinRows, ...dbRows],
    roles: rolesResult.data ?? [],
  })
}

// POST /api/admin/workflows — 新增流程
export async function POST(req: NextRequest) {
  const { user, error: authErr } = await requireAdminUser()
  if (authErr) return authErr
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
  const { user, error: authErr } = await requireAdminUser()
  if (authErr) return authErr
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
  const { user, error: authErr } = await requireAdminUser()
  if (authErr) return authErr
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
