import { createHash, randomBytes } from 'crypto'
import { createServiceClient } from './supabase/server'

/** 產生對外 API key (只回傳一次，DB 只存 sha256 hash) */
export function generateApiKey(): { key: string; hash: string; prefix: string } {
  const raw = 'aido_' + randomBytes(24).toString('hex')
  const hash = createHash('sha256').update(raw).digest('hex')
  return { key: raw, hash, prefix: raw.slice(0, 12) }
}

/** 驗證 API key，回傳所屬 company + scopes，無效回 null */
export async function verifyApiKey(key: string): Promise<{ companyId: number; scopes: string[] } | null> {
  if (!key || !key.startsWith('aido_')) return null
  const hash = createHash('sha256').update(key).digest('hex')
  const svc = createServiceClient()
  const { data } = await svc.schema('aido').from('api_keys')
    .select('*').eq('key_hash', hash).eq('revoked', false).single()
  if (!data) return null
  await svc.schema('aido').from('api_keys').update({ last_used_at: new Date().toISOString() }).eq('id', data.id)
  return { companyId: data.company_id, scopes: data.scopes || ['read'] }
}
