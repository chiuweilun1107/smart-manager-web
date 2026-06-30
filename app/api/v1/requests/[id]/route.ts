import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { authBearerUser, jsonCors, preflight } from '@/lib/agent-auth'
import { getRequestDetail } from '@/lib/self-service'
import { updateDraft, submitDraft } from '@/lib/bpm'

export async function OPTIONS(req: NextRequest) { return preflight(req) }

/** GET：使用者 JWT → 單據詳情 + 簽核步驟 + 簽核軌跡（self / approver / 特權角色可看，與後台一致）。 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await authBearerUser(req)
  if (!user) return jsonCors(req, { error: 'Unauthorized' }, { status: 401 })

  const svc = createServiceClient()
  const r = await getRequestDetail(svc, user, Number(id))
  if (!r.ok) {
    if (r.error === 'notfound') return jsonCors(req, { error: 'Request not found' }, { status: 404 })
    return jsonCors(req, { error: 'Forbidden' }, { status: 403 })
  }
  return jsonCors(req, r.data)
}

/** PATCH：使用者 JWT → 編輯本人草稿(payload)；body.submit=true 則改完直接送出。
 *  ownership(本人) + 僅草稿可改/送，由 bpm.updateDraft / submitDraft 既有檢查把關(非本人或非草稿 → throw 400)。 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await authBearerUser(req)
  if (!user) return jsonCors(req, { error: 'Unauthorized' }, { status: 401 })

  let body: { payload?: Record<string, unknown>; submit?: boolean }
  try { body = await req.json() } catch { return jsonCors(req, { error: '無效的 JSON' }, { status: 400 }) }
  const payload = body.payload ?? {}
  const svc = createServiceClient()
  const ip = req.headers.get('x-forwarded-for') || undefined
  const ua = req.headers.get('user-agent') || undefined

  try {
    const result = body.submit
      ? await submitDraft(svc, user, Number(id), payload, { ip, ua })
      : await updateDraft(svc, user, Number(id), payload)
    return jsonCors(req, { ok: true, request: result, submitted: !!body.submit })
  } catch (e) {
    const msg = e instanceof Error ? e.message : '草稿更新失敗'
    return jsonCors(req, { error: msg }, { status: 400 })
  }
}
