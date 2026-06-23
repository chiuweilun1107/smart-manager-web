import { NextRequest } from 'next/server'
import { authBearerUser, companyOf, roleOf, jsonCors, preflight } from '@/lib/agent-auth'
import { getEffectiveModule, resolveFormFields, resolveRolePermissions } from '@/lib/platform-config'

export async function OPTIONS(req: NextRequest) { return preflight(req) }

// 單一 module 的有效 fields(供 agent 建 schema)。受角色可見性約束。
export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const user = await authBearerUser(req)
  if (!user) return jsonCors(req, { error: 'Unauthorized' }, { status: 401 })
  const companyId = companyOf(user)
  const roleCode = roleOf(user)

  const mod = await getEffectiveModule(companyId, code)
  if (!mod) return jsonCors(req, { error: 'Module not found' }, { status: 404 })
  const perms = await resolveRolePermissions(companyId, roleCode)
  if (!perms.visibleModuleCodes.includes(code)) return jsonCors(req, { error: 'Forbidden' }, { status: 403 })

  const rf = await resolveFormFields(companyId, code)
  return jsonCors(req, {
    code: mod.code, name: mod.name, icon: mod.icon, kind: mod.kind,
    fields: rf?.fields ?? mod.fields ?? [],
  })
}
