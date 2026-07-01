'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type PendingApprovalsWidget = { widget: string; count: number; updatedAt: string }
type RecentActivityWidget = {
  widget: string
  total: number
  recent: { requestNo: string | null; module: string | null; status: string | null; createdAt: string | null }[]
  updatedAt: string
}

/**
 * Widget 微服務展示頁 — 呼叫 aido-manager-web 自己的 /api/v1/widgets/*（非轉呼叫），
 * 資料真實、認證真實；畫面呈現的是「EIP 首頁嵌入情境規劃」，因為送件當下尚未取得
 * ASUS 實際入口網頁面規格（依申請須知，技術對接於入選後執行期才進行）。
 */
export default function WidgetsPreviewPage() {
  const [pending, setPending] = useState<PendingApprovalsWidget | null>(null)
  const [recent, setRecent] = useState<RecentActivityWidget | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    (async () => {
      try {
        const supabase = createClient()
        const { data } = await supabase.auth.getSession()
        const token = data.session?.access_token
        if (!token) { setErr('未登入，無法載入 widget 資料'); return }

        const headers = { Authorization: `Bearer ${token}` }
        const [pendingRes, recentRes] = await Promise.all([
          fetch('/api/v1/widgets/pending-approvals', { headers }),
          fetch('/api/v1/widgets/recent-activity', { headers }),
        ])
        if (pendingRes.ok) setPending(await pendingRes.json())
        if (recentRes.ok) setRecent(await recentRes.json())
        if (!pendingRes.ok && !recentRes.ok) setErr('Widget API 呼叫失敗')
      } catch {
        setErr('Widget API 呼叫失敗')
      }
    })()
  }, [])

  return (
    <main style={{ maxWidth: '640px', margin: '0 auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h1 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text)' }}>Widget 微服務展示</h1>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
          以下卡片為真實呼叫 aido-manager-web 自身 /api/v1/widgets/*（非轉呼叫、非假資料）；
          畫面框為 EIP 首頁嵌入情境規劃 —— 實際入口網頁面規格待入選後執行期由 ASUS 提供。
        </p>
      </div>

      {err && <p role="alert" style={{ background: 'var(--danger-bg)', color: 'var(--danger)', borderRadius: 'var(--radius)', padding: '10px 12px', fontSize: '13px' }}>{err}</p>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: '16px' }}>
        <div style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', background: 'var(--surface)', padding: '16px' }}>
          <p style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.05em', color: 'var(--text-faint)', textTransform: 'uppercase' }}>待簽核 / 審核中</p>
          {pending ? (
            <>
              <p style={{ marginTop: '8px', fontSize: '28px', fontWeight: 700, color: 'var(--text)' }}>{pending.count}</p>
              <p style={{ marginTop: '4px', fontSize: '11px', color: 'var(--text-faint)' }}>更新於 {new Date(pending.updatedAt).toLocaleString('zh-TW')}</p>
            </>
          ) : <p style={{ marginTop: '8px', fontSize: '13px', color: 'var(--text-faint)' }}>載入中…</p>}
        </div>

        <div style={{ borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', background: 'var(--surface)', padding: '16px' }}>
          <p style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.05em', color: 'var(--text-faint)', textTransform: 'uppercase' }}>近期申請摘要</p>
          {recent ? (
            <>
              <p style={{ marginTop: '8px', fontSize: '28px', fontWeight: 700, color: 'var(--text)' }}>{recent.total} <span style={{ fontSize: '13px', fontWeight: 400, color: 'var(--text-faint)' }}>筆</span></p>
              <ul style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {recent.recent.slice(0, 3).map((r, i) => (
                  <li key={i} style={{ fontSize: '11px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.module ?? '—'} · {r.status ?? '—'} · {r.requestNo ?? '—'}</li>
                ))}
                {recent.recent.length === 0 && <li style={{ fontSize: '11px', color: 'var(--text-faint)' }}>目前沒有紀錄</li>}
              </ul>
            </>
          ) : <p style={{ marginTop: '8px', fontSize: '13px', color: 'var(--text-faint)' }}>載入中…</p>}
        </div>
      </div>
    </main>
  )
}
