'use client'
import { useEffect, useState } from 'react'
import type { ModuleField } from '@/lib/modules'

const STATUS_LABEL: Record<string, string> = {
  draft: '草稿', in_review: '審核中', approved: '已核准', rejected: '已駁回', returned: '退回', cancelled: '已取消', error: '異常'
}

interface SourceItem {
  id: number
  request_no: string
  status: string
  amount?: number | string | null
  payload: Record<string, unknown>
  [k: string]: unknown
}
interface SourceModule { name?: string; fields?: ModuleField[] }

interface Props {
  field: ModuleField
  value: string
  onChange: (v: string) => void
}

/** 關聯表單下拉：列出登入者自己在來源模組已提出且狀態符合的單據，選後顯示該單詳情 */
export default function RelationSelect({ field, value, onChange }: Props) {
  const rel = field.relation
  const [items, setItems] = useState<SourceItem[]>([])
  const [srcMod, setSrcMod] = useState<SourceModule>({})
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!rel?.sourceModule) { setLoading(false); setErr('未設定來源模組'); return }
    const qs = rel.status && rel.status.length > 0 ? `?status=${encodeURIComponent(rel.status.join(','))}` : ''
    setLoading(true); setErr('')
    fetch(`/api/modules/${encodeURIComponent(rel.sourceModule)}${qs}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setErr(d.error); setItems([]) }
        else { setItems(d.items || []); setSrcMod(d.mod || {}) }
      })
      .catch(() => setErr('載入關聯單據失敗'))
      .finally(() => setLoading(false))
  }, [rel?.sourceModule, rel?.status])

  const valueKey = rel?.valueKey || 'request_no'
  function optionValue(it: SourceItem): string {
    return String(valueKey === 'id' ? it.id : it.request_no)
  }
  function optionLabel(it: SourceItem): string {
    const keys = rel?.labelKeys && rel.labelKeys.length > 0 ? rel.labelKeys : []
    const parts = keys.map(k => it.payload?.[k]).filter(v => v !== undefined && v !== null && String(v) !== '')
    const suffix = parts.length > 0 ? ` — ${parts.join(' / ')}` : ''
    return `${it.request_no}${suffix}`
  }

  const selected = items.find(it => optionValue(it) === value) || null

  const inputCls = 'w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2'
  const inputStyle: React.CSSProperties = { background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <select
        required={field.required}
        value={value}
        disabled={loading}
        className={inputCls}
        style={inputStyle}
        onChange={e => onChange(e.target.value)}
      >
        <option value="">{loading ? '載入中…' : `請選擇${srcMod.name || '關聯單據'}`}</option>
        {items.map(it => (
          <option key={it.id} value={optionValue(it)}>{optionLabel(it)}</option>
        ))}
      </select>

      {err && <div style={{ fontSize: '12px', color: 'var(--danger)' }}>{err}</div>}
      {!loading && !err && items.length === 0 && (
        <div style={{ fontSize: '12px', color: 'var(--text-faint)' }}>
          目前沒有可關聯的{srcMod.name || '單據'}{rel?.status?.length ? `（需狀態：${rel.status.map(s => STATUS_LABEL[s] || s).join('、')}）` : ''}
        </div>
      )}

      {selected && (
        <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '12px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>{selected.request_no}</span>
            <span className={`chip chip--${selected.status}`} style={{ fontSize: '11px' }}>{STATUS_LABEL[selected.status] || selected.status}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '6px 16px' }}>
            {(srcMod.fields || []).map(f => {
              const v = selected.payload?.[f.key]
              if (v === undefined || v === null || String(v) === '') return null
              return (
                <div key={f.key} style={{ fontSize: '12px' }}>
                  <span style={{ color: 'var(--text-faint)' }}>{f.label}：</span>
                  <span style={{ color: 'var(--text-muted)' }}>{String(v)}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
