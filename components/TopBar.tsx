'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { SessionUser } from '@/lib/types'

export default function TopBar({ user }: { user: SessionUser }) {
  const router = useRouter()
  const [initials, setInitials] = useState('')
  const [isDark, setIsDark] = useState<boolean | null>(null)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const name = user.displayName || user.email || ''
    setInitials(name.slice(0, 2).toUpperCase())
    const saved = localStorage.getItem('theme')
    const dark = saved === 'dark'
    setIsDark(dark)
    if (dark) document.documentElement.dataset.theme = 'dark'
    else delete document.documentElement.dataset.theme
  }, [user.displayName, user.email])

  // scroll-aware：主內容下拉時才出現分隔線/陰影 (平常與內容同底色)
  useEffect(() => {
    const main = document.querySelector('main')
    if (!main) return
    const onScroll = () => setScrolled(main.scrollTop > 4)
    main.addEventListener('scroll', onScroll, { passive: true })
    return () => main.removeEventListener('scroll', onScroll)
  }, [])

  function toggleTheme() {
    const html = document.documentElement
    if (html.dataset.theme === 'dark') {
      delete html.dataset.theme; localStorage.setItem('theme', 'light'); setIsDark(false)
    } else {
      html.dataset.theme = 'dark'; localStorage.setItem('theme', 'dark'); setIsDark(true)
    }
  }

  async function logout() {
    try { await fetch('/api/auth/logout', { method: 'POST' }) }
    finally { router.push('/login'); router.refresh() }
  }

  const iconBtn: React.CSSProperties = {
    width: '32px', height: '32px', borderRadius: 'var(--radius)',
    background: 'transparent', border: 'none', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: 'var(--text-muted)', transition: 'color 0.15s ease',
  }

  return (
    <header style={{
      height: 'var(--topbar-h)',
      background: scrolled ? 'var(--surface)' : 'var(--bg)',
      borderBottom: scrolled ? '1px solid var(--border)' : '1px solid transparent',
      boxShadow: scrolled ? '0 1px 4px rgba(0,0,0,0.04)' : 'none',
      display: 'flex', alignItems: 'center',
      padding: '0 20px', gap: '12px', flexShrink: 0,
      transition: 'background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease',
    }}>
      <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)', letterSpacing: '-0.01em', whiteSpace: 'nowrap' }}>
        企業行政管理平台
      </div>

      <div style={{ flex: 1 }} />

      {/* 角色 / 部門 資訊 (依示意圖) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '12px', fontFamily: 'var(--font-geist-mono), monospace' }}>
        <span style={{ color: 'var(--text-faint)' }}>角色 <span style={{ color: 'var(--text)', fontWeight: 600 }}>{user.roleName}</span></span>
        {user.departmentName && (
          <>
            <span style={{ color: 'var(--border-strong)' }}>|</span>
            <span style={{ color: 'var(--text-faint)' }}>部門 <span style={{ color: 'var(--text)', fontWeight: 600 }}>{user.departmentName}</span></span>
          </>
        )}
      </div>

      <div style={{ width: '1px', height: '20px', background: 'var(--border)' }} />

      {isDark !== null && (
        <button onClick={toggleTheme} aria-label={isDark ? '切換淺色模式' : '切換深色模式'} title={isDark ? '切換淺色模式' : '切換深色模式'} style={iconBtn}
          onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = 'var(--text)')}
          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'var(--text-muted)')}>
          {isDark ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ overflow: 'visible' }}>
              <circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ overflow: 'visible' }}>
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
            </svg>
          )}
        </button>
      )}

      <button aria-label="通知" style={iconBtn}
        onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = 'var(--text)')}
        onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'var(--text-muted)')}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ overflow: 'visible' }}>
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{
          width: '30px', height: '30px', borderRadius: 'var(--radius-full)',
          background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--font-geist-mono), monospace', fontSize: '11px', fontWeight: 700, color: '#fff', flexShrink: 0,
        }}>
          {initials}
        </div>
        <span style={{ fontSize: '13px', color: 'var(--text)', fontWeight: 500, maxWidth: '110px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {user.displayName || user.email}
        </span>
      </div>

      <button onClick={logout} className="label-mono" style={{
        background: 'transparent', border: 'none', cursor: 'pointer',
        color: 'var(--text-faint)', padding: '4px 8px', borderRadius: 'var(--radius-sm)', transition: 'color 0.15s ease',
      }}
        onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = 'var(--primary)')}
        onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'var(--text-faint)')}>
        登出
      </button>
    </header>
  )
}
