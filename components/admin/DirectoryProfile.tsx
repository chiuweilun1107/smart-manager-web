'use client'
import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'

interface MemberDetail {
  id: number
  employee_no: string | null
  display_name: string
  english_name: string | null
  email: string | null
  mobile: string | null
  status: string
  hired_at: string | null
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

const STATUS_LABEL: Record<string, string> = { active: '在職', inactive: '停用', resigned: '已離職' }

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <span className="label-mono" style={{ fontSize: '11px', color: 'var(--text-faint)' }}>{label}</span>
      <span style={{ fontSize: '14px', color: 'var(--text)' }}>{value ?? <span style={{ color: 'var(--text-faint)' }}>—</span>}</span>
    </div>
  )
}

export default function DirectoryProfile({ memberId }: { memberId: number }) {
  const [member, setMember] = useState<MemberDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [errMsg, setErrMsg] = useState('')
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    const ac = new AbortController()
    ;(async () => {
      setLoading(true)
      try {
        const r = await fetch(`/api/directory/${memberId}`, { signal: ac.signal })
        const d = await r.json()
        if (!mountedRef.current) return
        if (!r.ok) throw new Error(d.error || '載入失敗')
        setMember(d.member)
        setErrMsg('')
      } catch (e: unknown) {
        if (!mountedRef.current) return
        if (e instanceof DOMException && e.name === 'AbortError') return
        setErrMsg(e instanceof Error ? e.message : '載入失敗')
      } finally {
        if (mountedRef.current) setLoading(false)
      }
    })()
    return () => { mountedRef.current = false; ac.abort() }
  }, [memberId])

  const fmtDate = (s: string | null) => (s ? new Date(s).toLocaleDateString('zh-TW') : null)

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto' }}>
      <Link href="/module/directory" style={{ fontSize: '13px', color: 'var(--text-muted)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px', marginBottom: '16px' }}>
        ← 返回通訊錄
      </Link>

      {loading && (
        <div style={{ ...card, padding: '32px', textAlign: 'center', color: 'var(--text-faint)', fontSize: '13px' }}>載入中…</div>
      )}
      {!loading && errMsg && (
        <div style={{ ...card, padding: '16px', color: 'var(--danger, #e53e3e)', fontSize: '13px' }}>{errMsg}</div>
      )}

      {!loading && member && (
        <div style={{ ...card, padding: '28px' }}>
          {/* 頭 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'var(--surface-2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', fontWeight: 600, color: 'var(--text-muted)', flexShrink: 0 }}>
              {member.display_name.slice(0, 1)}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h1 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text)', margin: 0 }}>{member.display_name}</h1>
                {member.english_name && <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{member.english_name}</span>}
                <span style={{ fontSize: '11px', color: member.status === 'active' ? 'var(--primary)' : 'var(--text-faint)', border: `1px solid ${member.status === 'active' ? 'var(--primary)' : 'var(--border)'}`, borderRadius: 'var(--radius)', padding: '0 6px', lineHeight: '18px' }}>
                  {STATUS_LABEL[member.status] ?? member.status}
                </span>
              </div>
              <div style={{ marginTop: '4px', fontSize: '13px', color: 'var(--text-muted)' }}>
                {member.position_title ?? '—'}{member.department_name ? ` · ${member.department_name}` : ''}
              </div>
            </div>
          </div>

          {/* 欄位 grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '18px' }}>
            <Field label="工號" value={member.employee_no} />
            <Field label="部門" value={member.department_name} />
            <Field label="職稱" value={member.position_title} />
            <Field label="角色" value={member.role_name} />
            <Field label="直屬主管" value={member.manager_name} />
            <Field label="到職日" value={fmtDate(member.hired_at)} />
            <Field label="Email" value={member.email ? <a href={`mailto:${member.email}`} style={{ color: 'var(--primary)', textDecoration: 'none' }}>{member.email}</a> : null} />
            <Field label="手機" value={member.mobile ? <a href={`tel:${member.mobile}`} style={{ color: 'var(--primary)', textDecoration: 'none' }}>{member.mobile}</a> : null} />
          </div>
        </div>
      )}
    </div>
  )
}
