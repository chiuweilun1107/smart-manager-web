'use client'
import { useEffect, useState } from 'react'

interface FileInfo { url: string; fileName: string; mimeType: string | null }

/** 依 fileId 取限時簽名 URL：圖片顯示縮圖(點擊以頁內燈箱放大)，非圖顯示檔名下載連結。showName=true 時縮圖下方也顯示檔名 */
export default function FilePreview({ fileId, size = 92, showName = false }: { fileId: string | number; size?: number; showName?: boolean }) {
  const [info, setInfo] = useState<FileInfo | null>(null)
  const [err, setErr] = useState('')
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let alive = true
    fetch(`/api/files/${encodeURIComponent(String(fileId))}`)
      .then(r => r.json())
      .then(d => { if (alive) { if (d.error) setErr(d.error); else setInfo(d) } })
      .catch(() => { if (alive) setErr('載入失敗') })
    return () => { alive = false }
  }, [fileId])

  // Esc 關閉燈箱
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  if (err) return <span style={{ fontSize: 12, color: 'var(--danger)' }}>附件 #{String(fileId)}（{err}）</span>
  if (!info) return <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>載入中…</span>

  const isImage = (info.mimeType || '').startsWith('image/')
  if (!isImage) {
    return (
      <a href={info.url} target="_blank" rel="noopener noreferrer"
        style={{ fontSize: 13, color: 'var(--primary)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid var(--border)', borderRadius: '8px', padding: '6px 10px' }}>
        📎 {info.fileName}
      </a>
    )
  }

  return (
    <>
      <div style={{ display: 'inline-flex', flexDirection: 'column', gap: 4, width: size }}>
        <button type="button" onClick={() => setOpen(true)} title={`${info.fileName}（點擊放大）`}
          style={{ padding: 0, border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden', lineHeight: 0, cursor: 'zoom-in', background: 'none' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={info.url} alt={info.fileName} style={{ width: size, height: size, objectFit: 'cover', display: 'block' }} />
        </button>
        {showName && (
          <span title={info.fileName}
            style={{ fontSize: 11, color: 'var(--text-muted)', maxWidth: size, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center' }}>
            {info.fileName}
          </span>
        )}
      </div>
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', cursor: 'zoom-out' }}
        >
          <button type="button" onClick={() => setOpen(false)} aria-label="關閉"
            style={{ position: 'absolute', top: 16, right: 20, background: 'rgba(255,255,255,0.15)', color: '#fff', border: 'none', borderRadius: '999px', width: 36, height: 36, fontSize: 20, lineHeight: 1, cursor: 'pointer' }}>×</button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={info.url} alt={info.fileName} onClick={e => e.stopPropagation()}
            style={{ maxWidth: '92vw', maxHeight: '88vh', objectFit: 'contain', borderRadius: '8px', boxShadow: '0 8px 40px rgba(0,0,0,0.5)' }} />
          <a href={info.url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
            style={{ position: 'absolute', bottom: 20, color: '#fff', fontSize: 13, textDecoration: 'underline' }}>{info.fileName}（開新分頁 / 下載）</a>
        </div>
      )}
    </>
  )
}
