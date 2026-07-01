import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { authBearerUser, jsonCors, preflight } from '@/lib/agent-auth'
import { getDashboard } from '@/lib/self-service'

export async function OPTIONS(req: NextRequest) { return preflight(req) }

/** Widget:待簽核/審核中單據數 — 直接查本公司/本人資料(company-scoped，同 /api/v1/dashboard 的資料源)。 */
export async function GET(req: NextRequest) {
  const user = await authBearerUser(req)
  if (!user) return jsonCors(req, { error: 'Unauthorized' }, { status: 401 })
  const svc = createServiceClient()
  const { pending_approvals_count } = await getDashboard(svc, user)
  return jsonCors(req, { widget: 'pending-approvals', count: pending_approvals_count, updatedAt: new Date().toISOString() })
}
