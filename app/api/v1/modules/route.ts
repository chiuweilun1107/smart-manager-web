import { NextRequest } from 'next/server'
import { authBearerUser, companyOf, roleOf, jsonCors, preflight } from '@/lib/agent-auth'
import { getEffectiveModules, resolveFormFields, resolveRolePermissions } from '@/lib/platform-config'

export async function OPTIONS(req: NextRequest) { return preflight(req) }

// 回該使用者公司「可開單」的 module 清單 + 每個 module 的有效 fields(DB-first)。供 agent 建表單 schema。
export async function GET(req: NextRequest) {
  const user = await authBearerUser(req)
  if (!user) return jsonCors(req, { error: 'Unauthorized' }, { status: 401 })
  const companyId = companyOf(user)
  const roleCode = roleOf(user)

  const [mods, perms] = await Promise.all([
    getEffectiveModules(companyId),
    resolveRolePermissions(companyId, roleCode),
  ])
  const visible = new Set(perms.visibleModuleCodes)

  const modules = []
  for (const m of mods) {
    if (m.kind !== 'request') continue
    if (!visible.has(m.code)) continue
    const rf = await resolveFormFields(companyId, m.code) // DB-first 有效欄位
    modules.push({ code: m.code, name: m.name, icon: m.icon, group: m.group, fields: rf?.fields ?? m.fields ?? [] })
  }
  return jsonCors(req, { modules })
}
