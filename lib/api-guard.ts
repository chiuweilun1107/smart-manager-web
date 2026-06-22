import { NextResponse } from 'next/server'
import { getSessionUser } from './session'
import type { SessionUser } from './types'

// 可執行 admin 配置操作的角色 (組織/員工/權限/表單/流程設定)。
// 用真實 RoleCode (見 lib/rbac.ts)：不含 auditor(只讀) / employee / manager。
export const ADMIN_ROLES = ['hr', 'it', 'executive', 'admin_officer']

export function isAdminRole(roleCode: string): boolean {
  return ADMIN_ROLES.includes(roleCode)
}

// API route 授權守衛：登入 + 管理角色才放行。
// middleware 明文略過所有 /api 路由，故每個 admin API 必須自帶此 guard。
export async function requireAdminUser(): Promise<
  { user: SessionUser; error: null } | { user: null; error: ReturnType<typeof NextResponse.json> }
> {
  const user = await getSessionUser()
  if (!isAdminRole(user.roleCode)) {
    return { user: null, error: NextResponse.json({ error: '需管理權限' }, { status: 403 }) }
  }
  return { user, error: null }
}
