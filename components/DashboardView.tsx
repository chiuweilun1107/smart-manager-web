'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { SessionUser } from '@/lib/types'

interface DashConfig { title: string; link: string }

interface DashData {
  my_requests: Array<{ id: number; request_no: string; module_code: string; title: string; status: string; created_at: string }>
  pending_approvals_count: number
  announcements: Array<{ id: number; title: string; created_at: string }>
  leave_balances: Array<{ period_year: number; used_hours: number; granted_hours: number; leave_types?: { name: string } }>
  today_attendance?: { clock_in_at?: string; clock_out_at?: string } | null
}

const STATUS_MAP: Record<string, string> = {
  draft: '草稿', in_review: '審核中', approved: '已核准',
  rejected: '已駁回', returned: '退回', cancelled: '已取消',
}

const CHIP_CLASS: Record<string, string> = {
  draft: 'chip chip--draft', in_review: 'chip chip--in_review', approved: 'chip chip--approved',
  rejected: 'chip chip--rejected', returned: 'chip chip--returned', cancelled: 'chip chip--cancelled',
}

function fmt(iso: string) {
  return new Date(iso).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })
}

function MetricCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: boolean }) {
  return (
    <div style={{
      padding: '20px 24px',
      borderRight: '1px solid var(--border)',
      position: 'relative',
    }}>
      {accent && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: '2px',
          background: 'var(--primary)', borderRadius: '2px 2px 0 0',
        }} />
      )}
      <div className="label-mono" style={{ marginBottom: '10px' }}>{label}</div>
      <div style={{
        fontSize: '36px', fontWeight: 300,
        color: accent ? 'var(--primary)' : 'var(--text)',
        letterSpacing: '-0.06em', fontVariantNumeric: 'tabular-nums', lineHeight: 1,
      }}>
        {value ?? '—'}
      </div>
      {sub && (
        <div style={{ color: 'var(--text-faint)', fontSize: '12px', marginTop: '8px' }}>{sub}</div>
      )}
    </div>
  )
}

