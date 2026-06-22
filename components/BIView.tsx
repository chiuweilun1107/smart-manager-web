'use client'
import { useEffect, useState } from 'react'

interface ReportData {
  total: number
  byStatus: Record<string, number>
  byModule: Record<string, number>
  byMonth: Record<string, number>
  totalAmount: number
}

const STATUS_MAP: Record<string, string> = {
  draft: '草稿', in_review: '審核中', approved: '已核准', rejected: '已駁回', returned: '退回', cancelled: '已取消'
}
const STATUS_COLOR: Record<string, string> = {
  draft: 'var(--text-faint)', in_review: 'var(--info)', approved: 'var(--success)',
  rejected: 'var(--danger)', returned: 'var(--warning)', cancelled: 'var(--text-faint)'
}

function BarRow({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
      <div style={{ width: '80px', fontSize: '12px', color: 'var(--text-muted)', textAlign: 'right', flexShrink: 0 }}>{label}</div>
      <div style={{ flex: 1, background: 'var(--surface-2)', borderRadius: 'var(--radius-sm)', height: '20px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 'var(--radius-sm)', transition: 'width 0.3s ease' }} />
      </div>
      <div style={{ width: '36px', fontSize: '12px', color: 'var(--text)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{value}</div>
    </div>
  )
}

export default function BIView() {
  const [data, setData] = useState<ReportData | null>(null)
  const [err, setErr] = useState(false)

  useEffect(() => {
    fetch('/api/reports').then(r => { if (!r.ok) throw new Error(); return r.json() }).then(setData).catch(() => setErr(true))
  }, [])

  if (err) return <div style={{ padding: '40px', textAlign: 'center', color: 'var(--danger)' }}>報表載入失敗</div>
  if (!data) return <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-faint)' }}>載入中…</div>

  const statusMax = Math.max(1, ...Object.values(data.byStatus))
  const moduleMax = Math.max(1, ...Object.values(data.byModule))
  const monthEntries = Object.entries(data.byMonth).sort().slice(-6)
  const monthMax = Math.max(1, ...monthEntries.map(([, v]) => v))

  const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px' }

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '8px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 600, color: 'var(--text)', letterSpacing: '-0.03em', margin: 0 }}>報表分析</h1>
        <a href="/api/reports/export" download
          style={{ background: 'var(--primary)', color: '#fff', fontSize: '13px', padding: '8px 16px', borderRadius: 'var(--radius)', textDecoration: 'none' }}>
          匯出 Excel (CSV)
        </a>
      </div>

      {/* KPI 卡 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px', marginBottom: '20px' }}>
        <div style={card}>
          <div className="label-mono" style={{ marginBottom: '8px' }}>總申請數</div>
          <div style={{ fontSize: '32px', fontWeight: 300, color: 'var(--text)', letterSpacing: '-0.05em' }}>{data.total}</div>
        </div>
        <div style={card}>
          <div className="label-mono" style={{ marginBottom: '8px' }}>已核准</div>
          <div style={{ fontSize: '32px', fontWeight: 300, color: 'var(--success)', letterSpacing: '-0.05em' }}>{data.byStatus.approved || 0}</div>
        </div>
        <div style={card}>
          <div className="label-mono" style={{ marginBottom: '8px' }}>審核中</div>
          <div style={{ fontSize: '32px', fontWeight: 300, color: 'var(--info)', letterSpacing: '-0.05em' }}>{data.byStatus.in_review || 0}</div>
        </div>
        <div style={card}>
          <div className="label-mono" style={{ marginBottom: '8px' }}>總金額</div>
          <div style={{ fontSize: '32px', fontWeight: 300, color: 'var(--text)', letterSpacing: '-0.05em', fontVariantNumeric: 'tabular-nums' }}>
            {data.totalAmount.toLocaleString()}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
        <div style={card}>
          <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)', marginTop: 0, marginBottom: '16px' }}>狀態分布</h3>
          {Object.entries(data.byStatus).map(([k, v]) => (
            <BarRow key={k} label={STATUS_MAP[k] || k} value={v} max={statusMax} color={STATUS_COLOR[k] || 'var(--primary)'} />
          ))}
          {Object.keys(data.byStatus).length === 0 && <div style={{ fontSize: '13px', color: 'var(--text-faint)' }}>尚無資料</div>}
        </div>
        <div style={card}>
          <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)', marginTop: 0, marginBottom: '16px' }}>各模組申請數</h3>
          {Object.entries(data.byModule).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => (
            <BarRow key={k} label={k} value={v} max={moduleMax} color="var(--primary)" />
          ))}
          {Object.keys(data.byModule).length === 0 && <div style={{ fontSize: '13px', color: 'var(--text-faint)' }}>尚無資料</div>}
        </div>
        <div style={card}>
          <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)', marginTop: 0, marginBottom: '16px' }}>近 6 個月趨勢</h3>
          {monthEntries.map(([k, v]) => <BarRow key={k} label={k} value={v} max={monthMax} color="var(--info)" />)}
          {monthEntries.length === 0 && <div style={{ fontSize: '13px', color: 'var(--text-faint)' }}>尚無資料</div>}
        </div>
      </div>
    </div>
  )
}
