import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getSessionUser } from '@/lib/session'
import { seedPlatformConfig } from '@/lib/seed-platform'

// 一次性把 code 預設灌進 DB (role_permissions / role_field_access / approval_chain_templates / form_definitions)。
// 冪等：重複呼叫只 upsert。限管理角色。
export async function POST() {
  const user = await getSessionUser()
  if (!['executive', 'hr', 'it', 'admin_officer'].includes(user.roleCode)) {
    return NextResponse.json({ error: '需管理權限' }, { status: 403 })
  }
  const db = createServiceClient().schema('aido')
  try {
    const results = await seedPlatformConfig(db, user.companyId)
    return NextResponse.json({ ok: true, company_id: user.companyId, results })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
