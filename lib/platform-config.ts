// 平台化配置解析層：DB 優先 (admin UI 編輯結果) → fallback code 預設 (seed 前/查詢失敗不破壞)
// 讓 簽核流程設計器 / 表單設計器 / 權限管理 的編輯實際生效，同時保證 DB 空或出錯時系統仍可運作。
import { createServiceClient } from './supabase/server'
import { CHAINS } from './chains'
import type { Chain } from './chains'
import { MODULE_MAP } from './modules'
import type { ModuleField, ModuleColumn } from './modules'
import { ROLE_ACTIONS, ROLE_READ_SCOPE, FIELD_FULL_ACCESS, type Action } from './rbac'
import { visibleModules } from './modules'

function svc() { return createServiceClient().schema('aido') }

// ---- 簽核流程：DB approval_chain_templates → fallback code CHAINS ----
export async function resolveChain(companyId: number, chainCode: string): Promise<Chain | null> {
  try {
    const { data } = await svc().from('approval_chain_templates')
      .select('chain_code, amount_field, steps_json, is_active')
      .eq('company_id', companyId).eq('chain_code', chainCode).eq('is_active', true).maybeSingle()
    if (data && Array.isArray(data.steps_json) && data.steps_json.length > 0) {
      return { chain_code: data.chain_code, amount_field: data.amount_field || 'amount', steps: data.steps_json }
    }
  } catch { /* fall through to code default */ }
  return CHAINS[chainCode] || null
}

// ---- 表單欄位：DB form_definitions.fields_json → fallback module.fields ----
export interface ResolvedForm { fields: ModuleField[]; columns?: ModuleColumn[]; chainCode?: string }
export async function resolveFormFields(companyId: number, moduleCode: string): Promise<ResolvedForm | null> {
  try {
    const { data } = await svc().from('form_definitions')
      .select('fields_json, columns_json, chain_code, is_active, version')
      .eq('company_id', companyId).eq('module_code', moduleCode).eq('is_active', true)
      .order('version', { ascending: false }).limit(1).maybeSingle()
    if (data && Array.isArray(data.fields_json) && data.fields_json.length > 0) {
      return {
        fields: data.fields_json as ModuleField[],
        columns: Array.isArray(data.columns_json) && data.columns_json.length ? (data.columns_json as ModuleColumn[]) : undefined,
        chainCode: data.chain_code || undefined,
      }
    }
  } catch { /* fall through */ }
  const mod = MODULE_MAP[moduleCode]
  return mod?.fields ? { fields: mod.fields, columns: mod.columns, chainCode: mod.chain } : null
}

// ---- 角色權限：DB role_permissions / role_field_access → fallback code rbac.ts ----
export interface ResolvedPerms {
  visibleModuleCodes: string[]      // sidebar 可見的 module code
  actions: Action[]                 // 操作級權限
  readScope: 'self' | 'team' | 'all'
  fieldAccess: string[]             // 可看的敏感欄位 key
}
export async function resolveRolePermissions(companyId: number, roleCode: string): Promise<ResolvedPerms> {
  // code 預設 (fallback)
  const codeVisible = visibleModules(roleCode).map(m => m.code)
  const codeActions = (ROLE_ACTIONS[roleCode] || ['read']) as Action[]
  const codeScope = (ROLE_READ_SCOPE[roleCode] || 'self') as 'self' | 'team' | 'all'
  const codeFields = Object.entries(FIELD_FULL_ACCESS).filter(([, roles]) => roles.includes(roleCode)).map(([f]) => f)
  try {
    const [permRes, fieldRes] = await Promise.all([
      svc().from('role_permissions').select('module_code, visible, actions, read_scope').eq('company_id', companyId).eq('role_code', roleCode),
      svc().from('role_field_access').select('field_key, allowed').eq('company_id', companyId).eq('role_code', roleCode),
    ])
    const perms = permRes.data
    if (perms && perms.length > 0) {
      const visibleModuleCodes = perms.filter(p => p.visible).map(p => p.module_code)
      // actions/read_scope 取所有 module 權限的聯集 (代表此角色整體能力)；UI 設定為 per-module，整體能力取最大集
      const actSet = new Set<Action>()
      let scope: 'self' | 'team' | 'all' = 'self'
      for (const p of perms) {
        for (const a of (Array.isArray(p.actions) ? p.actions : [])) actSet.add(a as Action)
        if (p.read_scope === 'all') scope = 'all'
        else if (p.read_scope === 'team' && scope !== 'all') scope = 'team'
      }
      const fieldAccess = (fieldRes.data || []).filter(f => f.allowed).map(f => f.field_key)
      return {
        visibleModuleCodes: visibleModuleCodes.length ? visibleModuleCodes : codeVisible,
        actions: actSet.size ? Array.from(actSet) : codeActions,
        readScope: scope,
        fieldAccess: fieldRes.data && fieldRes.data.length ? fieldAccess : codeFields,
      }
    }
  } catch { /* fall through to code defaults */ }
  return { visibleModuleCodes: codeVisible, actions: codeActions, readScope: codeScope, fieldAccess: codeFields }
}
