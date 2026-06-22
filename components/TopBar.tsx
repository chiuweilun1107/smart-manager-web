'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { SessionUser } from '@/lib/types'

export default function TopBar({ user }: { user: SessionUser }) {
  const router = useRouter()
  const [initials, setInitials] = useState('')
  // null = not yet mounted (avoids SSR/client mismatch)
  const [isDark, setIsDark] = useState<boolean | null>(null)

  useEffect(() => {
    const name = user.displayName || user.email || ''
    setInitials(name.slice(0, 2).toUpperCase())
    const saved = localStorage.getItem('theme')
    setIsDark(saved !== 'light')
    if (saved === 'light') document.documentElement.dataset.theme = 'light'
  }, [user.displayName, user.email])

  function toggleTheme() {
    const html = document.documentElement
    if (html.dataset.theme === 'light') {
      delete html.dataset.theme
      localStorage.setItem('theme', 'dark')
      setIsDark(true)
    } else {
      html.dataset.theme = 'light'
      localStorage.setItem('theme', 'light')
      setIsDark(false)
    }
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  return (
    <header style={{
      height: 'var(--topbar-h)',
      background: 'var(--surface)',
      borderBottom: '1px solid var(--border)',
      display: 'flex', alignItems: 'center',
      padding: '0 20px', gap: '8px', flexShrink: 0,
    }}>
      <div style={{ flex: 1 }} />

      {/* Light/dark toggle — only render after mount to avoid hydration mismatch */}
      {isDark !== null && (
        <button
          onClick={toggleTheme}
          aria-label={isDark ? '切換淺色模式' : '切換深色模式'}
          title={isDark ? '切換淺色模式' : '切換深色模式'}
          style={{
            width: '32px', height: '32px',
            borderRadius: 'var(--radius)',
            background: 'transparent', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--text-muted)', transition: 'color 0.15s ease',
          }}
          onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = 'var(--text)')}
          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'var(--text-muted)')}
        >
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

      {/* Notification bell */}
      <button
        aria-label="通知"
        style={{
          width: '32px', height: '32px',
          borderRadius: 'var(--radius)', background: 'transparent',
          border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--text-muted)', transition: 'color 0.15s ease',
        }}
        onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = 'var(--text)')}
        onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'var(--text-muted)')}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ overflow: 'visible' }}>
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
      </button>

      {/* User info + logout */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{
          width: '28px', height: '28px', borderRadius: 'var(--radius-full)',
          background: 'var(--primary-light)', border: '1px solid var(--primary)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--font-geist-mono), monospace',
          fontSize: '11px', fontWeight: 600, color: 'var(--primary)', flexShrink: 0,
        }}>
          {initials}
        </div>
        <span style={{
          fontSize: '13px', color: 'var(--text-muted)',
          maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {user.displayName || user.email}
        </span>
      </div>

      <button
        onClick={logout}
        className="label-mono"
        style={{
          background: 'transparent', border: 'none', cursor: 'pointer',
          color: 'var(--text-faint)', padding: '4px 8px',
          borderRadius: 'var(--radius-sm)', transition: 'color 0.15s ease',
        }}
        onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = 'var(--text)')}
        onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'var(--text-faint)')}
      >
        登出
      </button>
    </header>
  )
}
