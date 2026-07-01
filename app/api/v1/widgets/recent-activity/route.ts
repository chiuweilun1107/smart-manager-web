import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { authBearerUser, jsonCors, preflight } from '@/lib/agent-auth'
import { getDashboard } from '@/lib/self-service'

export async function OPTIONS(req: NextRequest) { return preflight(req) }

/** Widget:近期申請單摘要(最近 5 筆) — 直接查本人資料，同 /api/v1/dashboard 的資料源。
 *  total 為本人申請單真實總數(獨立 count 查詢)，非 getDashboard() 已經 limit(5) 過的 my_requests.length。 */
export async function GET(req: NextRequest) {
  const user = await authBearerUser(req)
  if (!user) return jsonCors(req, { error: 'Unauthorized' }, { status: 401 })
  const svc = createServiceClient()
  const [{ my_requests }, { count }] = await Promise.all([
    getDashboard(svc, user),
    svc.schema('aido').from('requests').select('id', { count: 'exact', head: true }).eq('requester_user_id', user.id as number),
  ])
  const recent = (my_requests as Array<Record<string, unknown>>).slice(0, 5).map(r => ({
    requestNo: r.request_no ?? null,
    module: r.module_code ?? null,
    status: r.status ?? null,
    createdAt: r.created_at ?? null,
  }))
  return jsonCors(req, { widget: 'recent-activity', total: count ?? 0, recent, updatedAt: new Date().toISOString() })
}
