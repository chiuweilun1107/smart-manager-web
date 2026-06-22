'use client'
import { useEffect, useState, useCallback } from 'react'
import type { SessionUser } from '@/lib/types'
import { MODULES } from '@/lib/modules'

type Action = 'create' | 'read' | 'approve' | 'manage' | 'delete'
type ReadScope = 'self' | 'team' | 'all'

interface RoleRow { id: number; code: string; name: string; level: number; is_system: boolean }
interface PermRow { role_code: string; module_code: string; visible: boolean; actions: Action[]; read_scope: ReadScope }
interface FieldRow { role_code: string; field_key: string; allowed: boolean }

const ALL_ACTIONS: Action[] = ['create', 'read', 'approve', 'manage', 'delete']
const ACTION_LABELS: Record<Action, string> = {
  create: '新增', read: '查看', approve: '審核', manage: '管理', delete: '刪除',
}
const SCOPE_OPTIONS: { value: ReadScope; label: string }[] = [
  { value: 'self', label: '本人' },
  { value: 'team', label: '部門' },
  { value: 'all', label: '全部' },
]
const SENSITIVE_FIELDS: { key: string; label: string }[] = [
  { key: 'salary', label: '薪資' },
  { key: 'national_id', label: '身分證號' },
  { key: 'bank_account', label: '銀行帳號' },
]

const card: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-lg)',
}
const sectionTitle: React.CSSProperties = {
  fontSize: '14px', fontWeight: 700, color: 'var(--text)', margin: 0, letterSpacing: '-0.01em',
}

function Toast({ msg, ok }: { msg: string; ok: boolean }) {
  return (
    <div style={{
      position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999,
      background: ok ? 'var(--surface)' : '#fee2e2',
      border: `1px solid ${ok ? 'var(--primary)' : '#fca5a5'}`,
      borderRadius: 'var(--radius)', padding: '10px 18px',
      fontSize: '13px', color: ok ? 'var(--text)' : '#b91c1c',
      boxShadow: '0 4px 16px rgba(0,0,0,.12)',
    }}>{msg}</div>
  )
}

