import { SessionUser } from './types'

/**
 * 多租戶 (multi-tenant) company context helper。
 *
 * 設計：現階段只有一家公司 (id=1)。所有資料寫入/查詢都應帶 company_id，
 * 未來接第二家公司時無需改 query 結構，只要 session 帶不同 companyId。
 *
 * ⚠️ scopeToCompany / withCompany 的「實際套用到 query」需待
 * 20260622001_aido_multitenant.sql apply 到 Supabase (各表已有 company_id 欄位) 後，
 * 否則 query 會因欄位不存在而報錯。getCompanyId 本身永遠安全 (fallback 預設)。
 */

/** 現階段單一公司的固定 id；migration apply 後由 session 帶真值 */
export const DEFAULT_COMPANY_ID = 1

/** 從 session user 取 company_id，未設時 fallback 預設公司 */
export function getCompanyId(user: Pick<SessionUser, 'companyId'>): number {
  return user.companyId ?? DEFAULT_COMPANY_ID
}

/**
 * 給 Supabase query builder 套上 company 範圍 (讀取)。
 * 用法：scopeToCompany(service.schema('aido').from('requests').select('*'), companyId)
 */
export function scopeToCompany<T extends { eq: (col: string, val: number) => T }>(
  query: T,
  companyId: number
): T {
  return query.eq('company_id', companyId)
}

/**
 * 寫入時自動補 company_id 的 payload helper (插入)。
 * 用法：service.schema('aido').from('requests').insert(withCompany(payload, companyId))
 */
export function withCompany<T extends Record<string, unknown>>(
  payload: T,
  companyId: number
): T & { company_id: number } {
  return { ...payload, company_id: companyId }
}