export default function DashboardView({ user, shortcuts }: { user: SessionUser; shortcuts: DashConfig[] }) {
  const [data, setData] = useState<DashData | null>(null)
  const thisYear = new Date().getFullYear()

  useEffect(() => { fetch('/api/dashboard').then(r => r.json()).then(setData).catch(() => {}) }, [])

  const leaveBalance = data?.leave_balances?.find(b => b.period_year === thisYear)
  const clockIn = data?.today_attendance?.clock_in_at
  const clockOut = data?.today_attendance?.clock_out_at
  const attendStr = data?.today_attendance
    ? `${clockIn ? fmt(clockIn) : '—'} → ${clockOut ? fmt(clockOut) : '未退勤'}`
    : null

  return (
    <>
      <style>{`
        .d-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; }
        .d-row { display: flex; align-items: center; padding: 11px 16px; border-bottom: 1px solid var(--border); text-decoration: none; transition: background 0.1s ease; }
        .d-row:hover { background: var(--surface-2); }
        .d-row:last-child { border-bottom: none; }
        .sc-btn { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 14px 16px; text-decoration: none; display: block; transition: border-color 0.15s ease, background 0.15s ease; }
        .sc-btn:hover { border-color: var(--primary); background: var(--primary-light); }
      `}</style>

      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>

        {/* Greeting */}
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{
            fontSize: '24px', fontWeight: 400, color: 'var(--text)',
            letterSpacing: '-0.04em', lineHeight: 1.2, margin: 0,
          }}>
            {getGreeting()}，{user.displayName?.split(' ')[0] || user.email}
          </h1>
          <p style={{ color: 'var(--text-faint)', fontSize: '13px', marginTop: '4px', fontVariantNumeric: 'tabular-nums' }}>
            {new Date().toLocaleDateString('zh-TW', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>

        {/* KPI row — borderless grid, top accent on pending */}
        <div className="d-card" style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
          marginBottom: '20px',
        }}>
          <MetricCard
            label="待簽核"
            value={data?.pending_approvals_count ?? '—'}
            sub={data?.pending_approvals_count ? '需要你處理' : '目前沒有'}
            accent={!!data?.pending_approvals_count}
          />
          <MetricCard
            label="我的申請"
            value={data?.my_requests?.length ?? '—'}
            sub="本月"
          />
          <MetricCard
            label="今日出勤"
            value={attendStr || (data?.today_attendance === null ? '未打卡' : '—')}
            sub={clockOut ? '已退勤' : clockIn ? '進行中' : undefined}
          />
          <MetricCard
            label={leaveBalance?.leave_types?.name || '年假'}
            value={leaveBalance ? `${leaveBalance.granted_hours - leaveBalance.used_hours}h` : '—'}
            sub={leaveBalance ? `已用 ${leaveBalance.used_hours}h` : undefined}
          />
        </div>

        {/* Main content grid: 3:2 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: '16px', marginBottom: '20px' }}>

          {/* Recent requests */}
          <div className="d-card">
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 16px', borderBottom: '1px solid var(--border)',
            }}>
              <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text)' }}>最近申請</span>
              <Link href="/approvals" style={{ fontSize: '12px', color: 'var(--primary)', textDecoration: 'none' }}>
                全部 →
              </Link>
            </div>
            {!data && (
              <div style={{ padding: '32px 16px', textAlign: 'center' }}>
                <div style={{ width: '20px', height: '20px', border: '2px solid var(--border)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto' }} />
                <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
              </div>
            )}
            {data && (!data.my_requests || data.my_requests.length === 0) && (
              <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--text-faint)', fontSize: '13px' }}>
                尚無申請紀錄
              </div>
            )}
            {data?.my_requests?.slice(0, 6).map(r => (
              <Link key={r.id} href={`/request/${r.id}`} className="d-row">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: '13px', fontWeight: 500, color: 'var(--text)',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>{r.title}</div>
                  <div style={{
                    fontFamily: 'var(--font-geist-mono), monospace',
                    fontSize: '11px', color: 'var(--text-faint)', marginTop: '2px', fontVariantNumeric: 'tabular-nums',
                  }}>{r.request_no}</div>
                </div>
                <span className={CHIP_CLASS[r.status] || 'chip chip--draft'} style={{ marginLeft: '12px', flexShrink: 0 }}>
                  {STATUS_MAP[r.status] || r.status}
                </span>
              </Link>
            ))}
          </div>

          {/* Right column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Announcements */}
            <div className="d-card" style={{ flex: 1 }}>
              <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text)' }}>最新公告</span>
              </div>
              {data?.announcements?.length === 0 && (
                <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-faint)', fontSize: '12px' }}>暫無公告</div>
              )}
              {data?.announcements?.slice(0, 4).map(a => (
                <div key={a.id} className="d-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '3px' }}>
                  <div style={{ fontSize: '13px', color: 'var(--text)', fontWeight: 400 }}>{a.title}</div>
                  <div style={{
                    fontFamily: 'var(--font-geist-mono), monospace',
                    fontSize: '10px', color: 'var(--text-faint)', fontVariantNumeric: 'tabular-nums',
                  }}>
                    {new Date(a.created_at).toLocaleDateString('zh-TW')}
                  </div>
                </div>
              ))}
            </div>

            {/* Pending CTA — only show if has pending */}
            {!!data?.pending_approvals_count && (
              <Link href="/approvals" style={{
                display: 'block', textDecoration: 'none',
                background: 'var(--primary-light)', border: '1px solid var(--primary)',
                borderRadius: 'var(--radius)', padding: '16px',
                transition: 'background 0.15s ease',
              }}>
                <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--primary)', marginBottom: '4px' }}>
                  待簽核事項
                </div>
                <div style={{ fontSize: '28px', fontWeight: 300, color: 'var(--primary)', letterSpacing: '-0.05em', fontVariantNumeric: 'tabular-nums' }}>
                  {data.pending_approvals_count} 筆
                </div>
                <div style={{ fontSize: '12px', color: 'var(--primary)', opacity: 0.7, marginTop: '4px' }}>
                  點此前往處理 →
                </div>
              </Link>
            )}
          </div>
        </div>

        {/* Shortcuts */}
        {shortcuts.length > 0 && (
          <div>
            <div className="label-mono" style={{ marginBottom: '10px' }}>快速功能</div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
              gap: '8px',
            }}>
              {shortcuts.map(c => (
                <Link key={c.link} href={c.link} className="sc-btn">
                  <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text)' }}>{c.title}</div>
                  <div style={{ fontSize: '11px', color: 'var(--primary)', marginTop: '6px' }}>前往 →</div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  )
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return '早安'
  if (h < 18) return '午安'
  return '晚安'
}
