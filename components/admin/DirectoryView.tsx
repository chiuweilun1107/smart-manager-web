'use client'
import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import type { SessionUser } from '@/lib/types'

interface Member {
  id: number
  employee_no: string | null
  display_name: string
  email: string | null
  status: string
  department_id: number | null
  department_name: string | null
  position_title: string | null
  role_name: string | null
  manager_name: string | null
}

const card: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-lg)',
}

const inputStyle: React.CSSProperties = {
  background: 'var(--surface-2)',
  border: '1px solid var(--border)',
  color: 'var(--text)',
  borderRadius: 'var(--radius)',
  padding: '7px 10px',
  fontSize: '13px',
  boxSizing: 'border-box',
}

export default function DirectoryView({ user: _user }: { user: SessionUser }) {
  const router = useRouter()
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [errMsg, setErrMsg] = useState('')
  const [q, setQ] = useState('')
  const [deptFilter, setDeptFilter] = useState('')
  const mountedRef = useRef(true)

  const fetchMembers = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    try {
      const r = await fetch('/api/directory', { signal })
      const d = await r.json()
      if (!mountedRef.current) return
      if (!r.ok) throw new Error(d.error)
      setMembers(d.members ?? [])
      setErrMsg('')
    } catch (e: unknown) {
      if (!mountedRef.current) return
      if (e instanceof DOMException && e.name === 'AbortError') return
      setErrMsg(e instanceof Error ? e.message : '載入失敗')
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    const ac = new AbortController()
    fetchMembers(ac.signal)
    return () => { mountedRef.current = false; ac.abort() }
  }, [fetchMembers])

  // 部門下拉選項（去重，依名稱）
  const deptOptions = useMemo(() => {
    const seen = new Map<number, string>()
    for (const m of members) {
      if (m.department_id != null && m.department_name) seen.set(m.department_id, m.department_name)
    }
    return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1], 'zh-Hant'))
  }, [members])

  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase()
    return members.filter(m => {
      if (deptFilter && String(m.department_id) !== deptFilter) return false
      if (!kw) return true
      return (
        m.display_name.toLowerCase().includes(kw) ||
        (m.employee_no ?? '').toLowerCase().includes(kw) ||
        (m.email ?? '').toLowerCase().includes(kw)
      )
    })
  }, [members, q, deptFilter])

  return (
    <div style={{ maxWidth: '1040px', margin: '0 auto' }}>
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text)', margin: 0, letterSpacing: '-0.02em' }}>通訊錄</h1>
        <span className="label-mono" style={{ display: 'block', marginTop: '4px' }}>DIRECTORY</span>
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="搜尋姓名 / 工號 / Email"
          style={{ ...inputStyle, flex: '1 1 220px', minWidth: 0 }}
        />
        <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)} style={{ ...inputStyle, flex: '0 0 auto' }}>
          <option value="">全部部門</option>
          {deptOptions.map(([id, name]) => (
            <option key={id} value={String(id)}>{name}</option>
          ))}
        </select>
      </div>

      {errMsg && (
        <div style={{ ...card, padding: '12px 16px', color: 'var(--danger, #e53e3e)', fontSize: '13px', marginBottom: '16px' }}>{errMsg}</div>
      )}

      <div style={{ ...card, overflow: 'hidden' }}>
        <div style={{ minWidth: 0, overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse', minWidth: '720px' }}>
            <thead>
              <tr style={{ background: 'var(--surface-2)' }}>
                {['姓名', '工號', '部門', '職稱', '角色', 'Email', '主管'].map(h => (
                  <th key={h} className="label-mono" style={{ padding: '9px 16px', textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={7} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-faint)' }}>載入中…</td></tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={7} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-faint)' }}>
                  {members.length === 0 ? '尚無成員資料' : '查無符合條件的成員'}
                </td></tr>
              )}
              {!loading && filtered.map(m => (
                <tr
                  key={m.id}
                  onClick={() => router.push(`/directory/${m.id}`)}
                  style={{ borderTop: '1px solid var(--border)', cursor: 'pointer' }}
                  className="dir-row"
                >
                  <td style={{ padding: '10px 16px', color: 'var(--text)', fontWeight: 500, whiteSpace: 'nowrap' }}>{m.display_name}</td>
                  <td style={{ padding: '10px 16px', color: 'var(--text-faint)' }}><span className="label-mono">{m.employee_no ?? '—'}</span></td>
                  <td style={{ padding: '10px 16px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{m.department_name ?? '—'}</td>
                  <td style={{ padding: '10px 16px', color: 'var(--text-muted)' }}>{m.position_title ?? '—'}</td>
                  <td style={{ padding: '10px 16px', color: 'var(--text-muted)' }}>{m.role_name ?? '—'}</td>
                  <td style={{ padding: '10px 16px', color: 'var(--text-muted)' }}>{m.email ?? '—'}</td>
                  <td style={{ padding: '10px 16px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{m.manager_name ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {!loading && members.length > 0 && (
        <div style={{ marginTop: '10px', fontSize: '12px', color: 'var(--text-faint)' }}>
          共 {filtered.length} 位{filtered.length !== members.length ? `（全部 ${members.length} 位）` : ''}
        </div>
      )}

      <style jsx>{`
        .dir-row:hover { background: var(--surface-2); }
      `}</style>
    </div>
  )
}