export default function RBACView({ user }: { user: SessionUser }) {
  const [roles, setRoles] = useState<RoleRow[]>([])
  const [permissions, setPermissions] = useState<PermRow[]>([])
  const [fieldAccess, setFieldAccess] = useState<FieldRow[]>([])
  const [selectedRole, setSelectedRole] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
  const [saving, setSaving] = useState(false)

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 2500)
  }

  const load = useCallback(() => {
    setLoading(true)
    fetch('/api/admin/rbac')
      .then(r => r.json())
      .then(d => {
        setRoles(d.roles ?? [])
        setPermissions(d.permissions ?? [])
        setFieldAccess(d.field_access ?? [])
        if (!selectedRole && (d.roles ?? []).length > 0) {
          setSelectedRole(d.roles[0].code)
        }
      })
      .catch(() => showToast('載入失敗', false))
      .finally(() => setLoading(false))
  }, [selectedRole])

  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // 找某 role + module 的 perm（可能不存在 → 回預設）
  function getPerm(roleCode: string, moduleCode: string): PermRow {
    return permissions.find(p => p.role_code === roleCode && p.module_code === moduleCode)
      ?? { role_code: roleCode, module_code: moduleCode, visible: false, actions: [], read_scope: 'self' }
  }

  function getField(roleCode: string, fieldKey: string): boolean {
    return fieldAccess.find(f => f.role_code === roleCode && f.field_key === fieldKey)?.allowed ?? false
  }

  async function savePerm(patch: Omit<PermRow, 'id'>) {
    if (saving) return
    setSaving(true)
    try {
      const res = await fetch('/api/admin/rbac', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      const json = await res.json()
      if (!res.ok) { showToast(json.error ?? '儲存失敗', false); return }
      // 更新本地 state
      setPermissions(prev => {
        const next = prev.filter(p => !(p.role_code === patch.role_code && p.module_code === patch.module_code))
        return [...next, json.permission]
      })
      showToast('已儲存')
    } catch { showToast('網路錯誤', false) }
    finally { setSaving(false) }
  }

  async function saveField(roleCode: string, fieldKey: string, allowed: boolean) {
    if (saving) return
    setSaving(true)
    try {
      const res = await fetch('/api/admin/rbac', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role_code: roleCode, field_key: fieldKey, allowed }),
      })
      const json = await res.json()
      if (!res.ok) { showToast(json.error ?? '儲存失敗', false); return }
      setFieldAccess(prev => {
        const next = prev.filter(f => !(f.role_code === roleCode && f.field_key === fieldKey))
        return [...next, json.field_access]
      })
      showToast('已儲存')
    } catch { showToast('網路錯誤', false) }
    finally { setSaving(false) }
  }

  function handleVisible(moduleCode: string, checked: boolean) {
    const perm = getPerm(selectedRole, moduleCode)
    savePerm({ ...perm, visible: checked })
  }

  function handleAction(moduleCode: string, action: Action, checked: boolean) {
    const perm = getPerm(selectedRole, moduleCode)
    const actions = checked
      ? [...new Set([...perm.actions, action])]
      : perm.actions.filter(a => a !== action)
    savePerm({ ...perm, actions })
  }

  function handleScope(moduleCode: string, scope: ReadScope) {
    const perm = getPerm(selectedRole, moduleCode)
    savePerm({ ...perm, read_scope: scope })
  }

  // 依 group 分組 module
  const groups = Array.from(new Set(MODULES.map(m => m.group)))
  const selectedRoleName = roles.find(r => r.code === selectedRole)?.name ?? selectedRole

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-faint)', fontSize: '14px' }}>
        載入中…
      </div>
    )
  }

  return (
    <>
      <style>{`
        .rbac-tab { padding: 7px 16px; border-radius: var(--radius); cursor: pointer; font-size: 13px; font-weight: 600; border: 1px solid var(--border); background: transparent; color: var(--text-muted); transition: all .15s; white-space: nowrap; }
        .rbac-tab:hover { border-color: var(--primary); color: var(--text); }
        .rbac-tab.active { background: var(--primary); color: #fff; border-color: var(--primary); }
        .rbac-cb { width: 15px; height: 15px; accent-color: var(--primary); cursor: pointer; }
        .rbac-select { padding: 3px 6px; border: 1px solid var(--border); borderRadius: var(--radius); background: var(--surface); color: var(--text); font-size: 12px; cursor: pointer; outline: none; }
        .rbac-select:focus { border-color: var(--primary); }
        .rbac-th { padding: 9px 14px; font-size: 11px; font-weight: 600; color: var(--text-muted); white-space: nowrap; text-align: left; letter-spacing: .04em; text-transform: uppercase; }
        .rbac-td { padding: 10px 14px; font-size: 13px; color: var(--text); border-top: 1px solid var(--border); vertical-align: middle; }
        .rbac-group-row { background: var(--surface-2); }
        .rbac-group-label { font-size: 11px; font-weight: 700; color: var(--text-muted); letter-spacing: .08em; text-transform: uppercase; padding: 6px 14px; }
      `}</style>

      <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
        {/* 頁首 */}
        <div style={{ marginBottom: '20px' }}>
          <h2 style={sectionTitle}>權限管理</h2>
          <span className="label-mono" style={{ display: 'block', marginTop: '4px', color: 'var(--text-faint)' }}>
            RBAC · {user.roleName} · {user.displayName}
          </span>
        </div>

        {/* 角色 Tab 列 */}
        <div style={{ ...card, padding: '14px 16px', marginBottom: '16px' }}>
          <div className="label-mono" style={{ marginBottom: '10px' }}>選擇角色</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {roles.map(r => (
              <button
                key={r.code}
                className={`rbac-tab${selectedRole === r.code ? ' active' : ''}`}
                onClick={() => setSelectedRole(r.code)}
              >
                {r.name}
                {r.is_system && (
                  <span style={{ fontSize: '10px', marginLeft: '6px', opacity: 0.7 }}>系統</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {selectedRole && (
          <>
            {/* 模組權限矩陣 */}
            <div style={{ ...card, marginBottom: '16px', overflow: 'hidden' }}>
              <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h3 style={sectionTitle}>模組權限矩陣</h3>
                <span className="label-mono" style={{ color: 'var(--text-faint)' }}>/ {selectedRoleName}</span>
              </div>

              <div style={{ minWidth: 0, overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '780px' }}>
                  <thead>
                    <tr style={{ background: 'var(--surface-2)' }}>
                      <th className="rbac-th" style={{ width: '200px' }}>模組</th>
                      <th className="rbac-th" style={{ width: '80px', textAlign: 'center' }}>側欄顯示</th>
                      {ALL_ACTIONS.map(a => (
                        <th key={a} className="rbac-th" style={{ textAlign: 'center' }}>{ACTION_LABELS[a]}</th>
                      ))}
                      <th className="rbac-th">資料範圍</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groups.map(group => {
                      const mods = MODULES.filter(m => m.group === group)
                      return [
                        <tr key={`group-${group}`} className="rbac-group-row">
                          <td colSpan={7} className="rbac-group-label">{group}</td>
                        </tr>,
                        ...mods.map(mod => {
                          const perm = getPerm(selectedRole, mod.code)
                          return (
                            <tr key={mod.code}>
                              <td className="rbac-td">
                                <div style={{ fontWeight: 500 }}>{mod.name}</div>
                                <div style={{ fontSize: '10px', color: 'var(--text-faint)', fontFamily: 'monospace', marginTop: '2px' }}>{mod.code}</div>
                              </td>
                              <td className="rbac-td" style={{ textAlign: 'center' }}>
                                <input
                                  type="checkbox"
                                  className="rbac-cb"
                                  checked={perm.visible}
                                  onChange={e => handleVisible(mod.code, e.target.checked)}
                                />
                              </td>
                              {ALL_ACTIONS.map(action => (
                                <td key={action} className="rbac-td" style={{ textAlign: 'center' }}>
                                  <input
                                    type="checkbox"
                                    className="rbac-cb"
                                    checked={perm.actions.includes(action)}
                                    onChange={e => handleAction(mod.code, action, e.target.checked)}
                                  />
                                </td>
                              ))}
                              <td className="rbac-td">
                                <select
                                  className="rbac-select"
                                  value={perm.read_scope}
                                  onChange={e => handleScope(mod.code, e.target.value as ReadScope)}
                                >
                                  {SCOPE_OPTIONS.map(o => (
                                    <option key={o.value} value={o.value}>{o.label}</option>
                                  ))}
                                </select>
                              </td>
                            </tr>
                          )
                        }),
                      ]
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 敏感欄位存取 */}
            <div style={{ ...card, overflow: 'hidden' }}>
              <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h3 style={sectionTitle}>敏感欄位存取</h3>
                <span className="label-mono" style={{ color: 'var(--text-faint)' }}>/ {selectedRoleName}</span>
              </div>
              <div style={{ padding: '0 0 8px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'var(--surface-2)' }}>
                      <th className="rbac-th" style={{ width: '200px' }}>欄位</th>
                      <th className="rbac-th" style={{ width: '100px', textAlign: 'center' }}>允許存取</th>
                      <th className="rbac-th" style={{ color: 'var(--text-faint)' }}>說明</th>
                    </tr>
                  </thead>
                  <tbody>
                    {SENSITIVE_FIELDS.map(field => {
                      const allowed = getField(selectedRole, field.key)
                      return (
                        <tr key={field.key}>
                          <td className="rbac-td">
                            <div style={{ fontWeight: 500 }}>{field.label}</div>
                            <div style={{ fontSize: '10px', color: 'var(--text-faint)', fontFamily: 'monospace', marginTop: '2px' }}>{field.key}</div>
                          </td>
                          <td className="rbac-td" style={{ textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              className="rbac-cb"
                              checked={allowed}
                              onChange={e => saveField(selectedRole, field.key, e.target.checked)}
                            />
                          </td>
                          <td className="rbac-td" style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                            {field.key === 'salary' && '可查看及操作薪資相關資料'}
                            {field.key === 'national_id' && '可查看員工身分證字號完整資料'}
                            {field.key === 'bank_account' && '可查看員工銀行帳戶完整資料'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {!selectedRole && !loading && (
          <div style={{ ...card, padding: '40px', textAlign: 'center', color: 'var(--text-faint)', fontSize: '14px' }}>
            請先在上方選擇角色
          </div>
        )}
      </div>

      {toast && <Toast msg={toast.msg} ok={toast.ok} />}
    </>
  )
}
