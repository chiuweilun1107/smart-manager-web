import { createHmac } from 'crypto'
import { createServiceClient } from './supabase/server'

/** 對該 company 所有訂閱此 event 的 webhook 發送 (HMAC 簽章, fire-and-forget) */
export async function dispatchWebhook(companyId: number, event: string, payload: Record<string, unknown>) {
  const svc = createServiceClient()
  const { data: hooks } = await svc.schema('aido').from('webhooks')
    .select('*').eq('company_id', companyId).eq('active', true)
  for (const h of hooks || []) {
    if (Array.isArray(h.events) && !h.events.includes(event)) continue
    const body = JSON.stringify({ event, data: payload, ts: Date.now() })
    const sig = h.secret ? createHmac('sha256', h.secret).update(body).digest('hex') : ''
    fetch(h.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-AiDo-Signature': sig },
      body,
    }).catch(() => { /* fire-and-forget */ })
  }
}
